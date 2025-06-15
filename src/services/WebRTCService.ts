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
import { WebRTCDiagnosticManager } from './webrtc/WebRTCDiagnosticManager';
import { WebRTCFeatureManager } from './webrtc/WebRTCFeatureManager';
import { WebRTCConnectionManager } from './webrtc/WebRTCConnectionManager';

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
  private diagnosticManager: WebRTCDiagnosticManager;
  private featureManager: WebRTCFeatureManager;
  private connectionManager: WebRTCConnectionManager;
  private currentDeviceId: string;
  private initialized = false;
  private cleanupTasks: (() => void)[] = [];

  constructor() {
    if (this.initialized) return;
    
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

    // Initialize specialized managers
    this.diagnosticManager = new WebRTCDiagnosticManager(
      this.compatibilityManager,
      this.degradationManager,
      this.persistentStorage,
      this.meshCoordinator,
      this.multiAdminManager,
      this.currentDeviceId
    );

    this.featureManager = new WebRTCFeatureManager(
      this.compatibilityManager,
      this.degradationManager
    );

    this.connectionManager = new WebRTCConnectionManager(
      this.core,
      this.managers,
      this.persistentStorage,
      this.currentDeviceId
    );

    // Initialize integration layer
    this.integration = new WebRTCServiceIntegration(
      this.core,
      this.meshCoordinator,
      this.multiAdminManager
    );

    // Lazy initialization of heavy components
    this.setupLazyInitialization();
    this.initialized = true;

    // Clean expired connections on startup
    this.persistentStorage.clearExpiredConnections();
    
    // Log browser compatibility once
    const compatibility = this.compatibilityManager.getBrowserInfo();
    if (compatibility.limitations.length > 0) {
      console.warn('Browser limitations detected:', compatibility.limitations);
    }
  }

  private setupLazyInitialization(): void {
    // Setup enhanced monitoring only when needed
    let monitoringInitialized = false;
    const initializeMonitoring = () => {
      if (monitoringInitialized) return;
      this.setupEnhancedMonitoring();
      this.setupMeshNetworking();
      this.setupAndroidOptimizations();
      this.managers.setupEventManagerCallbacks(this.core);
      monitoringInitialized = true;
    };

    // Initialize monitoring on first real usage
    const originalCreateServerOffer = this.createServerOffer.bind(this);
    const originalConnectToServer = this.connectToServer.bind(this);

    this.createServerOffer = async (...args) => {
      initializeMonitoring();
      return originalCreateServerOffer(...args);
    };

    this.connectToServer = async (...args) => {
      initializeMonitoring();
      return originalConnectToServer(...args);
    };

    // Listen for admin online broadcasts (if not admin)
    this.broadcastManager.registerAdminOnlineListener(() => {
      this.longPollManager.stopLongPollReconnect();
      this.forceReconnect();
    });

    // Add throttled event listeners for robust client-side reconnection
    this.eventListeners.setupEventListeners(
      this.throttle(this.forceReconnect.bind(this), 2000),
      this.throttle(this.handlePermanentConnectionLoss.bind(this), 5000)
    );
  }

  private setupAndroidOptimizations(): void {
    if (this.androidOptimizer.isAndroidEnvironment()) {
      console.log('WebRTCService: Android environment detected, applying optimizations');
      
      // Apply Android-specific optimizations
      this.androidOptimizer.handleAndroidNetworkChanges();
      
      // Throttled event listeners for Android-specific events
      const handleNetworkChange = this.throttle((event: CustomEvent) => {
        console.log('WebRTCService: Android network change:', event.detail);
        this.handleNetworkChange(event.detail);
      }, 3000);

      const handleAppBackgrounded = this.throttle(() => {
        console.log('WebRTCService: App backgrounded, reducing activity');
        this.handleAppBackgrounded();
      }, 1000);

      const handleAppForegrounded = this.throttle(() => {
        console.log('WebRTCService: App foregrounded, resuming activity');
        this.handleAppForegrounded();
      }, 1000);

      window.addEventListener('android-network-change', handleNetworkChange);
      window.addEventListener('android-app-backgrounded', handleAppBackgrounded);
      window.addEventListener('android-app-foregrounded', handleAppForegrounded);

      // Store cleanup tasks
      this.cleanupTasks.push(() => {
        window.removeEventListener('android-network-change', handleNetworkChange);
        window.removeEventListener('android-app-backgrounded', handleAppBackgrounded);
        window.removeEventListener('android-app-foregrounded', handleAppForegrounded);
      });
    }
  }

  private handleNetworkChange(networkInfo: any): void {
    // Adjust connection parameters based on network type
    if (networkInfo.effectiveType === 'slow-2g' || networkInfo.effectiveType === '2g') {
      this.degradationManager.setDegradationLevel('minimal');
    } else if (networkInfo.effectiveType === '3g') {
      this.degradationManager.setDegradationLevel('limited');
    } else {
      this.degradationManager.setDegradationLevel('full');
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
        await this.connectionManager.connectToTemporaryServer(serverOffer);
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

  private throttle<T extends (...args: any[]) => any>(func: T, delay: number): T {
    let inThrottle: boolean;
    return ((...args: any[]) => {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, delay);
      }
    }) as T;
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

    this.broadcastManager.setOrganizationId(organizationId);

    // Start mesh coordination
    this.meshCoordinator.startCoordination(organizationId);
    this.multiAdminManager.startMultiAdminCoordination(organizationId);

    const serverOffer = await this.connectionManager.createServerOffer(organizationId, organizationName);

    this.setupConnectionHandlers();
    this.managers.eventManager.setupIPChangeHandling();

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

    this.broadcastManager.setOrganizationId(offerData.organizationId);

    // Start mesh coordination
    this.meshCoordinator.startCoordination(offerData.organizationId);

    try {
      await this.connectionManager.connectToServer(offerData, userId, userName);
      
      this.setupConnectionHandlers();
      this.managers.eventManager.setupIPChangeHandling();

      // Notify mesh coordinator about successful connection
      const deviceInfo = DeviceIDManager.getDeviceInfo();
      if (deviceInfo) {
        this.meshCoordinator.addDeviceToMesh(deviceInfo);
      }
    } catch (error) {
      throw error;
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

  // Public API methods
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

  // Status and state methods
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

  // Feature availability checks
  isFeatureAvailable(feature: 'realTimeLocation' | 'videoCapabilities' | 'fileTransfer' | 'voiceChat' | 'instantMessaging'): boolean {
    return this.featureManager.isFeatureAvailable(feature);
  }

  getFeatureMessage(feature: 'realTimeLocation' | 'videoCapabilities' | 'fileTransfer' | 'voiceChat' | 'instantMessaging'): string {
    return this.featureManager.getFeatureMessage(feature);
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

  // Diagnostic methods
  getBrowserCompatibility() {
    return this.diagnosticManager.getBrowserCompatibility();
  }

  getConnectionHealth() {
    const healthMonitor = this.core.webrtcConnection.getHealthMonitor();
    return this.diagnosticManager.getConnectionHealth(healthMonitor);
  }

  getDegradationLevel() {
    return this.diagnosticManager.getDegradationLevel();
  }

  getErrorHistory() {
    return this.diagnosticManager.getErrorHistory(this.core.webrtcConnection.getErrorManager());
  }

  getStoredConnections() {
    return this.diagnosticManager.getStoredConnections();
  }

  generateDiagnosticReport(): string {
    return this.diagnosticManager.generateDiagnosticReport(this.core.webrtcConnection.getErrorManager());
  }

  // Enhanced state management
  syncWithMiniServer(): void {
    this.integration.syncStateWithMiniServer();
  }

  // Connection management
  async forceReconnect(): Promise<void> {
    return this.connectionManager.forceReconnect();
  }

  disconnect(): void {
    console.log('WebRTCService: Disconnecting...');
    
    // Run all cleanup tasks
    this.cleanupTasks.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.warn('Cleanup task failed:', error);
      }
    });
    this.cleanupTasks = [];

    this.core.cleanup();
    this.meshCoordinator.cleanup();
    this.multiAdminManager.cleanup();
  }

  cleanup(): void {
    this.disconnect();
  }

  // Enhanced reconnection capabilities
  canAutoReconnect(): boolean {
    return this.connectionManager.canAutoReconnect();
  }

  getStoredClientCount(): number {
    return this.connectionManager.getStoredClientCount();
  }
}

// Export types and main service
export type { WebRTCServerOffer, WebRTCMessage, PeerConnection, DeviceInfo };

const webRTCService = new WebRTCService();
export { webRTCService };
export default webRTCService;
