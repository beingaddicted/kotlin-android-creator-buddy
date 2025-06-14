import { WebRTCConnection } from './WebRTCConnection';
import { ConnectionManager } from './ConnectionManager';
import { ReconnectionManager } from './ReconnectionManager';
import { AutoReconnectionManager } from './AutoReconnectionManager';
import { IPChangeManager } from './IPChangeManager';
import { WebRTCEventHandler } from './WebRTCEventHandler';

export class WebRTCConnectionEventHandler {
  private webrtcConnection: WebRTCConnection;
  private connectionManager: ConnectionManager;
  private reconnectionManager: ReconnectionManager;
  private autoReconnectionManager: AutoReconnectionManager;
  private ipChangeManager: IPChangeManager;
  private eventHandler: WebRTCEventHandler;
  private isAdmin: boolean;

  // Callback handlers
  onSendUpdatedOfferToAllClients?: (newIP: string) => Promise<void>;
  onSendUpdatedOfferToClient?: (clientId: string) => Promise<void>;
  onAttemptReconnection?: (peerId: string) => Promise<void>;
  getLastServerOffer?: () => any;
  organizationId?: string;

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
        const lastOffer = this.getLastServerOffer?.();
        if (lastOffer) {
          this.connectionManager.setupDataChannel(channel, lastOffer.adminId);
        }
      }
    });
  }

  private handleConnectionLoss(): void {
    // Use getAllPeers to ensure we try to reconnect even if status is already 'disconnected'
    const peers = this.connectionManager.getAllPeers();
    
    if (peers.length === 0) {
      console.log('Connection lost, but no known peers to reconnect to. Notifying system.');
      this.notifyConnectionLost();
      return;
    }

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

  notifyConnectionLost(peerId?: string): void {
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
}
