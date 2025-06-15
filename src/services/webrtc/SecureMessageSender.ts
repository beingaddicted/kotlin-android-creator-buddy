
import { PeerManager } from './PeerManager';

export class SecureMessageSender {
  private peerManager: PeerManager;

  constructor(peerManager: PeerManager) {
    this.peerManager = peerManager;
  }

  sendMessage(peerId: string, data: any, messageType: string) {
    const peer = this.peerManager.getPeer(peerId);
    if (peer?.dataChannel && peer.dataChannel.readyState === 'open') {
      try {
        peer.dataChannel.send(JSON.stringify({
          type: messageType,
          data: data,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    }
  }

  async sendSecureMessage(peerId: string, message: any, messageType: string): Promise<void> {
    // For now, just send regular message - can be enhanced with encryption later
    this.sendMessage(peerId, message, messageType);
  }

  requestLocationUpdate(peerId: string) {
    this.sendMessage(peerId, {}, 'location_request');
  }

  sendMeshData(peerId: string, meshData: any) {
    this.sendMessage(peerId, meshData, 'mesh_data');
  }
}
