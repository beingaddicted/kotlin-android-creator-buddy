
import { WebRTCServiceCore } from './webrtc/WebRTCServiceCore';
import { WebRTCServerManager } from './webrtc/WebRTCServerManager';
import { WebRTCClientManager } from './webrtc/WebRTCClientManager';
import { WebRTCEventManager } from './webrtc/WebRTCEventManager';
import { WebRTCServerOffer, PeerConnection } from './webrtc/types';

export class WebRTCService {
  private core: WebRTCServiceCore;
  private serverManager: WebRTCServerManager;
  private clientManager: WebRTCClientManager;
  private eventManager: WebRTCEventManager;

  constructor() {
    this.core = new WebRTCServiceCore();
    
    this.serverManager = new WebRTCServerManager(
      this.core.webrtcConnection,
      this.core.connectionManager,
      this.core.offerManager,
      this.core.reconnectionManager
    );
    
    this.clientManager = new WebRTCClientManager(
      this.core.webrtcConnection,
      this.core.connectionManager,
      this.core.reconnectionManager,
      this.core.offerManager
    );
    
    this.eventManager = new WebRTCEventManager(
      this.core.webrtcConnection,
      this.core.connectionManager,
      this.core.reconnectionManager,
      this.core.autoReconnectionManager,
      this.core.ipChangeManager,
      this.core.eventHandler,
      false
    );
    
    this.setupEventManagerCallbacks();
  }

  // Server methods
  async startServer(organizationId: string, organizationName: string, adminId: string): Promise<WebRTCServerOffer> {
    this.core.updateStates(true, adminId, organizationId);
    this.eventManager = new WebRTCEventManager(
      this.core.webrtcConnection,
      this.core.connectionManager,
      this.core.reconnectionManager,
      this.core.autoReconnectionManager,
      this.core.ipChangeManager,
      this.core.eventHandler,
      true
    );
    this.setupEventManagerCallbacks();
    
    return await this.serverManager.startServer(organizationId, organizationName, adminId);
  }

  // Client methods
  async connectToServer(offerData: WebRTCServerOffer, userId: string, userName: string): Promise<void> {
    this.core.updateStates(false, userId, offerData.organizationId);
    return await this.clientManager.connectToServer(offerData, userId, userName);
  }

  // Common methods
  getConnectionStatus(): 'disconnected' | 'connecting' | 'connected' {
    return this.core.getConnectionStatus();
  }

  getConnectedPeers(): PeerConnection[] {
    return this.core.connectionManager.getConnectedPeers();
  }

  disconnect(): void {
    this.core.cleanup();
  }

  // Location methods
  requestLocationFromAllClients(): void {
    this.core.connectionManager.requestLocationFromAllClients();
  }

  sendLocationUpdate(locationData: any): void {
    this.clientManager.sendLocationUpdate(locationData);
  }

  // Event handlers
  onLocationUpdate(callback: (userId: string, locationData: any) => void): void {
    this.core.connectionManager.onLocationUpdate(callback);
  }

  onPeerStatusUpdate(callback: (peers: PeerConnection[]) => void): void {
    this.core.connectionManager.onPeerStatusUpdate(callback);
  }

  // Reconnection methods
  async forceReconnect(): Promise<void> {
    console.log('Force reconnecting...');
    
    if (this.core.isAdmin) {
      await this.serverManager.sendUpdatedOfferToAllClients();
    } else {
      // Client reconnection logic
      const lastOffer = this.core.offerManager.getLastServerOffer();
      if (lastOffer) {
        await this.connectToServer(lastOffer, this.core.userId || 'client', 'User');
      }
    }
  }

  canAutoReconnect(): boolean {
    return this.core.autoReconnectionManager.isCurrentlyAutoReconnecting();
  }

  getStoredClientCount(): number {
    return this.core.connectionManager.getConnectedPeers().length;
  }

  isCurrentlyReconnecting(): boolean {
    return this.core.autoReconnectionManager.isCurrentlyAutoReconnecting();
  }

  getReconnectAttempts(): number {
    const statuses = this.core.reconnectionManager.getAllReconnectionStatuses();
    return Array.from(statuses.values()).reduce((max, status) => Math.max(max, status.attempts), 0);
  }

  getDetailedReconnectionStatus(): Map<string, any> {
    return this.core.reconnectionManager.getAllReconnectionStatuses();
  }

  // Mini server methods
  async startMiniServer(): Promise<any> {
    return await this.core.startMiniServer();
  }

  async stopMiniServer(): Promise<void> {
    await this.core.stopMiniServer();
  }

  isMiniServerRunning(): boolean {
    return this.core.isMiniServerRunning();
  }

  getMiniServerStats(): any {
    return this.core.getMiniServerStats();
  }

  private setupEventManagerCallbacks(): void {
    this.eventManager.onSendUpdatedOfferToAllClients = async (newIP: string) => {
      if (this.core.isAdmin) {
        await this.serverManager.sendUpdatedOfferToAllClients(newIP);
      }
    };

    this.eventManager.onSendUpdatedOfferToClient = async (clientId: string) => {
      if (this.core.isAdmin) {
        await this.serverManager.sendUpdatedOfferToClient(clientId);
      }
    };

    this.eventManager.onAttemptReconnection = async (peerId: string) => {
      await this.forceReconnect();
    };

    this.eventManager.getLastServerOffer = () => {
      return this.core.offerManager.getLastServerOffer();
    };

    this.eventManager.organizationId = this.core.organizationId;

    this.eventManager.setupConnectionHandlers();
    this.eventManager.setupIPChangeHandling();
  }
}

export const webRTCService = new WebRTCService();
export type { WebRTCServerOffer, PeerConnection };
