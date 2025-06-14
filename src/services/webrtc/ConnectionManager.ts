
import { PeerConnection, WebRTCMessage } from './types';

export class ConnectionManager {
  private peers = new Map<string, PeerConnection>();
  private onLocationReceived?: (userId: string, location: any) => void;
  private onPeerStatusChanged?: (peers: PeerConnection[]) => void;
  private isServer = false;

  setAsServer(isServer: boolean) {
    this.isServer = isServer;
  }

  setupDataChannel(dataChannel: RTCDataChannel, peerId: string) {
    dataChannel.onopen = () => {
      console.log('WebRTC: Data channel opened with', peerId);
      
      if (this.peers.has(peerId)) {
        const peer = this.peers.get(peerId)!;
        peer.status = 'connected';
        peer.dataChannel = dataChannel;
        this.peers.set(peerId, peer);
        this.notifyPeerStatusChanged();
        
        // If server, request initial location from client
        if (this.isServer) {
          this.requestLocationUpdate(peerId);
        }
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

    dataChannel.onerror = (error) => {
      console.error('WebRTC: Data channel error with', peerId, error);
    };
  }

  private handleDataChannelMessage(message: WebRTCMessage, peerId: string) {
    console.log('WebRTC: Received message:', message.type, 'from:', peerId);

    switch (message.type) {
      case 'location':
        if (this.onLocationReceived) {
          if (this.peers.has(peerId)) {
            const peer = this.peers.get(peerId)!;
            peer.lastSeen = Date.now();
            this.peers.set(peerId, peer);
          }
          this.onLocationReceived(peerId, message.data);
        }
        break;
        
      case 'location-request':
        // Client received location request from server
        if (!this.isServer) {
          this.sendCurrentLocation();
        }
        break;
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

  // Server method to request location from all connected clients
  requestLocationFromAllClients() {
    if (!this.isServer) return;
    
    this.getConnectedPeers().forEach(peer => {
      this.requestLocationUpdate(peer.id);
    });
  }

  // Server method to request location from specific client
  requestLocationUpdate(peerId: string) {
    if (!this.isServer) return;
    
    const peer = this.getPeer(peerId);
    if (peer?.dataChannel && peer.dataChannel.readyState === 'open') {
      const message: WebRTCMessage = {
        type: 'location-request',
        data: {},
        timestamp: Date.now()
      };
      peer.dataChannel.send(JSON.stringify(message));
      console.log('WebRTC: Location request sent to', peerId);
    }
  }

  // Client method to send location to server
  sendLocationUpdate(locationData: any, serverPeerId?: string) {
    if (this.isServer) return; // Only clients send location
    
    const message: WebRTCMessage = {
      type: 'location',
      data: locationData,
      timestamp: Date.now()
    };

    // Send to server (first connected peer for client)
    const connectedPeers = this.getConnectedPeers();
    const targetPeer = serverPeerId ? this.getPeer(serverPeerId) : connectedPeers[0];
    
    if (targetPeer?.dataChannel && targetPeer.dataChannel.readyState === 'open') {
      targetPeer.dataChannel.send(JSON.stringify(message));
      console.log('WebRTC: Location update sent to server');
    }
  }

  // Client method to send current location when requested
  private sendCurrentLocation() {
    // This will be called by LocationService
    const event = new CustomEvent('webrtc-location-requested');
    window.dispatchEvent(event);
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
