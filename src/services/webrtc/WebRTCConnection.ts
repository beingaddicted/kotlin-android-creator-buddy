
export class WebRTCConnection {
  private connection: RTCPeerConnection | null = null;
  private pendingIceCandidates: RTCIceCandidate[] = [];
  private isRemoteDescriptionSet = false;

  createConnection(): RTCPeerConnection {
    this.connection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    return this.connection;
  }

  getConnection(): RTCPeerConnection | null {
    return this.connection;
  }

  async createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit> {
    if (!this.connection) throw new Error('No connection established');
    
    const offer = await this.connection.createOffer(options);
    await this.connection.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.connection) throw new Error('No connection established');
    
    const answer = await this.connection.createAnswer();
    await this.connection.setLocalDescription(answer);
    return answer;
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (!this.connection) throw new Error('No connection established');
    
    await this.connection.setRemoteDescription(description);
    this.isRemoteDescriptionSet = true;
    await this.processPendingIceCandidates();
  }

  async addIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    if (!this.connection) throw new Error('No connection established');
    
    if (this.isRemoteDescriptionSet) {
      await this.connection.addIceCandidate(candidate);
    } else {
      this.pendingIceCandidates.push(candidate);
    }
  }

  async processPendingIceCandidates(): Promise<void> {
    if (!this.connection || !this.isRemoteDescriptionSet) return;
    
    for (const candidate of this.pendingIceCandidates) {
      await this.connection.addIceCandidate(candidate);
    }
    this.pendingIceCandidates = [];
  }

  getConnectionState(): RTCPeerConnectionState {
    return this.connection?.connectionState || 'closed';
  }

  close(): void {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    this.pendingIceCandidates = [];
    this.isRemoteDescriptionSet = false;
  }
}
