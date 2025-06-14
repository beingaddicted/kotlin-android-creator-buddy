
import { IPChangeEvent, IPChangeManager } from './IPChangeManager';
import { ConnectionManager } from './ConnectionManager';
import { ReconnectionManager } from './ReconnectionManager';

export class WebRTCIPEventHandler {
  private connectionManager: ConnectionManager;
  private reconnectionManager: ReconnectionManager;
  private ipChangeManager: IPChangeManager;
  private isAdmin: boolean;

  // Callback handlers
  onSendUpdatedOfferToAllClients?: (newIP: string) => Promise<void>;
  onSendUpdatedOfferToClient?: (clientId: string) => Promise<void>;
  getLastServerOffer?: () => any;

  constructor(
    connectionManager: ConnectionManager,
    reconnectionManager: ReconnectionManager,
    ipChangeManager: IPChangeManager,
    isAdmin: boolean
  ) {
    this.connectionManager = connectionManager;
    this.reconnectionManager = reconnectionManager;
    this.ipChangeManager = ipChangeManager;
    this.isAdmin = isAdmin;
  }

  setupIPChangeHandling(): void {
    this.ipChangeManager.startMonitoring();
    
    this.ipChangeManager.onIPChange((event: IPChangeEvent) => {
      this.handleIPChangeEvent(event);
    });
    
    this.reconnectionManager.onReconnectionStateChange((peerId, state) => {
      console.log(`Reconnection state changed for ${peerId}: ${state}`);
      
      if (state === 'success') {
        this.ipChangeManager.setConnectionInstability(false);
      } else if (state === 'attempting') {
        this.ipChangeManager.setConnectionInstability(true);
      }
    });
  }

  private async handleIPChangeEvent(event: IPChangeEvent): Promise<void> {
    console.log('Handling IP change event:', event);
    
    if (event.source === 'local') {
      await this.handleLocalIPChange(event);
    } else if (event.source === 'peer' && event.peerId) {
      await this.handlePeerIPChange(event.peerId, event.oldIP, event.newIP);
    }
  }

  private async handleLocalIPChange(event: IPChangeEvent): Promise<void> {
    console.log('Local IP changed from', event.oldIP, 'to', event.newIP);
    
    this.connectionManager.notifyIpChange(event.newIP);
    
    if (this.isAdmin) {
      this.onSendUpdatedOfferToAllClients?.(event.newIP);
    } else {
      await this.handleClientIPChange();
    }
  }

  private async handlePeerIPChange(peerId: string, oldIP: string, newIP: string): Promise<void> {
    console.log(`Peer ${peerId} IP changed from ${oldIP} to ${newIP}`);
    
    if (this.isAdmin && this.reconnectionManager.shouldInitiateReconnection(peerId, 'ip-change')) {
      const attemptNumber = this.reconnectionManager.startReconnectionAttempt(peerId, 'ip-change');
      const delay = this.reconnectionManager.getDelayForAttempt(attemptNumber);
      
      setTimeout(async () => {
        this.onSendUpdatedOfferToClient?.(peerId);
      }, delay);
    }
  }

  private async handleClientIPChange(): Promise<void> {
    console.log('Client IP changed, waiting for admin response...');
    
    setTimeout(() => {
      const connectedPeers = this.connectionManager.getConnectedPeers();
      const lastOffer = this.getLastServerOffer?.();
      if (connectedPeers.length === 0 && lastOffer) {
        console.log('No admin response, attempting client-side reconnection...');
        // Trigger connection loss handling
        const event = new CustomEvent('webrtc-client-reconnection-needed');
        window.dispatchEvent(event);
      }
    }, 10000);
  }
}
