
import { WebRTCMessage } from './types';
import { SignalingService } from './SignalingService';
import { PeerManager } from './PeerManager';
import { MessageRouter } from './MessageRouter';
import { SecureMessageSender } from './SecureMessageSender';

export class DataChannelManager {
  private peerManager: PeerManager;
  private signalingService: SignalingService;
  private messageRouter: MessageRouter;
  private messageSender: SecureMessageSender;
  private isServer: boolean = false;

  constructor(peerManager: PeerManager, signalingService: SignalingService) {
    this.peerManager = peerManager;
    this.signalingService = signalingService;
    this.messageRouter = new MessageRouter(peerManager);
    this.messageSender = new SecureMessageSender(peerManager);
  }

  setAsServer(isServer: boolean) {
    this.isServer = isServer;
    this.messageRouter.setAsServer(isServer);
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
        this.messageSender.requestLocationUpdate(peerId);
      }
    };

    dataChannel.onmessage = async (event) => {
      await this.messageRouter.routeMessage(event, peerId);
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

  // Server method to request location from specific client
  requestLocationUpdate(peerId: string) {
    if (!this.isServer) return;
    this.messageSender.requestLocationUpdate(peerId);
  }

  sendMeshData(peerId: string, meshData: any): void {
    this.messageSender.sendMeshData(peerId, meshData);
  }

  public send(peerId: string, data: { type: string; data: any }): void {
    this.messageSender.sendMessage(peerId, data.data, data.type);
  }

  async sendSecureMessage(peerId: string, message: any, messageType: string): Promise<void> {
    await this.messageSender.sendSecureMessage(peerId, message, messageType);
  }

  onLocationUpdate(callback: (userId: string, location: any) => void) {
    this.messageRouter.onLocationUpdate(callback);
  }

  onMessage(callback: (message: WebRTCMessage, fromPeerId: string) => void) {
    this.messageRouter.onMessage(callback);
  }

  onSignalingMessage(callback: (message: any, fromPeerId: string) => void) {
    // This method exists for backward compatibility
    // Signaling messages are now handled by the SignalingService directly
  }
}
