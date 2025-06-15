
export interface WebRTCServerOffer {
  type: 'webrtc_server_offer';
  offer: RTCSessionDescriptionInit;
  adminId: string;
  organizationId: string;
  organizationName: string;
  timestamp: number;
  serverIp: string;
}

export interface PeerConnection {
  id: string;
  name: string;
  organizationId?: string;
  connection: RTCPeerConnection;
  status: 'connecting' | 'connected' | 'disconnected';
  lastSeen: number;
  dataChannel?: RTCDataChannel;
}

export interface WebRTCMessage {
  type: string;
  data: any;
  timestamp: number;
  fromUserId: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

export interface SignalingData {
  type: 'offer' | 'answer' | 'ice-candidate' | 'new-offer' | 'new-answer' | 'ip-change';
  data: any;
  fromPeerId: string;
  toPeerId?: string;
}
