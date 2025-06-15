
import { WebRTCServiceFactory } from './webrtc/WebRTCServiceFactory';
import { WebRTCServiceMethods } from './webrtc/WebRTCServiceMethods';
import { WebRTCServiceReconnection } from './webrtc/WebRTCServiceReconnection';
import { WebRTCServiceDiagnostics } from './webrtc/WebRTCServiceDiagnostics';
import { WebRTCServiceEventSetup } from './webrtc/WebRTCServiceEventSetup';
import { WebRTCServerOffer, PeerConnection } from './webrtc/types';

export class WebRTCService {
  private core: any;
  private serverManager: any;
  private clientManager: any;
  private eventManager: any;
  private diagnosticManager: any;
  
  private methods: WebRTCServiceMethods;
  private reconnection: WebRTCServiceReconnection;
  private diagnostics: WebRTCServiceDiagnostics;
  private eventSetup: WebRTCServiceEventSetup;

  constructor() {
    const components = WebRTCServiceFactory.createService();
    
    this.core = components.core;
    this.serverManager = components.serverManager;
    this.clientManager = components.clientManager;
    this.eventManager = components.eventManager;
    this.diagnosticManager = components.diagnosticManager;
    
    this.methods = new WebRTCServiceMethods(
      this.core,
      this.serverManager,
      this.clientManager,
      this.eventManager,
      this.diagnosticManager
    );
    
    this.reconnection = new WebRTCServiceReconnection(
      this.core,
      this.serverManager
    );
    
    this.diagnostics = new WebRTCServiceDiagnostics(
      this.diagnosticManager,
      this.core
    );
    
    this.eventSetup = new WebRTCServiceEventSetup(
      this.eventManager,
      this.core,
      this.serverManager
    );
    
    this.setupEventManagerCallbacks();
  }

  // Delegate to methods service
  async createServerOffer(organizationId: string, organizationName: string): Promise<WebRTCServerOffer> {
    return this.methods.createServerOffer(organizationId, organizationName);
  }

  async startServer(organizationId: string, organizationName: string, adminId: string): Promise<WebRTCServerOffer> {
    return this.methods.startServer(organizationId, organizationName, adminId);
  }

  async connectToServer(offerData: WebRTCServerOffer, userId: string, userName: string): Promise<void> {
    return this.methods.connectToServer(offerData, userId, userName);
  }

  getConnectionStatus(): 'disconnected' | 'connecting' | 'connected' {
    return this.methods.getConnectionStatus();
  }

  getConnectedPeers(): PeerConnection[] {
    return this.methods.getConnectedPeers();
  }

  disconnect(): void {
    this.methods.disconnect();
  }

  requestLocationFromAllClients(): void {
    this.methods.requestLocationFromAllClients();
  }

  sendLocationUpdate(locationData: any): void {
    this.methods.sendLocationUpdate(locationData);
  }

  onLocationUpdate(callback: (userId: string, locationData: any) => void): void {
    this.methods.onLocationUpdate(callback);
  }

  onPeerStatusUpdate(callback: (peers: PeerConnection[]) => void): void {
    this.methods.onPeerStatusUpdate(callback);
  }

  sendToPeer(peerId: string, message: any): void {
    this.methods.sendToPeer(peerId, message);
  }

  async startMiniServer(): Promise<any> {
    return this.methods.startMiniServer();
  }

  async stopMiniServer(): Promise<void> {
    return this.methods.stopMiniServer();
  }

  isMiniServerRunning(): boolean {
    return this.methods.isMiniServerRunning();
  }

  getMiniServerStats(): any {
    return this.methods.getMiniServerStats();
  }

  // Delegate to reconnection service
  async forceReconnect(): Promise<void> {
    await this.reconnection.forceReconnect();
    
    // Handle client reconnection case
    if (!this.core.isAdmin) {
      const lastOffer = this.core.offerManager.getLastServerOffer();
      if (lastOffer) {
        await this.connectToServer(lastOffer, this.core.userId || 'client', 'User');
      }
    }
  }

  canAutoReconnect(): boolean {
    return this.reconnection.canAutoReconnect();
  }

  getStoredClientCount(): number {
    return this.reconnection.getStoredClientCount();
  }

  isCurrentlyReconnecting(): boolean {
    return this.reconnection.isCurrentlyReconnecting();
  }

  getReconnectAttempts(): number {
    return this.reconnection.getReconnectAttempts();
  }

  getDetailedReconnectionStatus(): Map<string, any> {
    return this.reconnection.getDetailedReconnectionStatus();
  }

  // Delegate to diagnostics service
  getBrowserCompatibility(): any {
    return this.diagnostics.getBrowserCompatibility();
  }

  getDegradationLevel(): any {
    return this.diagnostics.getDegradationLevel();
  }

  getErrorHistory(): any[] {
    return this.diagnostics.getErrorHistory();
  }

  generateDiagnosticReport(): string {
    return this.diagnostics.generateDiagnosticReport();
  }

  getMeshNetworkStatus(): any {
    return this.diagnostics.getMeshNetworkStatus();
  }

  getAllAdmins(): any[] {
    return this.diagnostics.getAllAdmins();
  }

  isPrimaryAdmin(): boolean {
    return this.diagnostics.isPrimaryAdmin();
  }

  canPerformAdminActions(): boolean {
    return this.diagnostics.canPerformAdminActions();
  }

  getCurrentDeviceInfo(): any {
    return this.diagnostics.getCurrentDeviceInfo();
  }

  private setupEventManagerCallbacks(): void {
    this.eventSetup.setupEventManagerCallbacks(() => this.forceReconnect());
  }
}

export const webRTCService = new WebRTCService();
export type { WebRTCServerOffer, PeerConnection };
