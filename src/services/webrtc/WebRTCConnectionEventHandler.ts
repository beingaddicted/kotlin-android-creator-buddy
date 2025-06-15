
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
  organizationId?: string | null;

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

    connection.onconnectionstatechange = () => {
      this.handleConnectionStateChange(connection.connectionState);
    };

    connection.oniceconnectionstatechange = () => {
      this.handleIceConnectionStateChange(connection.iceConnectionState);
    };

    connection.onicecandidateerror = (event) => {
      this.handleIceCandidateError(event);
    };
  }

  private handleConnectionStateChange(state: RTCPeerConnectionState): void {
    console.log('Connection state changed:', state);
    
    switch (state) {
      case 'connected':
        this.handleConnectionEstablished();
        break;
      case 'disconnected':
        this.handleConnectionLost();
        break;
      case 'failed':
        this.handleConnectionFailed();
        break;
      case 'closed':
        this.handleConnectionClosed();
        break;
    }
  }

  private handleIceConnectionStateChange(state: RTCIceConnectionState): void {
    console.log('ICE connection state changed:', state);
    
    if (state === 'failed' || state === 'disconnected') {
      this.handleIceConnectionIssue(state);
    }
  }

  private handleIceCandidateError(event: RTCPeerConnectionIceErrorEvent): void {
    console.error('ICE candidate error:', event);
    this.ipChangeManager.setConnectionInstability(true);
  }

  private handleConnectionEstablished(): void {
    console.log('WebRTC connection established successfully');
    this.ipChangeManager.setConnectionInstability(false);
    this.reconnectionManager.clearAllReconnections();
    
    this.eventHandler.dispatchEvent('webrtc-connection-established', {
      timestamp: Date.now()
    });
  }

  private handleConnectionLost(): void {
    console.log('WebRTC connection lost');
    this.ipChangeManager.setConnectionInstability(true);
    
    if (this.isAdmin) {
      this.startAdminReconnectionProcess();
    } else {
      this.startClientReconnectionProcess();
    }
    
    this.eventHandler.dispatchEvent('webrtc-connection-lost', {
      timestamp: Date.now()
    });
  }

  private handleConnectionFailed(): void {
    console.log('WebRTC connection failed');
    this.handleConnectionLost();
  }

  private handleConnectionClosed(): void {
    console.log('WebRTC connection closed');
    this.ipChangeManager.setConnectionInstability(false);
  }

  private handleIceConnectionIssue(state: RTCIceConnectionState): void {
    console.log('ICE connection issue:', state);
    
    if (this.isAdmin && state === 'failed') {
      this.handleAdminIceFailure();
    }
  }

  private startAdminReconnectionProcess(): void {
    const peers = this.connectionManager.getAllPeers();
    
    peers.forEach(peer => {
      if (this.reconnectionManager.shouldInitiateReconnection(peer.id, 'connection-lost')) {
        const attemptNumber = this.reconnectionManager.startReconnectionAttempt(peer.id, 'connection-lost');
        const delay = this.reconnectionManager.getDelayForAttempt(attemptNumber);
        
        setTimeout(() => {
          this.onSendUpdatedOfferToClient?.(peer.id);
        }, delay);
      }
    });
  }

  private startClientReconnectionProcess(): void {
    const lastOffer = this.getLastServerOffer?.();
    if (lastOffer) {
      setTimeout(() => {
        this.onAttemptReconnection?.(lastOffer.adminId);
      }, 5000);
    }
  }

  private handleAdminIceFailure(): void {
    if (this.organizationId) {
      this.autoReconnectionManager.startAutoReconnection(this.organizationId);
    }
  }
}
