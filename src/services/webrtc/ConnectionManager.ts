import { PeerConnection } from './types';
import { SignalingService, SignalingMessage } from './SignalingService';
import { PeerManager } from './PeerManager';
import { DataChannelManager } from './DataChannelManager';
import { LocationManager } from './LocationManager';
import { WebRTCMessage } from './types';

export class ConnectionManager {
  private peerManager: PeerManager;
  private dataChannelManager: DataChannelManager;
  private locationManager: LocationManager;
  private signalingService: SignalingService;

  constructor() {
    this.signalingService = new SignalingService();
    this.peerManager = new PeerManager();
    this.dataChannelManager = new DataChannelManager(this.peerManager, this.signalingService);
    this.locationManager = new LocationManager(this.peerManager);
  }

  setAsServer(isServer: boolean) {
    this.signalingService.setAsServer(isServer);
    this.dataChannelManager.setAsServer(isServer);
    this.locationManager.setAsServer(isServer);
    
    // Setup signaling message handler
    this.signalingService.setSignalingMessageHandler((message, fromPeerId) => {
      this.dataChannelManager.onSignalingMessage((msg, peerId) => {
        // Forward to external handler if set
      });
    });
  }

  setupDataChannel(dataChannel: RTCDataChannel, peerId: string) {
    this.dataChannelManager.setupDataChannel(dataChannel, peerId);
  }

  addPeer(peer: PeerConnection) {
    this.peerManager.addPeer(peer);
  }

  getPeer(peerId: string): PeerConnection | undefined {
    return this.peerManager.getPeer(peerId);
  }

  getConnectedPeers(): PeerConnection[] {
    return this.peerManager.getConnectedPeers();
  }

  getAllPeers(): PeerConnection[] {
    return this.peerManager.getAllPeers();
  }

  // Location methods
  requestLocationFromAllClients() {
    this.locationManager.requestLocationFromAllClients();
  }

  requestLocationUpdate(peerId: string) {
    this.locationManager.requestLocationUpdate(peerId);
  }

  sendLocationUpdate(locationData: any, serverPeerId?: string) {
    this.locationManager.sendLocationUpdate(locationData, serverPeerId);
  }

  // Signaling methods
  sendNewOffer(peerId: string, offer: any) {
    this.signalingService.sendNewOffer(peerId, offer);
  }

  sendNewAnswer(adminId: string, answer: RTCSessionDescriptionInit) {
    this.signalingService.sendNewAnswer(adminId, answer);
  }

  sendIceCandidate(peerId: string, candidate: RTCIceCandidate) {
    this.signalingService.sendIceCandidate(peerId, candidate);
  }

  notifyIpChange(newIp: string) {
    this.signalingService.notifyIpChange(newIp);
  }

  sendToPeer(peerId: string, data: { type: string, data: any }): void {
    this.dataChannelManager.send(peerId, data);
  }

  onSignalingMessage(callback: (message: SignalingMessage, fromPeerId: string) => void) {
    this.dataChannelManager.onSignalingMessage(callback);
  }

  clearPeers() {
    this.peerManager.clearPeers();
    this.signalingService.clearDataChannels();
  }

  onLocationUpdate(callback: (userId: string, location: any) => void) {
    this.dataChannelManager.onLocationUpdate(callback);
  }

  onPeerStatusUpdate(callback: (peers: PeerConnection[]) => void) {
    this.peerManager.onPeerStatusUpdate(callback);
  }

  onMessage(callback: (message: WebRTCMessage, fromPeerId: string) => void) {
    this.dataChannelManager.onMessage(callback);
  }
}
