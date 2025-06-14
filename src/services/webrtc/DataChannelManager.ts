import { WebRTCMessage } from './types';
import { SignalingMessage, SignalingService } from './SignalingService';
import { PeerManager } from './PeerManager';

export class DataChannelManager {
  private peerManager: PeerManager;
  private signalingService: SignalingService;
  private isServer: boolean = false;
  private onLocationReceived?: (userId: string, location: any) => void;
  private onSignalingReceived?: (message: SignalingMessage, fromPeerId: string) => void;

  constructor(peerManager: PeerManager, signalingService: SignalingService) {
    this.peerManager = peerManager;
    this.signalingService = signalingService;
  }

  setAsServer(isServer: boolean) {
    this.isServer = isServer;
  }

  setupDataChannel(dataChannel: RTCDataChannel, peerId: string) {
    dataChannel.onopen = () => {
      console.log('WebRTC: Data channel opened with', peerId);
      
      this.peerManager.updatePeerStatus(peerId, 'connected');
      this.peerManager.setPeerDataChannel(peerId, dataChannel);
      
      // Register with signaling service
      this.signalingService.registerDataChannel(peerId, dataChannel);
      
      // Start device authentication if security manager is available
      if (window.securityManager) {
        window.securityManager.authenticateDevice(peerId);
      }
      
      // If server, request initial location from client
      if (this.isServer) {
        this.requestLocationUpdate(peerId);
      }
    };

    dataChannel.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      
      // Handle security messages first
      if (this.isSecurityMessage(message)) {
        await this.handleSecurityMessage(message, peerId);
        return;
      }
      
      // Check if it's a signaling message or regular WebRTC message
      if (this.isSignalingMessage(message)) {
        // Let SignalingService handle it
        return;
      } else {
        // Handle as regular WebRTC message
        this.handleDataChannelMessage(message as WebRTCMessage, peerId);
      }
    };

    dataChannel.onclose = () => {
      console.log('WebRTC: Data channel closed with', peerId);
      this.peerManager.updatePeerStatus(peerId, 'disconnected');
      this.signalingService.removeDataChannel(peerId);
    };

    dataChannel.onerror = (error) => {
      console.error('WebRTC: Data channel error with', peerId, error);
    };
  }

  private isSignalingMessage(data: any): boolean {
    return data && 
           typeof data === 'object' &&
           ['new-offer', 'new-answer', 'ice-candidate', 'ip-changed'].includes(data.type) &&
           data.fromId &&
           typeof data.timestamp === 'number';
  }

  private isSecurityMessage(data: any): boolean {
    return data && 
           typeof data === 'object' &&
           ['auth-challenge', 'auth-response', 'secure-message'].includes(data.type);
  }

  private async handleSecurityMessage(message: WebRTCMessage, peerId: string): Promise<void> {
    if (!window.securityManager) {
      console.warn('DataChannelManager: Security message received but no security manager available');
      return;
    }

    switch (message.type) {
      case 'auth-challenge':
        await window.securityManager.handleAuthChallenge(message.data);
        break;
        
      case 'auth-response':
        // This would need the original challenge - simplified for now
        console.log('DataChannelManager: Auth response received from', peerId);
        break;
        
      case 'secure-message':
        const decrypted = await window.securityManager.decryptMessage(message);
        if (decrypted) {
          // Process the decrypted message
          this.handleDataChannelMessage({
            type: decrypted.type as any,
            data: decrypted.message,
            timestamp: message.timestamp
          }, peerId);
        }
        break;
    }
  }

  private async handleDataChannelMessage(message: WebRTCMessage, peerId: string) {
    console.log('WebRTC: Received message:', message.type, 'from:', peerId);

    // Check permissions for sensitive operations
    if (window.securityManager && this.requiresPermission(message.type)) {
      if (!this.checkMessagePermissions(message, peerId)) {
        console.warn('DataChannelManager: Insufficient permissions for message type:', message.type);
        return;
      }
    }

    switch (message.type) {
      case 'location':
        if (this.onLocationReceived) {
          this.peerManager.updatePeerLastSeen(peerId);
          this.onLocationReceived(peerId, message.data);
        }
        break;
        
      case 'location-request':
        // Check if requester has permission to request location
        if (window.securityManager && !window.securityManager.canAccessLocation(peerId)) {
          console.warn('DataChannelManager: Unauthorized location request from', peerId);
          return;
        }
        
        // Client received location request from server
        if (!this.isServer) {
          this.sendCurrentLocation();
        }
        break;
        
      case 'mesh-data':
        // Handle mesh network data
        this.handleMeshData(message.data, peerId);
        break;
    }
  }

  private requiresPermission(messageType: string): boolean {
    return ['location-request', 'mesh-data'].includes(messageType);
  }

  private checkMessagePermissions(message: WebRTCMessage, peerId: string): boolean {
    if (!window.securityManager) return true;

    switch (message.type) {
      case 'location-request':
        return window.securityManager.canAccessLocation(peerId);
      case 'mesh-data':
        return window.securityManager.isDeviceTrusted(peerId);
      default:
        return true;
    }
  }

  private handleMeshData(meshData: any, peerId: string): void {
    // Forward mesh data to signaling service for processing
    console.log('DataChannelManager: Received mesh data from', peerId);
    
    // Create a custom event for mesh data
    const event = new CustomEvent('webrtc-mesh-data-received', {
      detail: { meshData, fromPeerId: peerId }
    });
    window.dispatchEvent(event);
  }

  // Server method to request location from specific client
  requestLocationUpdate(peerId: string) {
    if (!this.isServer) return;
    
    const peer = this.peerManager.getPeer(peerId);
    if (peer?.dataChannel && peer.dataChannel.readyState === 'open') {
      const message: WebRTCMessage = {
        type: 'location-request',
        data: {},
        timestamp: Date.now()
      };
      peer.dataChannel.send(JSON.stringify(message));
      console.log('WebRTC: Location request sent to', peerId);
    }
  }

  // Client method to send current location when requested
  private sendCurrentLocation() {
    // This will be called by LocationService
    const event = new CustomEvent('webrtc-location-requested');
    window.dispatchEvent(event);
  }

  sendMeshData(peerId: string, meshData: any): void {
    const peer = this.peerManager.getPeer(peerId);
    if (peer?.dataChannel && peer.dataChannel.readyState === 'open') {
      const message: WebRTCMessage = {
        type: 'mesh-data',
        data: meshData,
        timestamp: Date.now()
      };
      
      try {
        peer.dataChannel.send(JSON.stringify(message));
        console.log('DataChannelManager: Sent mesh data to', peerId);
      } catch (error) {
        console.error('DataChannelManager: Failed to send mesh data:', error);
      }
    }
  }

  sendSecureMessage(peerId: string, message: any, messageType: string): Promise<void> {
    if (!window.securityManager) {
      // Fallback to unencrypted
      this.sendMessage(peerId, message, messageType);
      return;
    }

    const encryptedMessage = await window.securityManager.encryptMessage(message, peerId, messageType);
    if (encryptedMessage) {
      this.sendRawMessage(peerId, encryptedMessage);
    } else {
      console.warn('DataChannelManager: Failed to encrypt message, sending unencrypted');
      this.sendMessage(peerId, message, messageType);
    }
  }

  private sendMessage(peerId: string, data: any, type: string): void {
    const peer = this.peerManager.getPeer(peerId);
    if (peer?.dataChannel && peer.dataChannel.readyState === 'open') {
      const message: WebRTCMessage = {
        type: type as any,
        data: data,
        timestamp: Date.now()
      };
      peer.dataChannel.send(JSON.stringify(message));
    }
  }

  private sendRawMessage(peerId: string, message: WebRTCMessage): void {
    const peer = this.peerManager.getPeer(peerId);
    if (peer?.dataChannel && peer.dataChannel.readyState === 'open') {
      peer.dataChannel.send(JSON.stringify(message));
    }
  }

  onLocationUpdate(callback: (userId: string, location: any) => void) {
    this.onLocationReceived = callback;
  }

  onSignalingMessage(callback: (message: SignalingMessage, fromPeerId: string) => void) {
    this.onSignalingReceived = callback;
  }
}
