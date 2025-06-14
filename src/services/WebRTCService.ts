
import { WebRTCServerOffer, WebRTCMessage, PeerConnection } from './webrtc/types';
import { ConnectionManager } from './webrtc/ConnectionManager';
import { SignalingMessage } from './webrtc/SignalingService';
import { IPChangeManager } from './webrtc/IPChangeManager';
import { ReconnectionManager } from './webrtc/ReconnectionManager';
import { WebRTCConnection } from './webrtc/WebRTCConnection';
import { WebRTCSignaling } from './webrtc/WebRTCSignaling';
import { WebRTCEventHandler } from './webrtc/WebRTCEventHandler';
import { WebRTCOfferManager } from './webrtc/WebRTCOfferManager';
import { AutoReconnectionManager } from './webrtc/AutoReconnectionManager';
import { WebRTCEventManager } from './webrtc/WebRTCEventManager';
import { WebRTCReconnectionHandler } from './webrtc/WebRTCReconnectionHandler';
import { WebRTCServerManager } from './webrtc/WebRTCServerManager';
import { WebRTCClientManager } from './webrtc/WebRTCClientManager';

class WebRTCService {
  private webrtcConnection = new WebRTCConnection();
  private connectionManager = new ConnectionManager();
  private ipChangeManager = new IPChangeManager();
  private reconnectionManager = new ReconnectionManager();
  private webrtcSignaling = new WebRTCSignaling();
  private eventHandler = new WebRTCEventHandler();
  private offerManager = new WebRTCOfferManager();
  private autoReconnectionManager = new AutoReconnectionManager();
  
  // New modular managers
  private eventManager: WebRTCEventManager;
  private reconnectionHandler: WebRTCReconnectionHandler;
  private serverManager: WebRTCServerManager;
  private clientManager: WebRTCClientManager;
  
  private isAdmin = false;
  private userId: string | null = null;
  private organizationId: string | null = null;

  constructor() {
    this.eventManager = new WebRTCEventManager(
      this.webrtcConnection,
      this.connectionManager,
      this.reconnectionManager,
      this.autoReconnectionManager,
      this.ipChangeManager,
      this.eventHandler,
      this.isAdmin
    );

    this.reconnectionHandler = new WebRTCReconnectionHandler(
      this.webrtcConnection,
      this.connectionManager,
      this.reconnectionManager,
      this.offerManager,
      this.ipChangeManager,
      this.isAdmin
    );

    this.serverManager = new WebRTCServerManager(
      this.webrtcConnection,
      this.connectionManager,
      this.reconnectionManager,
      this.offerManager,
      this.autoReconnectionManager,
      this.ipChangeManager
    );

    this.clientManager = new WebRTCClientManager(
      this.webrtcConnection,
      this.connectionManager,
      this.reconnectionManager,
      this.offerManager
    );

    this.setupEventManagerCallbacks();
  }

  private setupEventManagerCallbacks(): void {
    this.eventManager.onSendUpdatedOfferToAllClients = (newIP: string) => 
      this.reconnectionHandler.sendUpdatedOfferToAllClients(newIP);
    
    this.eventManager.onSendUpdatedOfferToClient = (clientId: string) => 
      this.reconnectionHandler.sendUpdatedOfferToClient(clientId);
    
    this.eventManager.onAttemptReconnection = (peerId: string) => 
      this.reconnectionHandler.attemptReconnection(peerId);
    
    this.eventManager.getLastServerOffer = () => 
      this.offerManager.getLastServerOffer();
    
    this.eventManager.organizationId = this.organizationId;
  }

  async createServerOffer(organizationId: string, organizationName: string): Promise<WebRTCServerOffer> {
    this.isAdmin = true;
    this.organizationId = organizationId;
    this.userId = `admin-${organizationId}-${Date.now()}`;
    
    this.updateManagerStates();
    
    const serverOffer = await this.serverManager.createServerOffer(
      organizationId,
      organizationName,
      this.userId
    );
    
    this.setupConnectionHandlers();
    this.eventManager.setupIPChangeHandling();

    return serverOffer;
  }

  async connectToServer(offerData: WebRTCServerOffer, userId: string, userName: string): Promise<void> {
    this.isAdmin = false;
    this.userId = userId;
    this.organizationId = offerData.organizationId;
    
    this.updateManagerStates();
    
    await this.clientManager.connectToServer(offerData, userId, userName);
    
    this.setupConnectionHandlers();
    this.eventManager.setupIPChangeHandling();
  }

  private updateManagerStates(): void {
    // Update the event manager's isAdmin state
    (this.eventManager as any).isAdmin = this.isAdmin;
    (this.eventManager as any).organizationId = this.organizationId;
    
    // Update reconnection handler's isAdmin state
    (this.reconnectionHandler as any).isAdmin = this.isAdmin;
  }

  private setupConnectionHandlers(): void {
    this.eventManager.setupConnectionHandlers();
    this.setupSignalingHandler();
  }

  private setupSignalingHandler(): void {
    this.connectionManager.onSignalingMessage((message, fromPeerId) => {
      this.handleSignalingMessage(message, fromPeerId);
    });
  }

  private async handleSignalingMessage(message: SignalingMessage, fromPeerId: string): Promise<void> {
    console.log('Handling signaling message:', message.type, 'from:', fromPeerId);
    const connection = this.webrtcConnection.getConnection();
    if (!connection) return;

    switch (message.type) {
      case 'new-offer':
        if (!this.isAdmin) {
          await this.webrtcSignaling.handleNewOffer(
            message.data, 
            fromPeerId, 
            connection,
            (peerId, answer) => this.connectionManager.sendNewAnswer(peerId, answer)
          );
          this.offerManager.setLastServerOffer(message.data);
        }
        break;

      case 'new-answer':
        if (this.isAdmin) {
          await this.webrtcSignaling.handleNewAnswer(
            message.data,
            connection,
            () => this.reconnectionManager.markReconnectionSuccess(fromPeerId)
          );
        }
        break;

      case 'ice-candidate':
        await this.webrtcSignaling.handleIceCandidate(message.data, connection);
        break;

      case 'ip-changed':
        this.ipChangeManager.handlePeerIPChange(fromPeerId, 'unknown', message.data.newIp);
        break;
    }
  }

  // Public API methods
  requestLocationFromClient(clientId: string): void {
    if (!this.isAdmin) return;
    this.serverManager.requestLocationFromClient(clientId);
  }

  requestLocationFromAllClients(): void {
    if (!this.isAdmin) return;
    this.serverManager.requestLocationFromAllClients();
  }

  sendLocationUpdate(locationData: any): void {
    if (this.isAdmin) return;
    this.clientManager.sendLocationUpdate(locationData);
  }

  onLocationUpdate(callback: (userId: string, location: any) => void): void {
    this.connectionManager.onLocationUpdate(callback);
  }

  onPeerStatusUpdate(callback: (peers: PeerConnection[]) => void): void {
    this.connectionManager.onPeerStatusUpdate(callback);
  }

  getConnectedPeers(): PeerConnection[] {
    return this.connectionManager.getConnectedPeers();
  }

  getConnectionStatus(): 'disconnected' | 'connecting' | 'connected' {
    const state = this.webrtcConnection.getConnectionState();
    
    if (state === 'connected') return 'connected';
    if (state === 'connecting') return 'connecting';
    
    return 'disconnected';
  }

  isCurrentlyReconnecting(): boolean {
    const allStates = this.reconnectionManager.getAllReconnectionStates();
    return allStates.size > 0 || this.autoReconnectionManager.isReconnecting();
  }

  getReconnectAttempts(): number {
    const allStates = this.reconnectionManager.getAllReconnectionStates();
    if (allStates.size === 0) return 0;
    
    return Math.max(...Array.from(allStates.values()).map(state => state.attempt));
  }

  getDetailedReconnectionStatus(): Map<string, { isReconnecting: boolean; attempt: number; maxAttempts: number }> {
    const peers = this.connectionManager.getAllPeers();
    const statusMap = new Map();
    
    peers.forEach(peer => {
      statusMap.set(peer.id, this.reconnectionManager.getReconnectionState(peer.id));
    });
    
    return statusMap;
  }

  disconnect(): void {
    this.ipChangeManager.stopMonitoring();
    this.reconnectionManager.clearAllReconnections();
    this.serverManager.deactivateServer();
    this.webrtcConnection.close();
    this.connectionManager.clearPeers();
    this.offerManager.clearLastServerOffer();
  }

  async forceReconnect(): Promise<void> {
    await this.reconnectionHandler.forceReconnect();
  }

  canAutoReconnect(): boolean {
    return this.isAdmin && this.serverManager.canAutoReconnect();
  }

  getStoredClientCount(): number {
    return this.serverManager.getStoredClientCount();
  }
}

export const webRTCService = new WebRTCService();
export type { WebRTCServerOffer, PeerConnection, WebRTCMessage };
