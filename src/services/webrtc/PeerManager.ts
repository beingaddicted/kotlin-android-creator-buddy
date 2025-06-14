
import { PeerConnection } from './types';

export class PeerManager {
  private peers = new Map<string, PeerConnection>();
  private onPeerStatusChanged?: (peers: PeerConnection[]) => void;

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

  updatePeerStatus(peerId: string, status: 'connecting' | 'connected' | 'disconnected'): void {
    if (this.peers.has(peerId)) {
      const peer = this.peers.get(peerId)!;
      peer.status = status;
      this.peers.set(peerId, peer);
      this.notifyPeerStatusChanged();
    }
  }

  updatePeerLastSeen(peerId: string): void {
    if (this.peers.has(peerId)) {
      const peer = this.peers.get(peerId)!;
      peer.lastSeen = Date.now();
      this.peers.set(peerId, peer);
    }
  }

  setPeerDataChannel(peerId: string, dataChannel: RTCDataChannel): void {
    if (this.peers.has(peerId)) {
      const peer = this.peers.get(peerId)!;
      peer.dataChannel = dataChannel;
      this.peers.set(peerId, peer);
    }
  }

  clearPeers() {
    this.peers.forEach(peer => {
      peer.connection.close();
    });
    this.peers.clear();
    this.notifyPeerStatusChanged();
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
