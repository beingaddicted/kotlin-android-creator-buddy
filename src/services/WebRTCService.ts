
import { WebRTCServerOffer, WebRTCMessage, PeerConnection } from './webrtc/types';
import { SignalingMessage } from './webrtc/SignalingService';
import { WebRTCServiceCore } from './webrtc/WebRTCServiceCore';
// Removed: import { WebRTCMeshService } from './webrtc/WebRTCMeshService';
import { WebRTCManagerCollection } from './webrtc/WebRTCManagerCollection';
import { ExponentialBackoff } from '@/utils/backoff';

class WebRTCService {
  private core: WebRTCServiceCore;
  // Removed: private meshService: WebRTCMeshService;
  private managers: WebRTCManagerCollection;
  private longPollInterval: NodeJS.Timeout | null = null;

  // For improved reconnect logic:
  private backoff: ExponentialBackoff | null = null;
  private isListeningForAdminOnline = false;

  constructor() {
    this.core = new WebRTCServiceCore();
    // Removed: this.meshService = new WebRTCMeshService();
    this.managers = new WebRTCManagerCollection(this.core);

    this.managers.setupEventManagerCallbacks(this.core);

    // Listen for admin online broadcasts (if not admin)
    this.registerAdminOnlineListener();

    // Add event listeners for robust client-side reconnection
    window.addEventListener('webrtc-client-reconnection-needed', this.forceReconnect.bind(this));
    window.addEventListener('webrtc-connection-lost', this.handlePermanentConnectionLoss.bind(this) as EventListener);
  }

  // Broadcast presence when admin becomes available
  private broadcastAdminOnline() {
    if (!this.core.isAdmin) return;
    try {
      const channel = new BroadcastChannel('webrtc-admin');
      channel.postMessage({
        type: 'admin-online',
        ts: Date.now(),
        orgId: this.core.organizationId,
      });
      channel.close();
    } catch (e) {
      console.warn('Admin online broadcast failed:', e);
    }
  }

  private registerAdminOnlineListener() {
    // Ensure we only install this listener once per client
    if (this.isListeningForAdminOnline) return;
    try {
      const channel = new BroadcastChannel('webrtc-admin');
      channel.onmessage = (event) => {
        if (
          event.data &&
          event.data.type === 'admin-online' &&
          event.data.orgId === this.core.organizationId &&
          !this.core.isAdmin
        ) {
          // Instantly trigger reconnection attempt
          console.log('Admin comeback detected. Attempting fast reconnect.');
          this.stopLongPollReconnect();
          this.forceReconnect();
        }
      };
      // No need to close here; stays open as long as needed for listener.
      this.isListeningForAdminOnline = true;
    } catch (e) {
      console.warn('Could not listen for admin online events:', e);
    }
  }

  async createServerOffer(organizationId: string, organizationName: string): Promise<WebRTCServerOffer> {
    this.core.updateStates(true, `admin-${organizationId}-${Date.now()}`, organizationId);
    this.managers.updateManagerStates(true, organizationId);

    // Removed: Initialize mesh network
    // Removed: this.meshService.initializeMeshNetwork(...);

    const serverOffer = await this.managers.serverManager.createServerOffer(
      organizationId,
      organizationName,
      this.core.userId!
    );

    this.setupConnectionHandlers();
    this.managers.eventManager.setupIPChangeHandling();

    // Broadcast admin presence so clients reconnect
    this.broadcastAdminOnline();

    return serverOffer;
  }

  async connectToServer(offerData: WebRTCServerOffer, userId: string, userName: string): Promise<void> {
    this.core.updateStates(false, userId, offerData.organizationId);
    this.managers.updateManagerStates(false, offerData.organizationId);

    // Removed: Initialize mesh network
    // Removed: this.meshService.initializeMeshNetwork(...);

    await this.managers.clientManager.connectToServer(offerData, userId, userName);

    this.setupConnectionHandlers();
    this.managers.eventManager.setupIPChangeHandling();

    // Removed: meshService.initiateMeshSync();
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

  private handlePermanentConnectionLoss(event: CustomEvent): void {
    if (!this.core.isAdmin) {
        console.log('Client connection permanently lost, starting dynamic backoff reconnect strategy.');
        this.startLongPollReconnect();
    }
  }

  private startLongPollReconnect(): void {
    this.stopLongPollReconnect(); // Ensure no multiple intervals are running

    if (!this.backoff) {
      this.backoff = new ExponentialBackoff(2000, 30000, 2); // Start at 2s, max 30s
    }
    const doReconnect = async () => {
      if (this.getConnectionStatus() !== 'connected') {
        console.log(`Reconnection attempt (interval: ${this.backoff!.getCurrentInterval()} ms)...`);
        await this.forceReconnect();
        this.longPollInterval = setTimeout(doReconnect, this.backoff!.getNextInterval());
      } else {
        // On success
        this.backoff!.reset();
        this.stopLongPollReconnect();
      }
    };
    this.longPollInterval = setTimeout(doReconnect, this.backoff.getNextInterval());
  }

  private stopLongPollReconnect(): void {
    if (this.longPollInterval) {
      clearTimeout(this.longPollInterval as any); // Use clearTimeout for setTimeout, not clearInterval
      this.longPollInterval = null;
    }
    if (this.backoff) {
      this.backoff.reset();
    }
  }

  // Removed: Mesh network API (getMeshNetworkStatus, getAllDevicesInNetwork, onMeshNetworkUpdate, etc.)
  // All following methods are now stubs for compatibility, but do nothing:
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
    this.stopLongPollReconnect();
    // Clean up broadcast channels
    this.isListeningForAdminOnline = false;
    // There might be more event listeners to clean up in a larger refactoring
    window.removeEventListener('webrtc-client-reconnection-needed', this.forceReconnect.bind(this));
    window.removeEventListener('webrtc-connection-lost', this.handlePermanentConnectionLoss.bind(this) as EventListener);
    // Removed: this.meshService.cleanup();
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
