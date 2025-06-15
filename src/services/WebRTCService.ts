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

  constructor() {
    this.core = new WebRTCServiceCore();
    this.managers = new WebRTCManagerCollection(this.core);
    this.broadcastManager = new WebRTCBroadcastManager();
    this.longPollManager = new WebRTCLongPollManager();
    this.eventListeners = new WebRTCEventListeners();
    this.statusManager = new WebRTCStatusManager(this.core);
    this.degradationManager = new GracefulDegradationManager();
    this.compatibilityManager = new BrowserCompatibilityManager();
    this.persistentStorage = new PersistentConnectionStorage();

    this.setupEnhancedMonitoring();
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

  async createServerOffer(organizationId: string, organizationName: string): Promise<WebRTCServerOffer> {
    // Check browser compatibility first
    if (!this.compatibilityManager.isFeatureSupported('webrtc')) {
      throw new Error('WebRTC is not supported in this browser. Please use a modern browser.');
    }

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

    this.core.updateStates(false, userId, offerData.organizationId);
    this.managers.updateManagerStates(false, offerData.organizationId);
    this.broadcastManager.setOrganizationId(offerData.organizationId);

    // Store connection data for persistence
    this.persistentStorage.storeConnection({
      peerId: offerData.adminId,
      peerName: offerData.organizationName,
      organizationId: offerData.organizationId,
      lastOfferData: offerData
    });

    try {
      await this.managers.clientManager.connectToServer(offerData, userId, userName);
      
      // Mark successful connection
      this.persistentStorage.updateConnectionAttempt(offerData.adminId, true);
      
      this.setupConnectionHandlers();
      this.managers.eventManager.setupIPChangeHandling();
    } catch (error) {
      // Mark failed connection
      this.persistentStorage.updateConnectionAttempt(offerData.adminId, false);
      throw error;
    }
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

  // New diagnostic methods
  getBrowserCompatibility() {
    return this.compatibilityManager.getBrowserInfo();
  }

  getConnectionHealth() {
    const healthMonitor = this.core.webrtcConnection.getHealthMonitor();
    // Health monitoring would need to be enhanced to provide current health
    return null; // Placeholder - would return current health metrics
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
    
    let report = compatibility;
    report += `\n\nService Status:\n`;
    report += `==============\n`;
    report += `Degradation Level: ${degradation.level}\n`;
    report += `Active Features: ${Object.entries(degradation.features).filter(([,v]) => v).map(([k]) => k).join(', ')}\n`;
    
    if (errors.length > 0) {
      report += `\nRecurring Errors:\n`;
      errors.forEach(error => {
        report += `  • ${error.code}: ${error.count} occurrences\n`;
      });
    }
    
    report += `\nStored Connections: ${connections.length}\n`;
    
    return report;
  }

  // Cleanup with enhanced managers
  disconnect(): void {
    this.core.cleanup();
    this.longPollManager.cleanup();
    this.broadcastManager.cleanup();
    this.eventListeners.cleanup();
    this.degradationManager.cleanup();
    
    // Reset to full features for next connection
    this.degradationManager.setDegradationLevel('full');
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
