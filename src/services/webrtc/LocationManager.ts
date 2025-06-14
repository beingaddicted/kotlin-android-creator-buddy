
import { WebRTCMessage } from './types';
import { PeerManager } from './PeerManager';

export class LocationManager {
  private peerManager: PeerManager;
  private isServer: boolean = false;

  constructor(peerManager: PeerManager) {
    this.peerManager = peerManager;
  }

  setAsServer(isServer: boolean) {
    this.isServer = isServer;
  }

  // Server method to request location from all connected clients
  requestLocationFromAllClients() {
    if (!this.isServer) return;
    
    this.peerManager.getConnectedPeers().forEach(peer => {
      this.requestLocationUpdate(peer.id);
    });
  }

  // Server method to request location from specific client
  requestLocationUpdate(peerId: string) {
    if (!this.isServer) return;
    
    const peer = this.peerManager.getPeer(peerId);
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
    const connectedPeers = this.peerManager.getConnectedPeers();
    const targetPeer = serverPeerId ? this.peerManager.getPeer(serverPeerId) : connectedPeers[0];
    
    if (targetPeer?.dataChannel && targetPeer.dataChannel.readyState === 'open') {
      targetPeer.dataChannel.send(JSON.stringify(message));
      console.log('WebRTC: Location update sent to server');
    }
  }
}
