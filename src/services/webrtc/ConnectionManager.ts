
import { PeerConnection, WebRTCMessage } from './types';

export class ConnectionManager {
  private peers = new Map<string, PeerConnection>();
  private onLocationUpdateCallback?: (userId: string, locationData: any) => void;
  private onPeerStatusUpdateCallback?: (peers: PeerConnection[]) => void;

  addPeer(peer: PeerConnection): void {
    this.peers.set(peer.id, peer);
    this.notifyPeerStatusUpdate();
  }

  removePeer(peerId: string): void {
    this.peers.delete(peerId);
    this.notifyPeerStatusUpdate();
  }

  getPeer(peerId: string): PeerConnection | undefined {
    return this.peers.get(peerId);
  }

  getConnectedPeers(): PeerConnection[] {
    return Array.from(this.peers.values());
  }

  clearPeers(): void {
    this.peers.clear();
    this.notifyPeerStatusUpdate();
  }

  requestLocationFromAllClients(): void {
    this.peers.forEach((peer) => {
      if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
        try {
          peer.dataChannel.send(JSON.stringify({
            type: 'location_request',
            timestamp: Date.now()
          }));
        } catch (error) {
          console.error('Failed to request location from peer:', peer.id, error);
        }
      }
    });
  }

  sendToPeer(peerId: string, message: any): void {
    const peer = this.getPeer(peerId);
    if (peer?.dataChannel && peer.dataChannel.readyState === 'open') {
      try {
        peer.dataChannel.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send message to peer:', peerId, error);
      }
    }
  }

  onLocationUpdate(callback: (userId: string, locationData: any) => void): void {
    this.onLocationUpdateCallback = callback;
  }

  onPeerStatusUpdate(callback: (peers: PeerConnection[]) => void): void {
    this.onPeerStatusUpdateCallback = callback;
  }

  private notifyPeerStatusUpdate(): void {
    if (this.onPeerStatusUpdateCallback) {
      this.onPeerStatusUpdateCallback(this.getConnectedPeers());
    }
  }

  handleLocationUpdate(userId: string, locationData: any): void {
    if (this.onLocationUpdateCallback) {
      this.onLocationUpdateCallback(userId, locationData);
    }
  }
}
