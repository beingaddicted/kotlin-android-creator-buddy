
import { WebRTCOffer, WebRTCAnswer, WebRTCMessage, PeerConnection } from './webrtc/types';
import { ConnectionManager } from './webrtc/ConnectionManager';

class WebRTCService {
  private localConnection: RTCPeerConnection | null = null;
  private connectionManager = new ConnectionManager();
  private isAdmin = false;
  private userId: string | null = null;
  private organizationId: string | null = null;
  private pendingIceCandidates: RTCIceCandidate[] = [];
  
  private rtcConfiguration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ]
  };

  async createOfferQR(organizationId: string, organizationName: string): Promise<WebRTCOffer> {
    this.isAdmin = true;
    this.organizationId = organizationId;
    this.userId = `admin-${organizationId}-${Date.now()}`;
    
    console.log('WebRTC: Creating offer QR for organization:', organizationId);
    
    const connection = new RTCPeerConnection(this.rtcConfiguration);
    this.localConnection = connection;
    
    connection.ondatachannel = (event) => {
      this.connectionManager.setupDataChannel(event.channel, 'client', this.isAdmin);
    };

    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.pendingIceCandidates.push(event.candidate);
        console.log('ICE candidate generated, total:', this.pendingIceCandidates.length);
      }
    };

    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);

    return {
      type: 'webrtc_offer',
      offer,
      adminId: this.userId,
      organizationId,
      organizationName,
      timestamp: Date.now()
    };
  }

  async processOfferAndCreateAnswer(offerData: WebRTCOffer, userId: string, userName: string): Promise<WebRTCAnswer> {
    this.isAdmin = false;
    this.userId = userId;
    this.organizationId = offerData.organizationId;
    
    console.log('WebRTC: Processing offer and creating answer');
    
    const connection = new RTCPeerConnection(this.rtcConfiguration);
    this.localConnection = connection;
    
    const dataChannel = connection.createDataChannel('location', {
      ordered: true
    });
    
    this.connectionManager.setupDataChannel(dataChannel, 'admin', this.isAdmin);
    
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.pendingIceCandidates.push(event.candidate);
        console.log('ICE candidate generated, total:', this.pendingIceCandidates.length);
      }
    };

    await connection.setRemoteDescription(offerData.offer);
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);

    return {
      type: 'webrtc_answer',
      answer,
      userId,
      userName,
      organizationId: offerData.organizationId,
      timestamp: Date.now()
    };
  }

  async processAnswer(answerData: WebRTCAnswer): Promise<void> {
    if (!this.localConnection || !this.isAdmin) {
      throw new Error('No active connection or not admin');
    }

    console.log('WebRTC: Processing answer from:', answerData.userId);
    
    await this.localConnection.setRemoteDescription(answerData.answer);
    
    for (const candidate of this.pendingIceCandidates) {
      try {
        await this.localConnection.addIceCandidate(candidate);
      } catch (error) {
        console.warn('Failed to add ICE candidate:', error);
      }
    }
    this.pendingIceCandidates = [];

    this.connectionManager.addPeer({
      id: answerData.userId,
      name: answerData.userName,
      organizationId: answerData.organizationId,
      connection: this.localConnection,
      status: 'connecting',
      lastSeen: Date.now()
    });
  }

  sendLocationUpdate(locationData: any) {
    if (!this.isAdmin && this.localConnection) {
      const message: WebRTCMessage = {
        type: 'location',
        data: locationData,
        userId: this.userId!,
        organizationId: this.organizationId!,
        timestamp: Date.now()
      };

      const peer = this.connectionManager.getAllPeers()[0];
      if (peer?.dataChannel && peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(JSON.stringify(message));
        console.log('WebRTC: Location update sent');
      }
    }
  }

  onLocationUpdate(callback: (userId: string, location: any) => void) {
    this.connectionManager.onLocationUpdate(callback);
  }

  onPeerStatusUpdate(callback: (peers: PeerConnection[]) => void) {
    this.connectionManager.onPeerStatusUpdate(callback);
  }

  getConnectedPeers(): PeerConnection[] {
    return this.connectionManager.getConnectedPeers();
  }

  getConnectionStatus(): 'disconnected' | 'connecting' | 'connected' {
    if (!this.localConnection) return 'disconnected';
    
    if (this.localConnection.connectionState === 'connected') return 'connected';
    if (this.localConnection.connectionState === 'connecting') return 'connecting';
    
    return 'disconnected';
  }

  disconnect() {
    if (this.localConnection) {
      this.localConnection.close();
      this.localConnection = null;
    }

    this.connectionManager.clearPeers();
    this.pendingIceCandidates = [];
  }
}

export const webRTCService = new WebRTCService();
export type { WebRTCOffer, WebRTCAnswer, PeerConnection, WebRTCMessage };
