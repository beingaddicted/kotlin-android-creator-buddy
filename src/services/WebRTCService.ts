
export interface PeerConnection {
  id: string;
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  isAdmin: boolean;
}

export interface LocationRequest {
  type: 'location_request';
  requestId: string;
  fromUserId: string;
  timestamp: number;
}

export interface LocationResponse {
  type: 'location_response';
  requestId: string;
  userId: string;
  latitude: number;
  longitude: number;
  timestamp: number;
}

class WebRTCService {
  private peers: Map<string, PeerConnection> = new Map();
  private localId: string;
  private isAdmin: boolean;

  // STUN servers for NAT traversal
  private configuration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  };

  constructor(localId: string, isAdmin: boolean = false) {
    this.localId = localId;
    this.isAdmin = isAdmin;
  }

  async createOffer(targetUserId: string): Promise<string> {
    const peerConnection = new RTCPeerConnection(this.configuration);
    
    // Create data channel for communication
    const dataChannel = peerConnection.createDataChannel('locationData', {
      ordered: true,
    });

    this.setupDataChannel(dataChannel, targetUserId);

    const peer: PeerConnection = {
      id: targetUserId,
      connection: peerConnection,
      dataChannel,
      isAdmin: this.isAdmin,
    };

    this.peers.set(targetUserId, peer);

    // Create offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    return JSON.stringify(offer);
  }

  async handleOffer(offerString: string, fromUserId: string): Promise<string> {
    const offer = JSON.parse(offerString);
    const peerConnection = new RTCPeerConnection(this.configuration);

    // Handle incoming data channel
    peerConnection.ondatachannel = (event) => {
      const dataChannel = event.channel;
      this.setupDataChannel(dataChannel, fromUserId);
    };

    const peer: PeerConnection = {
      id: fromUserId,
      connection: peerConnection,
      isAdmin: false,
    };

    this.peers.set(fromUserId, peer);

    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    return JSON.stringify(answer);
  }

  async handleAnswer(answerString: string, fromUserId: string) {
    const answer = JSON.parse(answerString);
    const peer = this.peers.get(fromUserId);
    
    if (peer) {
      await peer.connection.setRemoteDescription(answer);
    }
  }

  async handleIceCandidate(candidateString: string, fromUserId: string) {
    const candidate = JSON.parse(candidateString);
    const peer = this.peers.get(fromUserId);
    
    if (peer) {
      await peer.connection.addIceCandidate(candidate);
    }
  }

  private setupDataChannel(dataChannel: RTCDataChannel, peerId: string) {
    dataChannel.onopen = () => {
      console.log(`Data channel opened with ${peerId}`);
    };

    dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleIncomingMessage(message, peerId);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };

    dataChannel.onerror = (error) => {
      console.error(`Data channel error with ${peerId}:`, error);
    };

    // Store the data channel reference
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.dataChannel = dataChannel;
    }
  }

  private handleIncomingMessage(message: any, fromUserId: string) {
    console.log('Received message from', fromUserId, ':', message);

    if (message.type === 'location_request' && !this.isAdmin) {
      // Respond with current location if we're a user
      this.sendLocationResponse(message.requestId, fromUserId);
    } else if (message.type === 'location_response' && this.isAdmin) {
      // Handle location response if we're an admin
      this.handleLocationResponse(message);
    }
  }

  async sendLocationRequest(targetUserId: string): Promise<void> {
    const peer = this.peers.get(targetUserId);
    if (!peer || !peer.dataChannel) {
      console.error('No connection to user:', targetUserId);
      return;
    }

    const request: LocationRequest = {
      type: 'location_request',
      requestId: Date.now().toString(),
      fromUserId: this.localId,
      timestamp: Date.now(),
    };

    peer.dataChannel.send(JSON.stringify(request));
  }

  private async sendLocationResponse(requestId: string, toUserId: string) {
    const peer = this.peers.get(toUserId);
    if (!peer || !peer.dataChannel) {
      return;
    }

    // Get current location (would integrate with LocationService)
    try {
      const { locationService } = await import('./LocationService');
      const location = await locationService.getCurrentLocation();
      
      if (location) {
        const response: LocationResponse = {
          type: 'location_response',
          requestId,
          userId: this.localId,
          latitude: location.latitude,
          longitude: location.longitude,
          timestamp: Date.now(),
        };

        peer.dataChannel.send(JSON.stringify(response));
      }
    } catch (error) {
      console.error('Failed to send location response:', error);
    }
  }

  private handleLocationResponse(response: LocationResponse) {
    // This would be handled by the admin dashboard
    console.log('Received location from user:', response);
    
    // Emit event for UI to handle
    window.dispatchEvent(new CustomEvent('locationReceived', { 
      detail: response 
    }));
  }

  sendLocationToAllMembers(location: { latitude: number; longitude: number }) {
    this.peers.forEach((peer, userId) => {
      if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
        const message = {
          type: 'admin_location_update',
          ...location,
          timestamp: Date.now(),
        };
        peer.dataChannel.send(JSON.stringify(message));
      }
    });
  }

  requestLocationFromAllMembers() {
    this.peers.forEach((peer, userId) => {
      this.sendLocationRequest(userId);
    });
  }

  getConnectedPeers(): string[] {
    return Array.from(this.peers.keys());
  }

  disconnectPeer(userId: string) {
    const peer = this.peers.get(userId);
    if (peer) {
      peer.connection.close();
      this.peers.delete(userId);
    }
  }

  disconnectAll() {
    this.peers.forEach((peer) => {
      peer.connection.close();
    });
    this.peers.clear();
  }
}

export { WebRTCService };
