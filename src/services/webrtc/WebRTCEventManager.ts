
import { IPChangeEvent } from './IPChangeManager';
import { WebRTCConnection } from './WebRTCConnection';
import { ConnectionManager } from './ConnectionManager';
import { ReconnectionManager } from './ReconnectionManager';
import { AutoReconnectionManager } from './AutoReconnectionManager';
import { IPChangeManager } from './IPChangeManager';
import { WebRTCEventHandler } from './WebRTCEventHandler';

export class WebRTCEventManager {
  private webrtcConnection: WebRTCConnection;
  private connectionManager: ConnectionManager;
  private reconnectionManager: ReconnectionManager;
  private autoReconnectionManager: AutoReconnectionManager;
  private ipChangeManager: IPChangeManager;
  private eventHandler: WebRTCEventHandler;
  private isAdmin: boolean;

  constructor(
    webrtcConnection: WebRTCConnection,
    connectionManager: ConnectionManager,
    reconnectionManager: ReconnectionManager,
    autoReconnectionManager: AutoReconnectionManager,
    ipChangeManager: IPChangeManager,
    eventHandler: WebRTCEventHandler,
    isAdmin: boolean
  ) {
    this.webrtcConnection = webrtcConnection;
    this.connectionManager = connectionManager;
    this.reconnectionManager = reconnectionManager;
    this.autoReconnectionManager = autoReconnectionManager;
    this.ipChangeManager = ipChangeManager;
    this.eventHandler = eventHandler;
    this.isAdmin = isAdmin;
  }

  setupConnectionHandlers(): void {
    const connection = this.webrtcConnection.getConnection();
    if (!connection) return;

    this.eventHandler.setupConnectionEvents(connection, {
      onIceCandidate: (candidate) => {
        this.webrtcConnection.addPendingIceCandidate(candidate);
        console.log('ICE candidate generated');
        
        const peers = this.connectionManager.getConnectedPeers();
        peers.forEach(peer => {
          this.connectionManager.sendIceCandidate(peer.id, candidate);
        });
      },
      
      onConnectionStateChange: (state) => {
        if (state === 'connected') {
          const peers = this.connectionManager.getConnectedPeers();
          peers.forEach(peer => {
            this.reconnectionManager.markReconnectionSuccess(peer.id);
            
            if (this.isAdmin) {
              this.autoReconnectionManager.saveClientConnection(
                peer.id,
                peer.name,
                peer.organizationId
              );
            }
          });
          
          this.ipChangeManager.setConnectionInstability(false);
          console.log('Successfully connected to peer');
        } else if (state === 'disconnected' || state === 'failed') {
          this.handleConnectionLoss();
        }
      },
      
      onDataChannel: (channel) => {
        const lastOffer = this.getLastServerOffer();
        if (lastOffer) {
          this.connectionManager.setupDataChannel(channel, lastOffer.adminId);
        }
      }
    });
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
      } else if (state === 'failed') {
        this.notifyConnectionLost(peerId);
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
      const lastOffer = this.getLastServerOffer();
      if (connectedPeers.length === 0 && lastOffer) {
        console.log('No admin response, attempting client-side reconnection...');
        this.handleConnectionLoss();
      }
    }, 10000);
  }

  private handleConnectionLoss(): void {
    const peers = this.connectionManager.getConnectedPeers();
    
    peers.forEach(peer => {
      if (this.reconnectionManager.shouldInitiateReconnection(peer.id, 'connection-lost')) {
        const attemptNumber = this.reconnectionManager.startReconnectionAttempt(peer.id, 'connection-lost');
        const delay = this.reconnectionManager.getDelayForAttempt(attemptNumber);
        
        setTimeout(async () => {
          this.onAttemptReconnection?.(peer.id);
        }, delay);
      }
    });
  }

  private notifyConnectionLost(peerId?: string): void {
    console.log('Connection permanently lost for peer:', peerId);
    
    const event = new CustomEvent('webrtc-connection-lost', {
      detail: {
        isAdmin: this.isAdmin,
        organizationId: this.organizationId,
        peerId: peerId,
        reconnectionState: peerId ? this.reconnectionManager.getReconnectionState(peerId) : null
      }
    });
    window.dispatchEvent(event);
  }

  // Callback handlers - these will be set by WebRTCService
  onSendUpdatedOfferToAllClients?: (newIP: string) => Promise<void>;
  onSendUpdatedOfferToClient?: (clientId: string) => Promise<void>;
  onAttemptReconnection?: (peerId: string) => Promise<void>;
  getLastServerOffer?: () => any;
  organizationId?: string;
}
