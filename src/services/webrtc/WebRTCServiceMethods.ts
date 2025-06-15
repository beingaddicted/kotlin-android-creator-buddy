
import { WebRTCServiceCore } from './WebRTCServiceCore';
import { WebRTCServerManager } from './WebRTCServerManager';
import { WebRTCClientManager } from './WebRTCClientManager';
import { WebRTCEventManager } from './WebRTCEventManager';
import { WebRTCDiagnosticManager } from './WebRTCDiagnosticManager';
import { WebRTCServerOffer, PeerConnection } from './types';

export class WebRTCServiceMethods {
  constructor(
    private core: WebRTCServiceCore,
    private serverManager: WebRTCServerManager,
    private clientManager: WebRTCClientManager,
    private eventManager: WebRTCEventManager,
    private diagnosticManager: WebRTCDiagnosticManager
  ) {}

  // Server methods
  async createServerOffer(organizationId: string, organizationName: string): Promise<WebRTCServerOffer> {
    const adminId = `admin_${Date.now()}`;
    this.core.updateStates(true, adminId, organizationId);
    return await this.serverManager.createServerOffer(organizationId, organizationName, adminId);
  }

  async startServer(organizationId: string, organizationName: string, adminId: string): Promise<WebRTCServerOffer> {
    this.core.updateStates(true, adminId, organizationId);
    this.updateEventManagerForAdmin();
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

  // Message sending
  sendToPeer(peerId: string, message: any): void {
    this.core.connectionManager.sendToPeer(peerId, message);
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

  private updateEventManagerForAdmin(): void {
    this.eventManager = new WebRTCEventManager(
      this.core.webrtcConnection,
      this.core.connectionManager,
      this.core.reconnectionManager,
      this.core.autoReconnectionManager,
      this.core.ipChangeManager,
      this.core.eventHandler,
      true
    );
  }
}
