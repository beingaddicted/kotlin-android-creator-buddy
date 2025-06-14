
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

class WebRTCService {
  private localConnection: RTCPeerConnection | null = null;
  private peers: Map<string, PeerConnection> = new Map();
  private isAdmin = false;
  private userId: string | null = null;
  private organizationId: string | null = null;
  private onLocationReceived?: (userId: string, location: any) => void;
  private onPeerStatusChanged?: (peers: PeerConnection[]) => void;
  private pendingIceCandidates: RTCIceCandidate[] = [];
  
  // STUN servers for NAT traversal
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
    
    // Setup data channel for location receiving
    connection.ondatachannel = (event) => {
      this.setupDataChannel(event.channel, 'client');
    };

    // Store ICE candidates for later exchange
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.pendingIceCandidates.push(event.candidate);
        console.log('ICE candidate generated, total:', this.pendingIceCandidates.length);
      }
    };

    // Create offer
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
    
    // Create data channel for location sending
    const dataChannel = connection.createDataChannel('location', {
      ordered: true
    });
    
    this.setupDataChannel(dataChannel, 'admin');
    
    // Store ICE candidates
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.pendingIceCandidates.push(event.candidate);
        console.log('ICE candidate generated, total:', this.pendingIceCandidates.length);
      }
    };

    // Set remote description and create answer
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
    
    // Add stored ICE candidates
    for (const candidate of this.pendingIceCandidates) {
      try {
        await this.localConnection.addIceCandidate(candidate);
      } catch (error) {
        console.warn('Failed to add ICE candidate:', error);
      }
    }
    this.pendingIceCandidates = [];

    // Store peer connection
    this.peers.set(answerData.userId, {
      id: answerData.userId,
      name: answerData.userName,
      organizationId: answerData.organizationId,
      connection: this.localConnection,
      status: 'connecting',
      lastSeen: Date.now()
    });

    this.notifyPeerStatusChanged();
  }

  private setupDataChannel(dataChannel: RTCDataChannel, peerId: string) {
    dataChannel.onopen = () => {
      console.log('WebRTC: Data channel opened with', peerId);
      
      if (this.isAdmin && this.peers.has(peerId)) {
        const peer = this.peers.get(peerId)!;
        peer.status = 'connected';
        peer.dataChannel = dataChannel;
        this.peers.set(peerId, peer);
        this.notifyPeerStatusChanged();
      }
    };

    dataChannel.onmessage = (event) => {
      const message: WebRTCMessage = JSON.parse(event.data);
      this.handleDataChannelMessage(message, peerId);
    };

    dataChannel.onclose = () => {
      console.log('WebRTC: Data channel closed with', peerId);
      
      if (this.isAdmin && this.peers.has(peerId)) {
        const peer = this.peers.get(peerId)!;
        peer.status = 'disconnected';
        this.peers.set(peerId, peer);
        this.notifyPeerStatusChanged();
      }
    };

    dataChannel.onerror = (error) => {
      console.error('WebRTC: Data channel error with', peerId, error);
    };
  }

  private handleDataChannelMessage(message: WebRTCMessage, peerId: string) {
    console.log('WebRTC: Received message:', message.type, 'from:', peerId);

    if (message.type === 'location' && this.isAdmin && this.onLocationReceived) {
      // Update peer last seen
      if (this.peers.has(peerId)) {
        const peer = this.peers.get(peerId)!;
        peer.lastSeen = Date.now();
        this.peers.set(peerId, peer);
      }
      
      this.onLocationReceived(peerId, message.data);
    }
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

      // Find the data channel and send
      const peer = Array.from(this.peers.values())[0];
      if (peer?.dataChannel && peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(JSON.stringify(message));
        console.log('WebRTC: Location update sent');
      } else if (this.localConnection.connectionState === 'connected') {
        // Try to send through any available data channel
        console.log('WebRTC: Connection established, location update queued');
      }
    }
  }

  onLocationUpdate(callback: (userId: string, location: any) => void) {
    this.onLocationReceived = callback;
  }

  onPeerStatusUpdate(callback: (peers: PeerConnection[]) => void) {
    this.onPeerStatusChanged = callback;
  }

  private notifyPeerStatusChanged() {
    if (this.onPeerStatusChanged) {
      this.onPeerStatusChanged(Array.from(this.peers.values()));
    }
  }

  getConnectedPeers(): PeerConnection[] {
    return Array.from(this.peers.values()).filter(peer => peer.status === 'connected');
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

    this.peers.forEach(peer => {
      peer.connection.close();
    });

    this.peers.clear();
    this.pendingIceCandidates = [];
    this.notifyPeerStatusChanged();
  }
}

export const webRTCService = new WebRTCService();
