
import { PeerManager } from './PeerManager';

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'new-offer' | 'new-answer' | 'ip-change';
  data: any;
  fromPeerId: string;
  toPeerId?: string;
}

export class SignalingService {
  private dataChannels = new Map<string, RTCDataChannel>();
  private isServer = false;
  private signalingMessageHandler?: (message: SignalingMessage, fromPeerId: string) => void;

  setAsServer(isServer: boolean) {
    this.isServer = isServer;
  }

  registerDataChannel(peerId: string, dataChannel: RTCDataChannel) {
    this.dataChannels.set(peerId, dataChannel);
  }

  removeDataChannel(peerId: string) {
    this.dataChannels.delete(peerId);
  }

  clearDataChannels() {
    this.dataChannels.clear();
  }

  setSignalingMessageHandler(handler: (message: SignalingMessage, fromPeerId: string) => void) {
    this.signalingMessageHandler = handler;
  }

  sendNewOffer(peerId: string, offer: RTCSessionDescriptionInit) {
    this.sendSignalingMessage(peerId, {
      type: 'new-offer',
      data: offer,
      fromPeerId: 'server',
      toPeerId: peerId
    });
  }

  sendNewAnswer(adminId: string, answer: RTCSessionDescriptionInit) {
    this.sendSignalingMessage(adminId, {
      type: 'new-answer',
      data: answer,
      fromPeerId: 'client',
      toPeerId: adminId
    });
  }

  sendIceCandidate(peerId: string, candidate: RTCIceCandidate) {
    this.sendSignalingMessage(peerId, {
      type: 'ice-candidate',
      data: candidate,
      fromPeerId: this.isServer ? 'server' : 'client',
      toPeerId: peerId
    });
  }

  notifyIpChange(newIp: string) {
    const message: SignalingMessage = {
      type: 'ip-change',
      data: { newIp },
      fromPeerId: this.isServer ? 'server' : 'client'
    };

    this.dataChannels.forEach((dataChannel, peerId) => {
      if (dataChannel.readyState === 'open') {
        this.sendSignalingMessage(peerId, message);
      }
    });
  }

  private sendSignalingMessage(peerId: string, message: SignalingMessage) {
    const dataChannel = this.dataChannels.get(peerId);
    if (dataChannel && dataChannel.readyState === 'open') {
      try {
        dataChannel.send(JSON.stringify({
          type: 'signaling',
          data: message
        }));
      } catch (error) {
        console.error('Failed to send signaling message:', error);
      }
    }
  }
}
