
import { LightweightSignalingClient, SignalingServerMessage } from './LightweightSignalingClient';
import { PersistentStorage, StoredClientInfo } from './PersistentStorage';
import { WebRTCConnection } from './WebRTCConnection';
import { WebRTCOfferManager } from './WebRTCOfferManager';
import { ConnectionManager } from './ConnectionManager';

export class EnhancedReconnectionManager {
  private signalingClient: LightweightSignalingClient | null = null;
  private persistentStorage = new PersistentStorage();
  private isAdmin = false;
  private deviceId: string;
  private organizationId: string;
  private reconnectionStartedCallback?: (clientIds: string[]) => void;

  constructor(deviceId: string, organizationId: string, isAdmin: boolean) {
    this.deviceId = deviceId;
    this.organizationId = organizationId;
    this.isAdmin = isAdmin;
  }

  async initialize(): Promise<boolean> {
    try {
      this.signalingClient = new LightweightSignalingClient(
        this.deviceId,
        this.isAdmin ? 'admin' : 'client',
        this.organizationId
      );

      const connected = await this.signalingClient.connect();
      
      if (connected) {
        this.setupMessageHandlers();
        
        // If admin, check for stored clients and attempt reconnection
        if (this.isAdmin) {
          this.attemptStoredClientReconnection();
        }
      }

      return connected;
    } catch (error) {
      console.error('EnhancedReconnection: Failed to initialize:', error);
      return false;
    }
  }

  private setupMessageHandlers(): void {
    if (!this.signalingClient) return;

    this.signalingClient.onMessage('reconnection-request', (message) => {
      if (!this.isAdmin) {
        // Client received reconnection request from admin
        this.handleReconnectionRequest(message);
      }
    });

    this.signalingClient.onMessage('offer', (message) => {
      // Both admin and client can receive offers
      this.handleOffer(message);
    });

    this.signalingClient.onMessage('answer', (message) => {
      if (this.isAdmin) {
        // Admin received answer from client
        this.handleAnswer(message);
      }
    });

    this.signalingClient.onMessage('ice-candidate', (message) => {
      this.handleIceCandidate(message);
    });
  }

  private attemptStoredClientReconnection(): void {
    const storedState = this.persistentStorage.loadServerState();
    
    if (!storedState || storedState.clients.length === 0) {
      console.log('EnhancedReconnection: No stored clients to reconnect');
      return;
    }

    console.log(`EnhancedReconnection: Attempting to reconnect to ${storedState.clients.length} stored clients`);
    
    const clientIds = storedState.clients.map(client => client.id);
    
    // Notify that reconnection process started
    if (this.reconnectionStartedCallback) {
      this.reconnectionStartedCallback(clientIds);
    }

    // Send reconnection requests through signaling server
    if (this.signalingClient) {
      this.signalingClient.requestReconnection(clientIds);
    }

    // Emit event for UI updates
    const event = new CustomEvent('webrtc-auto-reconnection-started', {
      detail: { reconnectedClients: clientIds.length }
    });
    window.dispatchEvent(event);
  }

  private async handleReconnectionRequest(message: SignalingServerMessage): Promise<void> {
    console.log('EnhancedReconnection: Received reconnection request from admin:', message.fromId);
    
    // Client should respond by initiating a new connection
    const event = new CustomEvent('webrtc-reconnection-requested', {
      detail: { adminId: message.fromId, organizationId: message.organizationId }
    });
    window.dispatchEvent(event);
  }

  private handleOffer(message: SignalingServerMessage): void {
    console.log('EnhancedReconnection: Received offer from:', message.fromId);
    
    const event = new CustomEvent('webrtc-signaling-offer', {
      detail: { offer: message.data, fromId: message.fromId }
    });
    window.dispatchEvent(event);
  }

  private handleAnswer(message: SignalingServerMessage): void {
    console.log('EnhancedReconnection: Received answer from:', message.fromId);
    
    const event = new CustomEvent('webrtc-signaling-answer', {
      detail: { answer: message.data, fromId: message.fromId }
    });
    window.dispatchEvent(event);
  }

  private handleIceCandidate(message: SignalingServerMessage): void {
    console.log('EnhancedReconnection: Received ICE candidate from:', message.fromId);
    
    const event = new CustomEvent('webrtc-signaling-ice', {
      detail: { candidate: message.data, fromId: message.fromId }
    });
    window.dispatchEvent(event);
  }

  // Admin methods
  sendOfferToClient(clientId: string, offer: any): void {
    if (this.isAdmin && this.signalingClient) {
      this.signalingClient.sendOffer(clientId, offer);
    }
  }

  // Client methods
  sendAnswerToAdmin(adminId: string, answer: any): void {
    if (!this.isAdmin && this.signalingClient) {
      this.signalingClient.sendAnswer(adminId, answer);
    }
  }

  // Common methods
  sendIceCandidate(targetId: string, candidate: RTCIceCandidate): void {
    if (this.signalingClient) {
      this.signalingClient.sendIceCandidate(targetId, candidate);
    }
  }

  setOnReconnectionStarted(callback: (clientIds: string[]) => void): void {
    this.reconnectionStartedCallback = callback;
  }

  isSignalingConnected(): boolean {
    return this.signalingClient?.isSignalingConnected() || false;
  }

  cleanup(): void {
    if (this.signalingClient) {
      this.signalingClient.disconnect();
      this.signalingClient = null;
    }
  }
}
