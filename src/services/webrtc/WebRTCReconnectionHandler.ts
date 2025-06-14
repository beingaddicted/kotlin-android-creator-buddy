
import { WebRTCConnection } from './WebRTCConnection';
import { ConnectionManager } from './ConnectionManager';
import { ReconnectionManager } from './ReconnectionManager';
import { WebRTCOfferManager } from './WebRTCOfferManager';
import { IPChangeManager } from './IPChangeManager';

export class WebRTCReconnectionHandler {
  private webrtcConnection: WebRTCConnection;
  private connectionManager: ConnectionManager;
  private reconnectionManager: ReconnectionManager;
  private offerManager: WebRTCOfferManager;
  private ipChangeManager: IPChangeManager;
  private isAdmin: boolean;

  constructor(
    webrtcConnection: WebRTCConnection,
    connectionManager: ConnectionManager,
    reconnectionManager: ReconnectionManager,
    offerManager: WebRTCOfferManager,
    ipChangeManager: IPChangeManager,
    isAdmin: boolean
  ) {
    this.webrtcConnection = webrtcConnection;
    this.connectionManager = connectionManager;
    this.reconnectionManager = reconnectionManager;
    this.offerManager = offerManager;
    this.ipChangeManager = ipChangeManager;
    this.isAdmin = isAdmin;
  }

  async sendUpdatedOfferToAllClients(newIP: string): Promise<void> {
    try {
      console.log('Sending updated offer to all clients due to IP change to:', newIP);
      
      const newServerOffer = await this.offerManager.createUpdatedOffer(
        this.webrtcConnection, 
        newIP, 
        { iceRestart: true }
      );
      
      if (!newServerOffer) return;
      
      const connectedPeers = this.connectionManager.getConnectedPeers();
      connectedPeers.forEach(peer => {
        if (this.reconnectionManager.shouldInitiateReconnection(peer.id, 'ip-change')) {
          this.reconnectionManager.startReconnectionAttempt(peer.id, 'ip-change');
          this.connectionManager.sendNewOffer(peer.id, newServerOffer);
        }
      });
      
    } catch (error) {
      console.error('Failed to send updated offer to clients:', error);
    }
  }

  async sendUpdatedOfferToClient(clientId: string): Promise<void> {
    try {
      console.log('Sending updated offer to client:', clientId);
      
      const newServerOffer = await this.offerManager.createUpdatedOffer(
        this.webrtcConnection,
        this.ipChangeManager.getCurrentIPSync(),
        { iceRestart: true }
      );
      
      if (newServerOffer) {
        this.connectionManager.sendNewOffer(clientId, newServerOffer);
      }
      
    } catch (error) {
      console.error('Failed to send updated offer to client:', error);
    }
  }

  async attemptReconnection(peerId: string): Promise<void> {
    try {
      console.log('Attempting reconnection for peer:', peerId);
      
      const newServerOffer = await this.offerManager.createUpdatedOffer(
        this.webrtcConnection,
        this.ipChangeManager.getCurrentIPSync(),
        { iceRestart: true }
      );
      
      if (this.isAdmin && newServerOffer) {
        this.connectionManager.sendNewOffer(peerId, newServerOffer);
      }
      
      console.log('Reconnection attempt initiated for:', peerId);
      
    } catch (error) {
      console.error('Reconnection attempt failed for', peerId, error);
      this.reconnectionManager.markReconnectionFailed(peerId);
    }
  }

  async forceReconnect(): Promise<void> {
    const peers = this.connectionManager.getConnectedPeers();
    
    peers.forEach(peer => {
      this.reconnectionManager.clearReconnectionAttempt(peer.id);
    });
    
    // Trigger connection loss handling which will start reconnection attempts
    const event = new CustomEvent('webrtc-force-reconnect');
    window.dispatchEvent(event);
  }
}
