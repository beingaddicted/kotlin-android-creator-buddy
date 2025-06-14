
import { PeerConnection, WebRTCMessage } from './types';

export class ConnectionManager {
  private peers = new Map<string, PeerConnection>();
  private onLocationReceived?: (userId: string, location: any) => void;
  private onPeerStatusChanged?: (peers: PeerConnection[]) => void;

  setupDataChannel(dataChannel: RTCDataChannel, peerId: string, isAdmin: boolean) {
    dataChannel.onopen = () => {
      console.log('WebRTC: Data channel opened with', peerId);
      
      if (isAdmin && this.peers.has(peerId)) {
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
      
      if (isAdmin && this.peers.has(peerId)) {
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

    if (message.type === 'location' && this.onLocationReceived) {
      if (this.peers.has(peerId)) {
        const peer = this.peers.get(peerId)!;
        peer.lastSeen = Date.now();
        this.peers.set(peerId, peer);
      }
      
      this.onLocationReceived(peerId, message.data);
    }
  }

  addPeer(peer: PeerConnection) {
    this.peers.set(peer.id, peer);
    this.notifyPeerStatusChanged();
  }

  getPeer(peerId: string): PeerConnection | undefined {
    return this.peers.get(peerId);
  }

  getConnectedPeers(): PeerConnection[] {
    return Array.from(this.peers.values()).filter(peer => peer.status === 'connected');
  }

  getAllPeers(): PeerConnection[] {
    return Array.from(this.peers.values());
  }

  clearPeers() {
    this.peers.forEach(peer => {
      peer.connection.close();
    });
    this.peers.clear();
    this.notifyPeerStatusChanged();
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
}
