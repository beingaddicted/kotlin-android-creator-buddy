import { WebRTCMessage, WebRTCServerOffer } from './types';

export interface SignalingMessage {
  type: 'new-offer' | 'new-answer' | 'ice-candidate' | 'ip-changed' | 'mesh-message';
  data: any;
  fromId: string;
  toId?: string; // If not specified, broadcast to all
  timestamp: number;
}

export class SignalingService {
  private dataChannels = new Map<string, RTCDataChannel>();
  private signalingMessageHandler?: (message: SignalingMessage, fromPeerId: string) => void;
  private isServer: boolean = false;

  setAsServer(isServer: boolean) {
    this.isServer = isServer;
  }

  // Register a data channel for signaling
  registerDataChannel(peerId: string, dataChannel: RTCDataChannel) {
    this.dataChannels.set(peerId, dataChannel);
    
    dataChannel.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        if (this.isSignalingMessage(message)) {
          console.log('Received signaling message:', message.type, 'from:', peerId);
          this.handleSignalingMessage(message, peerId);
        }
      } catch (error) {
        console.error('Failed to parse signaling message:', error);
      }
    });
  }

  // Send new offer to specific peer (admin to client)
  sendNewOffer(peerId: string, offer: WebRTCServerOffer) {
    const message: SignalingMessage = {
      type: 'new-offer',
      data: offer,
      fromId: this.isServer ? 'admin' : 'client',
      toId: peerId,
      timestamp: Date.now()
    };
    
    this.sendSignalingMessage(peerId, message);
  }

  // Send new answer to admin (client to admin)
  sendNewAnswer(adminId: string, answer: RTCSessionDescriptionInit) {
    const message: SignalingMessage = {
      type: 'new-answer',
      data: answer,
      fromId: 'client',
      toId: adminId,
      timestamp: Date.now()
    };
    
    this.sendSignalingMessage(adminId, message);
  }

  // Send ICE candidate to peer
  sendIceCandidate(peerId: string, candidate: RTCIceCandidate) {
    const message: SignalingMessage = {
      type: 'ice-candidate',
      data: candidate,
      fromId: this.isServer ? 'admin' : 'client',
      toId: peerId,
      timestamp: Date.now()
    };
    
    this.sendSignalingMessage(peerId, message);
  }

  // Notify about IP change
  notifyIpChange(newIp: string) {
    const message: SignalingMessage = {
      type: 'ip-changed',
      data: { newIp },
      fromId: this.isServer ? 'admin' : 'client',
      timestamp: Date.now()
    };
    
    // Broadcast to all connected peers
    this.broadcastSignalingMessage(message);
  }

  // Send mesh message to specific peer
  sendMeshMessage(peerId: string, meshData: any) {
    const message: SignalingMessage = {
      type: 'mesh-message',
      data: meshData,
      fromId: this.isServer ? 'admin' : 'client',
      toId: peerId,
      timestamp: Date.now()
    };
    
    this.sendSignalingMessage(peerId, message);
  }

  // Broadcast mesh message to all peers
  broadcastMeshMessage(meshData: any) {
    const message: SignalingMessage = {
      type: 'mesh-message',
      data: meshData,
      fromId: this.isServer ? 'admin' : 'client',
      timestamp: Date.now()
    };
    
    this.broadcastSignalingMessage(message);
  }

  private sendSignalingMessage(peerId: string, message: SignalingMessage) {
    const dataChannel = this.dataChannels.get(peerId);
    if (dataChannel && dataChannel.readyState === 'open') {
      try {
        dataChannel.send(JSON.stringify(message));
        console.log('Sent signaling message:', message.type, 'to:', peerId);
      } catch (error) {
        console.error('Failed to send signaling message:', error);
      }
    } else {
      console.warn('Cannot send signaling message - data channel not available for peer:', peerId);
    }
  }

  private broadcastSignalingMessage(message: SignalingMessage) {
    this.dataChannels.forEach((dataChannel, peerId) => {
      if (dataChannel.readyState === 'open') {
        try {
          dataChannel.send(JSON.stringify(message));
          console.log('Broadcasted signaling message:', message.type, 'to:', peerId);
        } catch (error) {
          console.error('Failed to broadcast signaling message to', peerId, error);
        }
      }
    });
  }

  private handleSignalingMessage(message: SignalingMessage, fromPeerId: string) {
    if (this.signalingMessageHandler) {
      this.signalingMessageHandler(message, fromPeerId);
    }
  }

  private isSignalingMessage(data: any): data is SignalingMessage {
    return data && 
           typeof data === 'object' &&
           ['new-offer', 'new-answer', 'ice-candidate', 'ip-changed', 'mesh-message'].includes(data.type) &&
           data.fromId &&
           typeof data.timestamp === 'number';
  }

  setSignalingMessageHandler(callback: (message: SignalingMessage, fromPeerId: string) => void) {
    this.signalingMessageHandler = callback;
  }

  removeDataChannel(peerId: string) {
    this.dataChannels.delete(peerId);
  }

  clearDataChannels() {
    this.dataChannels.clear();
  }
}
