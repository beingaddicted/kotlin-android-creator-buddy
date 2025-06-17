import { PeerManager } from './PeerManager';

// Define payload types for each message
export interface OfferPayload { sdp: RTCSessionDescriptionInit; }
export interface AnswerPayload { sdp: RTCSessionDescriptionInit; }
export interface IceCandidatePayload { candidate: RTCIceCandidateInit; }
export interface NewOfferPayload { offer: RTCSessionDescriptionInit; }
export interface NewAnswerPayload { answer: RTCSessionDescriptionInit; }
export interface IpChangePayload { newIp: string; }
export interface JoinRequestPayload { userData: Record<string, unknown>; qrData: Record<string, unknown>; }
export interface JoinResponsePayload { status: string; reason?: string; }

export type SignalingMessage =
  | { type: 'offer'; data: OfferPayload; fromPeerId: string; toPeerId?: string }
  | { type: 'answer'; data: AnswerPayload; fromPeerId: string; toPeerId?: string }
  | { type: 'ice-candidate'; data: IceCandidatePayload; fromPeerId: string; toPeerId?: string }
  | { type: 'new-offer'; data: NewOfferPayload; fromPeerId: string; toPeerId?: string }
  | { type: 'new-answer'; data: NewAnswerPayload; fromPeerId: string; toPeerId?: string }
  | { type: 'ip-change'; data: IpChangePayload; fromPeerId: string; toPeerId?: string }
  | { type: 'join_request'; data: JoinRequestPayload; fromPeerId: string; toPeerId?: string }
  | { type: 'join_response'; data: JoinResponsePayload; fromPeerId: string; toPeerId?: string };

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
      data: { offer },
      fromPeerId: 'server',
      toPeerId: peerId
    });
  }

  sendNewAnswer(adminId: string, answer: RTCSessionDescriptionInit) {
    this.sendSignalingMessage(adminId, {
      type: 'new-answer',
      data: { answer },
      fromPeerId: 'client',
      toPeerId: adminId
    });
  }

  sendIceCandidate(peerId: string, candidate: RTCIceCandidate) {
    this.sendSignalingMessage(peerId, {
      type: 'ice-candidate',
      data: { candidate: candidate.toJSON() },
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

// WebSocket signaling integration
let ws: WebSocket | null = null;

function cleanupOldWebSocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    ws.close();
    ws = null;
    console.log('[SIGNALING] Closed old WebSocket connection to prevent resource leaks.');
  }
}

export function connectToSignalingServer(url: string, onMessage: (msg: SignalingMessage) => void, peerId?: string): () => void {
  cleanupOldWebSocket();
  ws = new WebSocket(url);
  ws.onopen = () => {
    if (peerId) {
      ws!.send(JSON.stringify({ type: 'register', peerId }));
      console.log('[SIGNALING] Sent register message for peerId:', peerId);
    }
  };
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      onMessage(msg);
    } catch (e) {
      console.error('Failed to parse signaling message:', e);
    }
  };
  ws.onerror = (err) => {
    console.error('[SIGNALING] WebSocket error:', err);
  };
  ws.onclose = () => {
    console.log('[SIGNALING] WebSocket closed.');
  };
  // Return cleanup function to close ws
  return () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
      ws = null;
    }
  };
}

export function sendSignalingViaWebSocket(msg: SignalingMessage) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}
