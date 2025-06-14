
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

class WebRTCService {
  private localConnection: RTCPeerConnection | null = null;
  private peers: Map<string, PeerConnection> = new Map();
  private isAdmin = false;
  private userId: string | null = null;
  private organizationId: string | null = null;
  private onLocationReceived?: (userId: string, location: any) => void;
  private onPeerStatusChanged?: (peers: PeerConnection[]) => void;
  
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

  async initializeAsAdmin(organizationId: string) {
    this.isAdmin = true;
    this.organizationId = organizationId;
    this.userId = `admin-${organizationId}-${Date.now()}`;
    
    console.log('WebRTC: Initializing as admin for organization:', organizationId);
    
    // Admin listens for connections
    this.setupSignalingListener();
  }

  async initializeAsClient(userId: string, organizationId: string) {
    this.isAdmin = false;
    this.userId = userId;
    this.organizationId = organizationId;
    
    console.log('WebRTC: Initializing as client:', userId, 'for org:', organizationId);
    
    // Client connects to admin
    await this.connectToAdmin();
  }

  private setupSignalingListener() {
    // In a real implementation, this would listen to a signaling server
    // For now, we'll use localStorage as a simple signaling mechanism
    window.addEventListener('storage', (event) => {
      if (event.key === `webrtc-signal-${this.organizationId}`) {
        const signal = JSON.parse(event.newValue || '{}');
        this.handleSignal(signal);
      }
    });
  }

  private async connectToAdmin() {
    const connection = new RTCPeerConnection(this.rtcConfiguration);
    
    // Create data channel for location sharing
    const dataChannel = connection.createDataChannel('location', {
      ordered: true
    });
    
    this.setupDataChannel(dataChannel, 'admin');
    
    // Setup ICE candidate handling
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          type: 'ice-candidate',
          data: event.candidate,
          userId: this.userId!,
          organizationId: this.organizationId!,
          timestamp: Date.now()
        });
      }
    };

    // Create offer
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    
    // Send offer through signaling
    this.sendSignal({
      type: 'offer',
      data: offer,
      userId: this.userId!,
      organizationId: this.organizationId!,
      timestamp: Date.now()
    });

    this.localConnection = connection;
  }

  private async handleSignal(signal: WebRTCMessage) {
    console.log('WebRTC: Received signal:', signal.type, 'from:', signal.userId);

    if (this.isAdmin && signal.type === 'offer') {
      await this.handleOffer(signal);
    } else if (!this.isAdmin && signal.type === 'answer') {
      await this.handleAnswer(signal);
    } else if (signal.type === 'ice-candidate') {
      await this.handleIceCandidate(signal);
    }
  }

  private async handleOffer(signal: WebRTCMessage) {
    const connection = new RTCPeerConnection(this.rtcConfiguration);
    const userId = signal.userId!;
    
    // Setup data channel for incoming connections
    connection.ondatachannel = (event) => {
      this.setupDataChannel(event.channel, userId);
    };

    // Setup ICE candidate handling
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          type: 'ice-candidate',
          data: event.candidate,
          userId: this.userId!,
          organizationId: this.organizationId!,
          timestamp: Date.now()
        });
      }
    };

    // Set remote description and create answer
    await connection.setRemoteDescription(signal.data);
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);

    // Send answer
    this.sendSignal({
      type: 'answer',
      data: answer,
      userId: this.userId!,
      organizationId: this.organizationId!,
      timestamp: Date.now()
    });

    // Store peer connection
    this.peers.set(userId, {
      id: userId,
      name: `User ${userId.slice(-4)}`,
      organizationId: this.organizationId!,
      connection,
      status: 'connecting',
      lastSeen: Date.now()
    });

    this.notifyPeerStatusChanged();
  }

  private async handleAnswer(signal: WebRTCMessage) {
    if (this.localConnection) {
      await this.localConnection.setRemoteDescription(signal.data);
    }
  }

  private async handleIceCandidate(signal: WebRTCMessage) {
    const connection = this.isAdmin ? 
      this.peers.get(signal.userId!)?.connection : 
      this.localConnection;
    
    if (connection) {
      await connection.addIceCandidate(signal.data);
    }
  }

  private setupDataChannel(dataChannel: RTCDataChannel, peerId: string) {
    dataChannel.onopen = () => {
      console.log('WebRTC: Data channel opened with', peerId);
      
      if (this.peers.has(peerId)) {
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
      
      if (this.peers.has(peerId)) {
        const peer = this.peers.get(peerId)!;
        peer.status = 'disconnected';
        this.peers.set(peerId, peer);
        this.notifyPeerStatusChanged();
      }
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

  private sendSignal(signal: WebRTCMessage) {
    // Simple localStorage-based signaling (replace with real signaling server in production)
    const key = `webrtc-signal-${this.organizationId}`;
    localStorage.setItem(key, JSON.stringify(signal));
    
    // Clear after a short delay to prevent conflicts
    setTimeout(() => {
      localStorage.removeItem(key);
    }, 1000);
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

      // Send through data channel if available
      const dataChannel = this.localConnection.ondatachannel ? 
        null : this.localConnection.getTransceivers().find(t => t.sender.track)?.sender.transport;
      
      // Fallback: send through any available channel
      if (this.localConnection.connectionState === 'connected') {
        console.log('WebRTC: Sending location update');
        // In a real implementation, you'd send through the established data channel
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

  disconnect() {
    if (this.localConnection) {
      this.localConnection.close();
      this.localConnection = null;
    }

    this.peers.forEach(peer => {
      peer.connection.close();
    });

    this.peers.clear();
    this.notifyPeerStatusChanged();
  }
}

export const webRTCService = new WebRTCService();
