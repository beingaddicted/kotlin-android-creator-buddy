
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
    try {
      const message = JSON.parse(event.data);
      
      // Handle security messages first
      if (SecurityMessageHandler.isSecurityMessage(message)) {
        await SecurityMessageHandler.handleSecurityMessage(message, peerId);
        return;
      }

      // Update peer last seen
      this.peerManager.updatePeerLastSeen(peerId);

      // Route based on message type
      switch (message.type) {
        case 'location_update':
          this.handleLocationUpdate(message, peerId);
          break;
        case 'location_request':
          this.handleLocationRequest(peerId);
          break;
        case 'signaling':
          this.handleSignalingMessage(message, peerId);
          break;
        case 'mesh_data':
          this.handleMeshData(message, peerId);
          break;
        default:
          this.handleGenericMessage(message, peerId);
      }
    } catch (error) {
      console.error('Failed to route message:', error);
    }
  }

  private handleLocationUpdate(message: any, peerId: string) {
    if (this.onLocationReceived && message.data) {
      this.onLocationReceived(peerId, message.data);
    }
  }

  private async handleLocationRequest(peerId: string) {
    if (!this.isServer) {
      try {
        const location = await this.getCurrentLocation();
        if (location) {
          const peer = this.peerManager.getPeer(peerId);
          if (peer?.dataChannel && peer.dataChannel.readyState === 'open') {
            peer.dataChannel.send(JSON.stringify({
              type: 'location_update',
              data: location,
              timestamp: Date.now()
            }));
          }
        }
      } catch (error) {
        console.error('Failed to handle location request:', error);
      }
    }
  }

  private handleSignalingMessage(message: any, peerId: string) {
    console.log('Signaling message received:', message, 'from:', peerId);
  }

  private handleMeshData(message: any, peerId: string) {
    console.log('Mesh data received:', message, 'from:', peerId);
  }

  private handleGenericMessage(message: any, peerId: string) {
    if (this.onMessageReceived) {
      const webrtcMessage: WebRTCMessage = {
        type: message.type,
        data: message.data,
        timestamp: message.timestamp || Date.now(),
        fromUserId: peerId
      };
      this.onMessageReceived(webrtcMessage, peerId);
    }
  }

  private async getCurrentLocation(): Promise<any> {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000
        });
      });

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Failed to get current location:', error);
      return null;
    }
  }

  onLocationUpdate(callback: (userId: string, location: any) => void) {
    this.onLocationReceived = callback;
  }

  onMessage(callback: (message: WebRTCMessage, fromPeerId: string) => void) {
    this.onMessageReceived = callback;
  }
}
