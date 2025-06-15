
export interface WebRTCMessage {
  type: 'location' | 'join-org' | 'member-status' | 'location-request' | 'mesh-data' | 'auth-challenge' | 'auth-response' | 'secure-message';
  data: any;
  userId?: string;
  organizationId?: string;
  timestamp: number;
  // Security fields
  encrypted?: boolean;
  signature?: string;
  senderDeviceId?: string;
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
  // Security fields
  isAuthenticated?: boolean;
  accessToken?: string;
  lastAuthCheck?: number;
}

export interface WebRTCServerOffer {
  type: 'webrtc_server_offer';
  offer: RTCSessionDescriptionInit;
  adminId: string;
  organizationId: string;
  organizationName: string;
  timestamp: number;
  serverIp?: string;
  // Security fields
  requiresAuth?: boolean;
  adminCertificate?: string;
  networkToken?: string;
}
