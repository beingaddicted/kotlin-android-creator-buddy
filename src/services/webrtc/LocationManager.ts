
import { PeerManager } from './PeerManager';
import { LocationData } from './types';

export class LocationManager {
  private peerManager: PeerManager;
  private isServer = false;
  private onLocationReceived?: (userId: string, location: LocationData) => void;

  constructor(peerManager: PeerManager) {
    this.peerManager = peerManager;
  }

  setAsServer(isServer: boolean) {
    this.isServer = isServer;
  }

  onLocationUpdate(callback: (userId: string, location: LocationData) => void) {
    this.onLocationReceived = callback;
  }

  requestLocationFromAllClients() {
    if (!this.isServer) return;

    const connectedPeers = this.peerManager.getConnectedPeers();
    connectedPeers.forEach(peer => {
      this.requestLocationUpdate(peer.id);
    });
  }

  requestLocationUpdate(peerId: string) {
    const peer = this.peerManager.getPeer(peerId);
    if (peer?.dataChannel && peer.dataChannel.readyState === 'open') {
      try {
        peer.dataChannel.send(JSON.stringify({
          type: 'location_request',
          timestamp: Date.now()
        }));
      } catch (error) {
        console.error('Failed to request location update:', error);
      }
    }
  }

  sendLocationUpdate(locationData: LocationData, serverPeerId?: string) {
    const targetPeerId = serverPeerId || this.getServerPeerId();
    if (!targetPeerId) return;

    const peer = this.peerManager.getPeer(targetPeerId);
    if (peer?.dataChannel && peer.dataChannel.readyState === 'open') {
      try {
        peer.dataChannel.send(JSON.stringify({
          type: 'location_update',
          data: locationData,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.error('Failed to send location update:', error);
      }
    }
  }

  handleLocationMessage(message: any, fromPeerId: string) {
    if (message.type === 'location_request' && !this.isServer) {
      this.getCurrentLocation().then(location => {
        if (location) {
          this.sendLocationUpdate(location, fromPeerId);
        }
      });
    } else if (message.type === 'location_update' && this.isServer) {
      if (this.onLocationReceived && message.data) {
        this.onLocationReceived(fromPeerId, message.data);
      }
    }
  }

  private async getCurrentLocation(): Promise<LocationData | null> {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000
        });
      });

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Failed to get current location:', error);
      return null;
    }
  }

  private getServerPeerId(): string | null {
    const peers = this.peerManager.getAllPeers();
    const serverPeer = peers.find(peer => peer.name.includes('Server-'));
    return serverPeer?.id || null;
  }
}
