import { WebRTCServerOffer, WebRTCMessage, PeerConnection } from './webrtc/types';
import { SignalingMessage } from './webrtc/SignalingService';
import { DeviceInfo, AddressBook } from './webrtc/MeshNetworkManager';
import { WebRTCServiceCore } from './webrtc/WebRTCServiceCore';
import { WebRTCMeshService } from './webrtc/WebRTCMeshService';
import { WebRTCManagerCollection } from './webrtc/WebRTCManagerCollection';

class WebRTCService {
  private core: WebRTCServiceCore;
  private meshService: WebRTCMeshService;
  private managers: WebRTCManagerCollection;

  constructor() {
    this.core = new WebRTCServiceCore();
    this.meshService = new WebRTCMeshService();
    this.managers = new WebRTCManagerCollection(this.core);
    
    this.managers.setupEventManagerCallbacks(this.core);
  }

  async createServerOffer(organizationId: string, organizationName: string): Promise<WebRTCServerOffer> {
    this.core.updateStates(true, `admin-${organizationId}-${Date.now()}`, organizationId);
    this.managers.updateManagerStates(true, organizationId);
    
    // Initialize mesh network
    this.meshService.initializeMeshNetwork(
      this.core.userId!,
      organizationName,
      organizationId,
      true,
      this.core.connectionManager,
      this.core.ipChangeManager
    );
    
    const serverOffer = await this.managers.serverManager.createServerOffer(
      organizationId,
      organizationName,
      this.core.userId!
    );
    
    this.setupConnectionHandlers();
    this.managers.eventManager.setupIPChangeHandling();

    // Setup enhanced reconnection if available
    if (this.core.enhancedReconnectionManager) {
      this.core.enhancedReconnectionManager.onReconnectionStarted((clientIds) => {
        console.log('WebRTCService: Enhanced reconnection started for clients:', clientIds);
      });
    }

    return serverOffer;
  }

  async connectToServer(offerData: WebRTCServerOffer, userId: string, userName: string): Promise<void> {
    this.core.updateStates(false, userId, offerData.organizationId);
    this.managers.updateManagerStates(false, offerData.organizationId);
    
    // Initialize mesh network
    this.meshService.initializeMeshNetwork(
      userId,
      userName,
      offerData.organizationId,
      false,
      this.core.connectionManager,
      this.core.ipChangeManager
    );
    
    await this.managers.clientManager.connectToServer(offerData, userId, userName);
    
    this.setupConnectionHandlers();
    this.managers.eventManager.setupIPChangeHandling();
    
    // Initiate mesh sync after connection
    this.meshService.initiateMeshSync();
  }

  private setupConnectionHandlers(): void {
    this.managers.eventManager.setupConnectionHandlers();
    this.setupSignalingHandler();
  }

  private setupSignalingHandler(): void {
    this.core.connectionManager.onSignalingMessage((message, fromPeerId) => {
      this.handleSignalingMessage(message, fromPeerId);
    });
  }

  private async handleSignalingMessage(message: SignalingMessage, fromPeerId: string): Promise<void> {
    console.log('Handling signaling message:', message.type, 'from:', fromPeerId);
    const connection = this.core.webrtcConnection.getConnection();
    if (!connection) return;

    switch (message.type) {
      case 'new-offer':
        if (!this.core.isAdmin) {
          await this.core.webrtcSignaling.handleNewOffer(
            message.data, 
            fromPeerId, 
            connection,
            (peerId, answer) => this.core.connectionManager.sendNewAnswer(peerId, answer)
          );
          this.core.offerManager.setLastServerOffer(message.data);
        }
        break;

      case 'new-answer':
        if (this.core.isAdmin) {
          await this.core.webrtcSignaling.handleNewAnswer(
            message.data,
            connection,
            () => this.core.reconnectionManager.markReconnectionSuccess(fromPeerId)
          );
        }
        break;

      case 'ice-candidate':
        await this.core.webrtcSignaling.handleIceCandidate(message.data, connection);
        break;

      case 'ip-changed':
        this.core.ipChangeManager.handlePeerIPChange(fromPeerId, 'unknown', message.data.newIp);
        break;
    }
  }

  approveJoinRequest(peerId: string, approved: boolean): void {
    if (!this.core.isAdmin) return;

    const message = {
      type: 'join-response',
      data: { approved }
    };

    this.sendToPeer(peerId, message);
  }

  requestLocationFromClient(clientId: string): void {
    if (!this.core.isAdmin) return;
    this.managers.serverManager.requestLocationFromClient(clientId);
  }

  requestLocationFromAllClients(): void {
    if (!this.core.isAdmin) return;
    this.managers.serverManager.requestLocationFromAllClients();
  }

  sendToPeer(peerId: string, data: any): void {
    if (!this.core.isAdmin) {
      console.warn('Only admin can send data to a specific peer.');
      return;
    }
    this.managers.serverManager.sendToPeer(peerId, data);
  }

  sendLocationUpdate(locationData: any): void {
    if (this.core.isAdmin) return;
    this.managers.clientManager.sendLocationUpdate(locationData);
  }

  onLocationUpdate(callback: (userId: string, location: any) => void): void {
    this.core.connectionManager.onLocationUpdate(callback);
  }

  onPeerStatusUpdate(callback: (peers: PeerConnection[]) => void): void {
    this.core.connectionManager.onPeerStatusUpdate(callback);
  }

  onMessage(callback: (message: WebRTCMessage) => void): void {
    this.core.connectionManager.onMessage((message, fromPeerId) => {
      callback(message);
    });
  }

  getConnectedPeers(): PeerConnection[] {
    return this.core.connectionManager.getConnectedPeers();
  }

  getConnectionStatus(): 'disconnected' | 'connecting' | 'connected' {
    return this.core.getConnectionStatus();
  }

  isCurrentlyReconnecting(): boolean {
    const allStates = this.core.reconnectionManager.getAllReconnectionStates();
    return allStates.size > 0 || this.core.autoReconnectionManager.isReconnecting();
  }

  getReconnectAttempts(): number {
    const allStates = this.core.reconnectionManager.getAllReconnectionStates();
    if (allStates.size === 0) return 0;
    
    return Math.max(...Array.from(allStates.values()).map(state => state.attempt));
  }

  getDetailedReconnectionStatus(): Map<string, { isReconnecting: boolean; attempt: number; maxAttempts: number }> {
    const peers = this.core.connectionManager.getAllPeers();
    const statusMap = new Map();
    
    peers.forEach(peer => {
      statusMap.set(peer.id, this.core.reconnectionManager.getReconnectionState(peer.id));
    });
    
    return statusMap;
  }

  getMeshNetworkStatus() {
    return this.meshService.getMeshNetworkStatus();
  }

  getAllDevicesInNetwork(): DeviceInfo[] {
    return this.meshService.getAllDevicesInNetwork();
  }

  onMeshNetworkUpdate(callback: (devices: DeviceInfo[]) => void): void {
    this.meshService.onMeshNetworkUpdate(callback);
  }

  broadcastToMeshNetwork(data: any): void {
    this.meshService.broadcastToMeshNetwork(data);
  }

  requestMeshNetworkSync(): void {
    this.meshService.initiateMeshSync();
  }

  disconnect(): void {
    this.core.cleanup();
    this.meshService.cleanup();
  }

  async forceReconnect(): Promise<void> {
    await this.managers.reconnectionHandler.forceReconnect();
  }

  canAutoReconnect(): boolean {
    return this.core.isAdmin && this.managers.serverManager.canAutoReconnect();
  }

  getStoredClientCount(): number {
    return this.managers.serverManager.getStoredClientCount();
  }

  isEnhancedSignalingAvailable(): boolean {
    return this.core.isEnhancedSignalingAvailable();
  }

  getEnhancedReconnectionStatus(): {
    available: boolean;
    connected: boolean;
  } {
    return {
      available: !!this.core.enhancedReconnectionManager,
      connected: this.core.enhancedReconnectionManager?.isSignalingConnected() || false
    };
  }
}

export const webRTCService = new WebRTCService();
export type { WebRTCServerOffer, PeerConnection, WebRTCMessage, DeviceInfo, AddressBook };
