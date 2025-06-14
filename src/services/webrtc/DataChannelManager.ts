
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
      
      // If server, request initial location from client
      if (this.isServer) {
        this.requestLocationUpdate(peerId);
      }
    };

    dataChannel.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
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

  private handleDataChannelMessage(message: WebRTCMessage, peerId: string) {
    console.log('WebRTC: Received message:', message.type, 'from:', peerId);

    switch (message.type) {
      case 'location':
        if (this.onLocationReceived) {
          this.peerManager.updatePeerLastSeen(peerId);
          this.onLocationReceived(peerId, message.data);
        }
        break;
        
      case 'location-request':
        // Client received location request from server
        if (!this.isServer) {
          this.sendCurrentLocation();
        }
        break;
    }
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

  onLocationUpdate(callback: (userId: string, location: any) => void) {
    this.onLocationReceived = callback;
  }

  onSignalingMessage(callback: (message: SignalingMessage, fromPeerId: string) => void) {
    this.onSignalingReceived = callback;
  }
}
