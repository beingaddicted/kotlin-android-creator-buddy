
import { WebRTCMessage } from './types';
import { SignalingMessage } from './SignalingService';
import { SecurityMessageHandler } from './SecurityMessageHandler';
import { PeerManager } from './PeerManager';

export class MessageRouter {
  private peerManager: PeerManager;
  private isServer: boolean = false;
  private onLocationReceived?: (userId: string, location: any) => void;
  private onMessageReceived?: (message: WebRTCMessage, fromPeerId: string) => void;

  constructor(peerManager: PeerManager) {
    this.peerManager = peerManager;
  }

  setAsServer(isServer: boolean) {
    this.isServer = isServer;
  }

  async routeMessage(event: MessageEvent, peerId: string): Promise<void> {
    const message = JSON.parse(event.data);
    
    // Handle security messages first
    if (SecurityMessageHandler.isSecurityMessage(message)) {
      await SecurityMessageHandler.handleSecurityMessage(message, peerId);
      return;
    }
    
    // Check if it's a signaling message
    if (this.isSignalingMessage(message)) {
      // Let SignalingService handle it - don't process here
      return;
    }
    
    // Handle as regular WebRTC message
    await this.handleWebRTCMessage(message as WebRTCMessage, peerId);
  }

  private async handleWebRTCMessage(message: WebRTCMessage, peerId: string): Promise<void> {
    console.log('MessageRouter: Received message:', message.type, 'from:', peerId);

    // Check permissions for sensitive operations
    if (window.securityManager && SecurityMessageHandler.requiresPermission(message.type)) {
      if (!SecurityMessageHandler.checkMessagePermissions(message, peerId)) {
        console.warn('MessageRouter: Insufficient permissions for message type:', message.type);
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
        if (window.securityManager && !window.securityManager.canAccessLocation(peerId)) {
          console.warn('MessageRouter: Unauthorized location request from', peerId);
          return;
        }
        
        if (!this.isServer) {
          this.sendLocationRequestedEvent();
        }
        break;
        
      case 'mesh-data':
        this.handleMeshData(message.data, peerId);
        break;
        
      default:
        if (this.onMessageReceived) {
          this.onMessageReceived(message, peerId);
        }
        break;
    }
  }

  private isSignalingMessage(data: any): boolean {
    return data && 
           typeof data === 'object' &&
           ['new-offer', 'new-answer', 'ice-candidate', 'ip-changed'].includes(data.type) &&
           data.fromId &&
           typeof data.timestamp === 'number';
  }

  private handleMeshData(meshData: any, peerId: string): void {
    console.log('MessageRouter: Received mesh data from', peerId);
    
    const event = new CustomEvent('webrtc-mesh-data-received', {
      detail: { meshData, fromPeerId: peerId }
    });
    window.dispatchEvent(event);
  }

  private sendLocationRequestedEvent(): void {
    const event = new CustomEvent('webrtc-location-requested');
    window.dispatchEvent(event);
  }

  onLocationUpdate(callback: (userId: string, location: any) => void) {
    this.onLocationReceived = callback;
  }

  onMessage(callback: (message: WebRTCMessage, fromPeerId: string) => void) {
    this.onMessageReceived = callback;
  }
}
