
import { WebRTCMessage } from './types';
import { PeerManager } from './PeerManager';

export class SecureMessageSender {
  private peerManager: PeerManager;

  constructor(peerManager: PeerManager) {
    this.peerManager = peerManager;
  }

  async sendSecureMessage(peerId: string, message: any, messageType: string): Promise<void> {
    if (!window.securityManager) {
      this.sendMessage(peerId, message, messageType);
      return;
    }

    const encryptedMessage = await window.securityManager.encryptMessage(message, peerId, messageType);
    if (encryptedMessage) {
      this.sendRawMessage(peerId, encryptedMessage);
    } else {
      console.warn('SecureMessageSender: Failed to encrypt message, sending unencrypted');
      this.sendMessage(peerId, message, messageType);
    }
  }

  sendMessage(peerId: string, data: any, type: string): void {
    const peer = this.peerManager.getPeer(peerId);
    if (peer?.dataChannel && peer.dataChannel.readyState === 'open') {
      const message: WebRTCMessage = {
        type: type as any,
        data: data,
        timestamp: Date.now()
      };
      
      try {
        peer.dataChannel.send(JSON.stringify(message));
        console.log('SecureMessageSender: Sent message to', peerId);
      } catch (error) {
        console.error('SecureMessageSender: Failed to send message:', error);
      }
    }
  }

  sendRawMessage(peerId: string, message: WebRTCMessage): void {
    const peer = this.peerManager.getPeer(peerId);
    if (peer?.dataChannel && peer.dataChannel.readyState === 'open') {
      try {
        peer.dataChannel.send(JSON.stringify(message));
        console.log('SecureMessageSender: Sent raw message to', peerId);
      } catch (error) {
        console.error('SecureMessageSender: Failed to send raw message:', error);
      }
    }
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
        console.log('SecureMessageSender: Sent mesh data to', peerId);
      } catch (error) {
        console.error('SecureMessageSender: Failed to send mesh data:', error);
      }
    }
  }

  requestLocationUpdate(peerId: string): void {
    const peer = this.peerManager.getPeer(peerId);
    if (peer?.dataChannel && peer.dataChannel.readyState === 'open') {
      const message: WebRTCMessage = {
        type: 'location-request',
        data: {},
        timestamp: Date.now()
      };
      
      try {
        peer.dataChannel.send(JSON.stringify(message));
        console.log('SecureMessageSender: Location request sent to', peerId);
      } catch (error) {
        console.error('SecureMessageSender: Failed to send location request:', error);
      }
    }
  }
}
