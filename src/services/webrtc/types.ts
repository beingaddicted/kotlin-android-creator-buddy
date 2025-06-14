
export interface WebRTCMessage {
  type: 'location' | 'join-org' | 'member-status' | 'location-request' | 'mesh-data';
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
  ipAddress?: string;
}

export interface WebRTCServerOffer {
  type: 'webrtc_server_offer';
  offer: RTCSessionDescriptionInit;
  adminId: string;
  organizationId: string;
  organizationName: string;
  timestamp: number;
  serverIp?: string;
}
