
import { WebRTCServiceCore } from './WebRTCServiceCore';
import { WebRTCManagerCollection } from './WebRTCManagerCollection';
import { PersistentConnectionStorage } from './PersistentConnectionStorage';
import { DeviceIDManager, DeviceInfo } from './DeviceIDManager';
import { WebRTCServerOffer } from './types';

export class WebRTCConnectionManager {
  private core: WebRTCServiceCore;
  private managers: WebRTCManagerCollection;
  private persistentStorage: PersistentConnectionStorage;
  private currentDeviceId: string;

  constructor(
    core: WebRTCServiceCore,
    managers: WebRTCManagerCollection,
    persistentStorage: PersistentConnectionStorage,
    currentDeviceId: string
  ) {
    this.core = core;
    this.managers = managers;
    this.persistentStorage = persistentStorage;
    this.currentDeviceId = currentDeviceId;
  }

  async createServerOffer(organizationId: string, organizationName: string): Promise<WebRTCServerOffer> {
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
    
    // Update device info
    DeviceIDManager.setDeviceInfo(deviceInfo);
    
    // Update core state
    this.core.updateStates(true, this.currentDeviceId, organizationId);
    this.managers.updateManagerStates(true, organizationId);

    const serverOffer = await this.managers.serverManager.createServerOffer(
      organizationId,
      organizationName,
      this.currentDeviceId
    );

    // Test connectivity
    const canConnect = await this.core.webrtcConnection.testConnectivity();
    if (!canConnect) {
      console.warn('TURN server connectivity test failed, connections may be limited');
    }

    return serverOffer;
  }

  async connectToServer(offerData: WebRTCServerOffer, userId: string, userName: string): Promise<void> {
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
    
    // Update device info
    DeviceIDManager.setDeviceInfo(deviceInfo);

    this.core.updateStates(false, this.currentDeviceId, offerData.organizationId);
    this.managers.updateManagerStates(false, offerData.organizationId);

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
    } catch (error) {
      // Mark failed connection
      this.persistentStorage.updateConnectionAttempt(offerData.adminId, false);
      throw error;
    }
  }

  async connectToTemporaryServer(offerData: WebRTCServerOffer): Promise<void> {
    try {
      const deviceInfo = DeviceIDManager.getDeviceInfo();
      if (!deviceInfo) throw new Error('No device info available');

      await this.managers.clientManager.connectToServer(offerData, this.currentDeviceId, deviceInfo.deviceName);
      console.log('WebRTCService: Successfully connected to temporary server');
    } catch (error) {
      console.error('WebRTCService: Failed to connect to temporary server:', error);
    }
  }

  async forceReconnect(): Promise<void> {
    console.log('WebRTCService: Force reconnecting...');
    
    try {
      // Clear current connections
      this.core.connectionManager.clearPeers();
      
      // Get stored connection data
      const connections = this.persistentStorage.getStoredConnections();
      
      if (connections.length > 0) {
        const lastConnection = connections[0]; // Get most recent
        if (lastConnection.lastOfferData) {
          const deviceInfo = DeviceIDManager.getDeviceInfo();
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

  canAutoReconnect(): boolean {
    const connections = this.persistentStorage.getStoredConnections();
    return connections.length > 0;
  }

  getStoredClientCount(): number {
    const connections = this.persistentStorage.getStoredConnections();
    return connections.length;
  }
}
