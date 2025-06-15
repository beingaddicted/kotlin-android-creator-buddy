import { WebRTCServerOffer, WebRTCMessage, PeerConnection } from './webrtc/types';
import { SignalingMessage } from './webrtc/SignalingService';
import { WebRTCServiceCore } from './webrtc/WebRTCServiceCore';
import { WebRTCManagerCollection } from './webrtc/WebRTCManagerCollection';
import { WebRTCBroadcastManager } from './webrtc/WebRTCBroadcastManager';
import { WebRTCLongPollManager } from './webrtc/WebRTCLongPollManager';
import { WebRTCEventListeners } from './webrtc/WebRTCEventListeners';
import { WebRTCStatusManager } from './webrtc/WebRTCStatusManager';
import { GracefulDegradationManager } from './webrtc/GracefulDegradationManager';
import { BrowserCompatibilityManager } from './webrtc/BrowserCompatibilityManager';
import { PersistentConnectionStorage } from './webrtc/PersistentConnectionStorage';
import { DeviceIDManager, DeviceInfo } from './webrtc/DeviceIDManager';
import { MeshNetworkCoordinator } from './webrtc/MeshNetworkCoordinator';
import { MultiAdminManager } from './webrtc/MultiAdminManager';
import { WebRTCServiceIntegration } from './webrtc/WebRTCServiceIntegration';
import { AndroidWebRTCOptimizer } from './webrtc/AndroidWebRTCOptimizer';

class WebRTCService {
  private core: WebRTCServiceCore;
  private managers: WebRTCManagerCollection;
  private broadcastManager: WebRTCBroadcastManager;
  private longPollManager: WebRTCLongPollManager;
  private eventListeners: WebRTCEventListeners;
  private statusManager: WebRTCStatusManager;
  private degradationManager: GracefulDegradationManager;
  private compatibilityManager: BrowserCompatibilityManager;
  private persistentStorage: PersistentConnectionStorage;
  private meshCoordinator: MeshNetworkCoordinator;
  private multiAdminManager: MultiAdminManager;
  private integration: WebRTCServiceIntegration;
  private androidOptimizer: AndroidWebRTCOptimizer;
  private currentDeviceId: string;

  constructor() {
    // Initialize device ID first
    this.currentDeviceId = DeviceIDManager.getOrCreateDeviceId();
    
    this.core = new WebRTCServiceCore();
    this.managers = new WebRTCManagerCollection(this.core);
    this.broadcastManager = new WebRTCBroadcastManager();
    this.longPollManager = new WebRTCLongPollManager();
    this.eventListeners = new WebRTCEventListeners();
    this.statusManager = new WebRTCStatusManager(this.core);
    this.degradationManager = new GracefulDegradationManager();
    this.compatibilityManager = new BrowserCompatibilityManager();
    this.persistentStorage = new PersistentConnectionStorage();
    this.meshCoordinator = new MeshNetworkCoordinator();
    this.multiAdminManager = new MultiAdminManager();
    this.androidOptimizer = AndroidWebRTCOptimizer.getInstance();

    // Initialize integration layer
    this.integration = new WebRTCServiceIntegration(
      this.core,
      this.meshCoordinator,
      this.multiAdminManager
    );

    this.setupEnhancedMonitoring();
    this.setupMeshNetworking();
    this.setupAndroidOptimizations();
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

    // Clean expired connections on startup
    this.persistentStorage.clearExpiredConnections();
    
    // Log browser compatibility
    const compatibility = this.compatibilityManager.getBrowserInfo();
    if (compatibility.limitations.length > 0) {
      console.warn('Browser limitations detected:', compatibility.limitations);
    }
  }

  private setupAndroidOptimizations(): void {
    if (this.androidOptimizer.isAndroidEnvironment()) {
      console.log('WebRTCService: Android environment detected, applying optimizations');
      
      // Apply Android-specific optimizations
      this.androidOptimizer.handleAndroidNetworkChanges();
      
      // Listen for Android-specific events
      window.addEventListener('android-network-change', (event: CustomEvent) => {
        console.log('WebRTCService: Android network change:', event.detail);
        this.handleNetworkChange(event.detail);
      });

      window.addEventListener('android-app-backgrounded', () => {
        console.log('WebRTCService: App backgrounded, reducing activity');
        this.handleAppBackgrounded();
      });

      window.addEventListener('android-app-foregrounded', () => {
        console.log('WebRTCService: App foregrounded, resuming activity');
        this.handleAppForegrounded();
      });
    }
  }

  private handleNetworkChange(networkInfo: any): void {
    // Adjust connection parameters based on network type
    if (networkInfo.effectiveType === 'slow-2g' || networkInfo.effectiveType === '2g') {
      this.degradationManager.setDegradationLevel('minimal');
    } else if (networkInfo.effectiveType === '3g') {
      this.degradationManager.setDegradationLevel('reduced');
    } else {
      this.degradationManager.setDegradationLevel('none');
    }
  }

  private handleAppBackgrounded(): void {
    // Reduce heartbeat frequency when app is backgrounded
    const event = new CustomEvent('webrtc-reduce-activity');
    window.dispatchEvent(event);
  }

  private handleAppForegrounded(): void {
    // Resume normal activity when app is foregrounded
    const event = new CustomEvent('webrtc-resume-activity');
    window.dispatchEvent(event);
    
    // Check connection status and reconnect if needed
    if (this.getConnectionStatus() === 'disconnected') {
      this.forceReconnect();
    }
  }

  private setupEnhancedMonitoring(): void {
    // Setup connection health monitoring
    const connection = this.core.webrtcConnection.getConnection();
    if (connection) {
      const healthMonitor = this.core.webrtcConnection.getHealthMonitor();
      healthMonitor.onHealthUpdate((health) => {
        this.degradationManager.assessConnectionQuality(health);
        
        // Emit health update event
        const event = new CustomEvent('webrtc-health-update', { detail: health });
        window.dispatchEvent(event);
      });
    }

    // Setup degradation monitoring
    this.degradationManager.onDegradationChange((level) => {
      console.log('Service degradation level changed:', level.level);
      const event = new CustomEvent('webrtc-degradation-change', { detail: level });
      window.dispatchEvent(event);
    });

    // Setup error monitoring
    const errorManager = this.core.webrtcConnection.getErrorManager();
    errorManager.onError((error) => {
      console.error('WebRTC service error:', error);
      const event = new CustomEvent('webrtc-service-error', { detail: error });
      window.dispatchEvent(event);
    });
  }

  private setupMeshNetworking(): void {
    // Setup mesh network coordination
    this.meshCoordinator.onPromoteToTemporaryServer(async () => {
      console.log('WebRTCService: Promoting to temporary server');
      this.integration.handleMiniServerPromotion();
      
      // Get current organization from device info
      const deviceInfo = DeviceIDManager.getDeviceInfo();
      if (!deviceInfo) throw new Error('No device info available');
      
      return await this.createServerOffer(deviceInfo.organizationId, `Temp Server ${this.currentDeviceId.slice(-4)}`);
    });

    this.meshCoordinator.onDemoteFromTemporaryServer(() => {
      console.log('WebRTCService: Demoting from temporary server');
      this.integration.handleMiniServerDemotion();
      this.managers.serverManager.deactivateServer();
    });

    // Setup multi-admin coordination
    this.multiAdminManager.onAdminStatusUpdate((admins) => {
      const event = new CustomEvent('webrtc-admin-status-update', { detail: { admins } });
      window.dispatchEvent(event);
    });

    // Listen for temporary server offers
    window.addEventListener('webrtc-temporary-server-offer', async (event: CustomEvent) => {
      const { serverOffer, serverId } = event.detail;
      
      // Only connect if we're not an admin and not the server itself
      if (!DeviceIDManager.isAdmin() && serverId !== this.currentDeviceId) {
        console.log('WebRTCService: Connecting to temporary server:', serverId);
        await this.connectToTemporaryServer(serverOffer);
      }
    });

    // Listen for admin reconnection
    window.addEventListener('webrtc-admin-reconnected', () => {
      console.log('WebRTCService: Admin reconnected, switching back to admin server');
      this.handleAdminReconnection();
    });

    // Listen for admin election events from mini-server
    window.addEventListener('webrtc-admin-elected', (event: CustomEvent) => {
      const { adminId, isOwnDevice } = event.detail;
      this.integration.handleAdminElectionResult(adminId, isOwnDevice);
    });
  }

  async createServerOffer(organizationId: string, organizationName: string): Promise<WebRTCServerOffer> {
    // Check browser compatibility first
    if (!this.compatibilityManager.isFeatureSupported('webrtc')) {
      throw new Error('WebRTC is not supported in this browser. Please use a modern browser.');
    }

    // Apply Android optimizations if needed
    let rtcConfig = {};
    if (this.androidOptimizer.isAndroidEnvironment()) {
      rtcConfig = this.androidOptimizer.optimizeForAndroid();
    }

    // Initialize device info as admin
    const deviceInfo: DeviceInfo = {
      deviceId: this.currentDeviceId,
      deviceType: 'admin',
      deviceName: organizationName,
      organizationId,
      isTemporaryServer: false,
      lastSeen: Date.now(),
      capabilities: ['location.view', 'admin.manage']
    };
    this.integration.updateDeviceInfo(deviceInfo);

    this.core.updateStates(true, this.currentDeviceId, organizationId);
    this.managers.updateManagerStates(true, organizationId);
    this.broadcastManager.setOrganizationId(organizationId);

    // Start mesh coordination
    this.meshCoordinator.startCoordination(organizationId);
    this.multiAdminManager.startMultiAdminCoordination(organizationId);

    const serverOffer = await this.managers.serverManager.createServerOffer(
      organizationId,
      organizationName,
      this.currentDeviceId
    );

    this.setupConnectionHandlers();
    this.managers.eventManager.setupIPChangeHandling();

    // Test connectivity
    const canConnect = await this.core.webrtcConnection.testConnectivity();
    if (!canConnect) {
      console.warn('TURN server connectivity test failed, connections may be limited');
    }

    // Broadcast admin presence so clients reconnect
    if (this.core.isAdmin) {
      this.broadcastManager.broadcastAdminOnline();
    }

    return serverOffer;
  }

  async connectToServer(offerData: WebRTCServerOffer, userId: string, userName: string): Promise<void> {
    // Check browser compatibility
    if (!this.compatibilityManager.isFeatureSupported('webrtc')) {
      throw new Error('WebRTC is not supported in this browser. Please use a modern browser.');
    }

    // Initialize device info as client
    const deviceInfo: DeviceInfo = {
      deviceId: this.currentDeviceId,
      deviceType: 'client',
      deviceName: userName,
      organizationId: offerData.organizationId,
      isTemporaryServer: false,
      lastSeen: Date.now(),
      capabilities: ['location.share']
    };
    this.integration.updateDeviceInfo(deviceInfo);

    this.core.updateStates(false, this.currentDeviceId, offerData.organizationId);
    this.managers.updateManagerStates(false, offerData.organizationId);
    this.broadcastManager.setOrganizationId(offerData.organizationId);

    // Start mesh coordination
    this.meshCoordinator.startCoordination(offerData.organizationId);

    // Store connection data for persistence
    this.persistentStorage.storeConnection({
      peerId: offerData.adminId,
      peerName: offerData.organizationName,
      organizationId: offerData.organizationId,
      lastOfferData: offerData
    });

    try {
      await this.managers.clientManager.connectToServer(offerData, this.currentDeviceId, userName);
      
      // Mark successful connection
      this.persistentStorage.updateConnectionAttempt(offerData.adminId, true);
      
      this.setupConnectionHandlers();
      this.managers.eventManager.setupIPChangeHandling();

      // Notify mesh coordinator about successful connection
      this.meshCoordinator.addDeviceToMesh(deviceInfo);
    } catch (error) {
      // Mark failed connection
      this.persistentStorage.updateConnectionAttempt(offerData.adminId, false);
      throw error;
    }
  }

  private async connectToTemporaryServer(offerData: WebRTCServerOffer): Promise<void> {
    try {
      const deviceInfo = DeviceIDManager.getDeviceInfo();
      if (!deviceInfo) throw new Error('No device info available');

      await this.managers.clientManager.connectToServer(offerData, this.currentDeviceId, deviceInfo.deviceName);
      console.log('WebRTCService: Successfully connected to temporary server');
    } catch (error) {
      console.error('WebRTCService: Failed to connect to temporary server:', error);
    }
  }

  private handleAdminReconnection(): void {
    // If we were a temporary server, stop serving
    if (DeviceIDManager.isTemporaryServer()) {
      this.managers.serverManager.deactivateServer();
      this.integration.handleMiniServerDemotion();
    }

    // Attempt to reconnect to the admin
    this.forceReconnect();
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
    // Only admins can approve join requests
    if (!this.canPerformAdminActions()) return;

    const message = {
      type: 'join-response',
      data: { approved }
    };

    this.sendToPeer(peerId, message);
  }

  requestLocationFromClient(clientId: string): void {
    if (!this.canPerformAdminActions()) return;
    this.managers.serverManager.requestLocationFromClient(clientId);
  }

  requestLocationFromAllClients(): void {
    if (!this.canPerformAdminActions()) return;
    this.managers.serverManager.requestLocationFromAllClients();
  }

  sendToPeer(peerId: string, data: any): void {
    if (!this.canPerformAdminActions()) {
      console.warn('Only admin can send data to a specific peer.');
      return;
    }
    this.managers.serverManager.sendToPeer(peerId, data);
  }

  sendLocationUpdate(locationData: any): void {
    if (this.canPerformAdminActions()) return;
    this.managers.clientManager.sendLocationUpdate(locationData);
  }

  onLocationUpdate(callback: (userId: string, location: any) => void): void {
    // Only admins can receive location updates
    if (this.canAccessLocationData()) {
      this.core.connectionManager.onLocationUpdate(callback);
    }
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
    if (!this.canPerformAdminActions()) {
        console.log('Client connection permanently lost, starting enhanced reconnection strategy.');
        
        // Set degradation to minimal while attempting reconnection
        this.degradationManager.setDegradationLevel('minimal');
        
        this.longPollManager.startLongPollReconnect(
          () => this.getConnectionStatus(),
          () => this.forceReconnect()
        );
    }
  }

  // Enhanced feature availability checks
  isFeatureAvailable(feature: 'realTimeLocation' | 'videoCapabilities' | 'fileTransfer' | 'voiceChat' | 'instantMessaging'): boolean {
    // Check browser capability first
    if (feature === 'videoCapabilities' && !this.compatibilityManager.isFeatureSupported('mediaDevices')) {
      return false;
    }
    
    // Check degradation level
    return this.degradationManager.isFeatureAvailable(feature);
  }

  getFeatureMessage(feature: 'realTimeLocation' | 'videoCapabilities' | 'fileTransfer' | 'voiceChat' | 'instantMessaging'): string {
    // Check browser limitations first
    const browserLimitations = this.compatibilityManager.getLimitations();
    const relevantLimitation = browserLimitations.find(limitation => 
      limitation.toLowerCase().includes(feature.toLowerCase())
    );
    
    if (relevantLimitation) {
      return relevantLimitation;
    }
    
    return this.degradationManager.getFeatureMessage(feature);
  }

  // Device and permission methods
  getCurrentDeviceId(): string {
    return this.integration.getCurrentDeviceId();
  }

  getCurrentDeviceInfo(): DeviceInfo | null {
    return this.integration.getCurrentDeviceInfo();
  }

  canPerformAdminActions(): boolean {
    return this.integration.canPerformAdminActions();
  }

  canAccessLocationData(): boolean {
    return this.integration.canAccessLocationData();
  }

  isPrimaryAdmin(): boolean {
    return this.integration.isPrimaryAdmin();
  }

  getAllAdmins(): any[] {
    return this.integration.getAllAdmins();
  }

  getMeshNetworkStatus(): any {
    return this.integration.getMeshNetworkStatus();
  }

  // New diagnostic methods
  getBrowserCompatibility() {
    return this.compatibilityManager.getBrowserInfo();
  }

  getConnectionHealth() {
    const healthMonitor = this.core.webrtcConnection.getHealthMonitor();
    return healthMonitor ? healthMonitor.getCurrentHealth() : null;
  }

  getDegradationLevel() {
    return this.degradationManager.getCurrentLevel();
  }

  getErrorHistory() {
    return this.core.webrtcConnection.getErrorManager().getErrorHistory();
  }

  getStoredConnections() {
    return this.persistentStorage.getStoredConnections();
  }

  generateDiagnosticReport(): string {
    const compatibility = this.compatibilityManager.generateCompatibilityReport();
    const degradation = this.degradationManager.getCurrentLevel();
    const errors = this.core.webrtcConnection.getErrorManager().getRecurringErrors();
    const connections = this.persistentStorage.getStoredConnections();
    const meshStatus = this.meshCoordinator.getNetworkStatus();
    const adminDevices = this.multiAdminManager.getAllAdmins();
    
    let report = compatibility;
    report += `\n\nService Status:\n`;
    report += `==============\n`;
    report += `Device ID: ${this.currentDeviceId}\n`;
    report += `Device Type: ${DeviceIDManager.getDeviceInfo()?.deviceType || 'unknown'}\n`;
    report += `Is Temporary Server: ${DeviceIDManager.isTemporaryServer()}\n`;
    report += `Degradation Level: ${degradation.level}\n`;
    report += `Active Features: ${Object.entries(degradation.features).filter(([,v]) => v).map(([k]) => k).join(', ')}\n`;
    
    report += `\n\nMesh Network Status:\n`;
    report += `===================\n`;
    report += `Has Active Admin: ${meshStatus.hasActiveAdmin}\n`;
    report += `Temporary Server: ${meshStatus.temporaryServerId || 'None'}\n`;
    report += `Connected Devices: ${meshStatus.connectedDevices.length}\n`;
    
    report += `\n\nAdmin Devices:\n`;
    report += `==============\n`;
    adminDevices.forEach(admin => {
      report += `  • ${admin.deviceId} (${admin.isPrimary ? 'Primary' : 'Secondary'})\n`;
    });
    
    if (errors.length > 0) {
      report += `\nRecurring Errors:\n`;
      errors.forEach(error => {
        report += `  • ${error.code}: ${error.count} occurrences\n`;
      });
    }
    
    report += `\nStored Connections: ${connections.length}\n`;
    
    return report;
  }

  // Enhanced state management
  syncWithMiniServer(): void {
    this.integration.syncStateWithMiniServer();
  }

  // Connection management
  async forceReconnect(): Promise<void> {
    console.log('WebRTCService: Force reconnecting...');
    
    try {
      // Clear current connections
      this.core.connectionManager.clearPeers();
      
      // Get stored connection data
      const connections = this.persistentStorage.getAllConnections();
      
      if (connections.length > 0) {
        const lastConnection = connections[0]; // Get most recent
        if (lastConnection.lastOfferData) {
          const deviceInfo = this.getCurrentDeviceInfo();
          if (deviceInfo) {
            await this.connectToServer(
              lastConnection.lastOfferData,
              deviceInfo.deviceId,
              deviceInfo.deviceName
            );
          }
        }
      }
    } catch (error) {
      console.error('WebRTCService: Force reconnect failed:', error);
      throw error;
    }
  }

  disconnect(): void {
    console.log('WebRTCService: Disconnecting...');
    this.core.cleanup();
    this.meshCoordinator.cleanup();
    this.multiAdminManager.cleanup();
  }

  cleanup(): void {
    this.disconnect();
  }

  // Enhanced reconnection capabilities
  canAutoReconnect(): boolean {
    const connections = this.persistentStorage.getAllConnections();
    return connections.length > 0;
  }

  getStoredClientCount(): number {
    const connections = this.persistentStorage.getAllConnections();
    return connections.length;
  }
}

// Export types and main service
export { WebRTCServerOffer, WebRTCMessage, PeerConnection };
export type { DeviceInfo };

const webRTCService = new WebRTCService();
export { webRTCService };
export default webRTCService;
