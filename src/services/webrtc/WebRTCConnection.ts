
import { WebRTCServerOffer } from './types';

export class WebRTCConnection {
  private connection: RTCPeerConnection | null = null;
  private pendingIceCandidates: RTCIceCandidate[] = [];
  
  private rtcConfiguration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10
  };

  createConnection(): RTCPeerConnection {
    this.connection = new RTCPeerConnection(this.rtcConfiguration);
    return this.connection;
  }

  getConnection(): RTCPeerConnection | null {
    return this.connection;
  }

  async createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit> {
    if (!this.connection) throw new Error('No connection available');
    
    const offer = await this.connection.createOffer(options);
    await this.connection.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.connection) throw new Error('No connection available');
    
    const answer = await this.connection.createAnswer();
    await this.connection.setLocalDescription(answer);
    return answer;
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (!this.connection) throw new Error('No connection available');
    await this.connection.setRemoteDescription(description);
  }

  async addIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    if (!this.connection) throw new Error('No connection available');
    await this.connection.addIceCandidate(candidate);
  }

  addPendingIceCandidate(candidate: RTCIceCandidate): void {
    this.pendingIceCandidates.push(candidate);
  }

  async processPendingIceCandidates(): Promise<void> {
    if (!this.connection) return;
    
    for (const candidate of this.pendingIceCandidates) {
      try {
        await this.connection.addIceCandidate(candidate);
      } catch (error) {
        console.warn('Failed to add ICE candidate:', error);
      }
    }
    this.pendingIceCandidates = [];
  }

  createDataChannel(label: string, options?: RTCDataChannelInit): RTCDataChannel {
    if (!this.connection) throw new Error('No connection available');
    return this.connection.createDataChannel(label, options);
  }

  getConnectionState(): RTCPeerConnectionState {
    return this.connection?.connectionState || 'closed';
  }

  getIceConnectionState(): RTCIceConnectionState {
    return this.connection?.iceConnectionState || 'closed';
  }

  close(): void {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    this.pendingIceCandidates = [];
  }
}
