
export class WebRTCConnection {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private connectionState: RTCPeerConnectionState = 'new';
  private onConnectionStateChange?: (state: RTCPeerConnectionState) => void;

  constructor() {
    this.setupPeerConnection();
  }

  private setupPeerConnection(): void {
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    this.peerConnection = new RTCPeerConnection(config);
    
    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection) {
        this.connectionState = this.peerConnection.connectionState;
        this.onConnectionStateChange?.(this.connectionState);
      }
    };
  }

  getConnectionState(): RTCPeerConnectionState {
    return this.connectionState;
  }

  onStateChange(callback: (state: RTCPeerConnectionState) => void): void {
    this.onConnectionStateChange = callback;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error('Peer connection not available');
    
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error('Peer connection not available');
    
    await this.peerConnection.setRemoteDescription(offer);
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) throw new Error('Peer connection not available');
    await this.peerConnection.setRemoteDescription(description);
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) throw new Error('Peer connection not available');
    await this.peerConnection.addIceCandidate(candidate);
  }

  async testConnectivity(): Promise<boolean> {
    try {
      // Simple connectivity test
      return this.peerConnection?.connectionState !== 'failed';
    } catch (error) {
      console.error('Connectivity test failed:', error);
      return false;
    }
  }

  close(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    this.connectionState = 'closed';
  }

  getPeerConnection(): RTCPeerConnection | null {
    return this.peerConnection;
  }
}
