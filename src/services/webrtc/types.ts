
export interface WebRTCMessage {
  type: 'location' | 'offer' | 'answer' | 'ice-candidate' | 'join-org' | 'member-status';
  data: any;
  userId?: string;
  organizationId?: string;
  timestamp: number;
}

export interface PeerConnection {
  id: string;
  name: string;
  organizationId: string;
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  status: 'connecting' | 'connected' | 'disconnected';
  lastSeen: number;
}

export interface WebRTCOffer {
  type: 'webrtc_offer';
  offer: RTCSessionDescriptionInit;
  adminId: string;
  organizationId: string;
  organizationName: string;
  timestamp: number;
}

export interface WebRTCAnswer {
  type: 'webrtc_answer';
  answer: RTCSessionDescriptionInit;
  userId: string;
  userName: string;
  organizationId: string;
  timestamp: number;
}
