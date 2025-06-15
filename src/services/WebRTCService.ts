
import { WebRTCServerOffer, WebRTCMessage, PeerConnection } from './webrtc/types';
import { SignalingMessage } from './webrtc/SignalingService';
import { WebRTCServiceCore } from './webrtc/WebRTCServiceCore';
import { WebRTCManagerCollection } from './webrtc/WebRTCManagerCollection';
import { WebRTCBroadcastManager } from './webrtc/WebRTCBroadcastManager';
import { WebRTCLongPollManager } from './webrtc/WebRTCLongPollManager';
import { WebRTCEventListeners } from './webrtc/WebRTCEventListeners';
import { WebRTCStatusManager } from './webrtc/WebRTCStatusManager';

class WebRTCService {
  private core: WebRTCServiceCore;
  private managers: WebRTCManagerCollection;
  private broadcastManager: WebRTCBroadcastManager;
  private longPollManager: WebRTCLongPollManager;
  private eventListeners: WebRTCEventListeners;
  private statusManager: WebRTCStatusManager;

  constructor() {
    this.core = new WebRTCServiceCore();
    this.managers = new WebRTCManagerCollection(this.core);
    this.broadcastManager = new WebRTCBroadcastManager();
    this.longPollManager = new WebRTCLongPollManager();
    this.eventListeners = new WebRTCEventListeners();
    this.statusManager = new WebRTCStatusManager(this.core);

    this.managers.setupEventManagerCallbacks(this.core);

    // Listen for admin online broadcasts (if not admin)
    this.broadcastManager.registerAdminOnlineListener(() => {
      this.longPollManager.stopLongPollReconnect();
      this.forceReconnect();
    });

    // Add event listeners for robust client-side reconnection
    this.eventListeners.setupEventListeners(
      this.forceReconnect.bind(this),
      this.handlePermanentConnectionLoss.bind(this)
    );
  }

  async createServerOffer(organizationId: string, organizationName: string): Promise<WebRTCServerOffer> {
    this.core.updateStates(true, `admin-${organizationId}-${Date.now()}`, organizationId);
    this.managers.updateManagerStates(true, organizationId);
    this.broadcastManager.setOrganizationId(organizationId);

    const serverOffer = await this.managers.serverManager.createServerOffer(
      organizationId,
      organizationName,
      this.core.userId!
    );

    this.setupConnectionHandlers();
    this.managers.eventManager.setupIPChangeHandling();

    // Broadcast admin presence so clients reconnect
    if (this.core.isAdmin) {
      this.broadcastManager.broadcastAdminOnline();
    }

    return serverOffer;
  }

  async connectToServer(offerData: WebRTCServerOffer, userId: string, userName: string): Promise<void> {
    this.core.updateStates(false, userId, offerData.organizationId);
    this.managers.updateManagerStates(false, offerData.organizationId);
    this.broadcastManager.setOrganizationId(offerData.organizationId);

    await this.managers.clientManager.connectToServer(offerData, userId, userName);

    this.setupConnectionHandlers();
    this.managers.eventManager.setupIPChangeHandling();
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
    return this.statusManager.getConnectedPeers();
  }

  getConnectionStatus(): 'disconnected' | 'connecting' | 'connected' {
    return this.statusManager.getConnectionStatus();
  }

  isCurrentlyReconnecting(): boolean {
    return this.statusManager.isCurrentlyReconnecting();
  }

  getReconnectAttempts(): number {
    return this.statusManager.getReconnectAttempts();
  }

  getDetailedReconnectionStatus(): Map<string, { isReconnecting: boolean; attempt: number; maxAttempts: number }> {
    return this.statusManager.getDetailedReconnectionStatus();
  }

  private handlePermanentConnectionLoss(event: CustomEvent): void {
    if (!this.core.isAdmin) {
        console.log('Client connection permanently lost, starting dynamic backoff reconnect strategy.');
        this.longPollManager.startLongPollReconnect(
          () => this.getConnectionStatus(),
          () => this.forceReconnect()
        );
    }
  }

  // Removed: Mesh network API (getMeshNetworkStatus, getAllDevicesInNetwork, onMeshNetworkUpdate, etc.)
  getMeshNetworkStatus() {
    return null;
  }
  getAllDevicesInNetwork() {
    return [];
  }
  onMeshNetworkUpdate(_: any) {}
  broadcastToMeshNetwork(_: any) {}
  requestMeshNetworkSync() {}

  disconnect(): void {
    this.core.cleanup();
    this.longPollManager.cleanup();
    this.broadcastManager.cleanup();
    this.eventListeners.cleanup();
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
}

export const webRTCService = new WebRTCService();
export type { WebRTCServerOffer, PeerConnection, WebRTCMessage };
