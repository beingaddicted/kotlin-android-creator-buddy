
import { DeviceIDManager, DeviceInfo } from './DeviceIDManager';
import { WebRTCServerOffer } from './types';
import { MiniServerBridge } from './MiniServerBridge';

export interface MeshNetworkStatus {
  hasActiveAdmin: boolean;
  temporaryServerId: string | null;
  connectedDevices: DeviceInfo[];
  meshTopology: Map<string, string[]>; // deviceId -> connected peers
}

export class MeshNetworkCoordinator {
  private networkStatus: MeshNetworkStatus;
  private adminHeartbeatInterval: NodeJS.Timeout | null = null;
  private lastAdminSeen: number = 0;
  private onNetworkStatusChange?: (status: MeshNetworkStatus) => void;
  private onPromoteToServer?: () => Promise<WebRTCServerOffer>;
  private onDemoteFromServer?: () => void;
  private miniServerBridge: MiniServerBridge;
  private organizationId: string | null = null;

  constructor() {
    this.networkStatus = {
      hasActiveAdmin: false,
      temporaryServerId: null,
      connectedDevices: [],
      meshTopology: new Map()
    };
    
    this.miniServerBridge = new MiniServerBridge();
    this.setupMiniServerCallbacks();
  }

  private setupMiniServerCallbacks(): void {
    this.miniServerBridge.onServerOfferReady((offer) => {
      // Broadcast the new mini server offer to all devices
      this.broadcastTemporaryServerOffer(offer);
    });
  }

  startCoordination(organizationId: string): void {
    console.log('MeshNetworkCoordinator: Starting coordination for org:', organizationId);
    this.organizationId = organizationId;
    
    // Start monitoring admin presence
    this.startAdminHeartbeatMonitoring();
    
    // Listen for admin presence broadcasts
    this.setupAdminPresenceListener();
    
    // Set up mesh network event handlers
    this.setupMeshEventHandlers();
  }

  private startAdminHeartbeatMonitoring(): void {
    this.adminHeartbeatInterval = setInterval(() => {
      const timeSinceLastAdmin = Date.now() - this.lastAdminSeen;
      const adminTimeout = 15000; // 15 seconds
      
      if (this.networkStatus.hasActiveAdmin && timeSinceLastAdmin > adminTimeout) {
        console.log('MeshNetworkCoordinator: Admin timeout detected');
        this.handleAdminDisconnection();
      }
    }, 5000);
  }

  private setupAdminPresenceListener(): void {
    window.addEventListener('webrtc-admin-heartbeat', (event: CustomEvent) => {
      this.lastAdminSeen = Date.now();
      
      if (!this.networkStatus.hasActiveAdmin) {
        console.log('MeshNetworkCoordinator: Admin presence detected');
        this.handleAdminReconnection();
      }
      
      this.networkStatus.hasActiveAdmin = true;
      this.notifyStatusChange();
    });
  }

  private setupMeshEventHandlers(): void {
    window.addEventListener('webrtc-device-connected', (event: CustomEvent) => {
      this.addDeviceToMesh(event.detail.deviceInfo);
    });

    window.addEventListener('webrtc-device-disconnected', (event: CustomEvent) => {
      this.removeDeviceFromMesh(event.detail.deviceId);
    });

    window.addEventListener('webrtc-temporary-server-request', async (event: CustomEvent) => {
      if (this.shouldBecomeTemporaryServer()) {
        await this.promoteToTemporaryServer();
      }
    });
  }

  private handleAdminDisconnection(): void {
    console.log('MeshNetworkCoordinator: Handling admin disconnection');
    this.networkStatus.hasActiveAdmin = false;
    
    // If no temporary server exists and we have connected devices
    if (!this.networkStatus.temporaryServerId && this.networkStatus.connectedDevices.length > 0) {
      // Trigger temporary server election
      this.triggerTemporaryServerElection();
    }
    
    this.notifyStatusChange();
  }

  private handleAdminReconnection(): void {
    console.log('MeshNetworkCoordinator: Handling admin reconnection');
    
    // If we were a temporary server, demote ourselves
    if (DeviceIDManager.isTemporaryServer()) {
      this.demoteFromTemporaryServer();
    }
    
    // Notify all devices that admin is back
    this.broadcastAdminReconnection();
    
    this.networkStatus.hasActiveAdmin = true;
    this.networkStatus.temporaryServerId = null;
    this.notifyStatusChange();
  }

  private triggerTemporaryServerElection(): void {
    console.log('MeshNetworkCoordinator: Triggering temporary server election');
    
    // Simple election: device with most connections becomes server
    // In case of tie, device with earliest timestamp wins
    const currentDeviceId = DeviceIDManager.getOrCreateDeviceId();
    const currentConnections = this.networkStatus.meshTopology.get(currentDeviceId)?.length || 0;
    
    let shouldBecomeServer = true;
    
    for (const [deviceId, connections] of this.networkStatus.meshTopology) {
      if (deviceId !== currentDeviceId) {
        if (connections.length > currentConnections) {
          shouldBecomeServer = false;
          break;
        } else if (connections.length === currentConnections && deviceId < currentDeviceId) {
          shouldBecomeServer = false;
          break;
        }
      }
    }
    
    if (shouldBecomeServer) {
      setTimeout(() => this.promoteToTemporaryServer(), 1000);
    }
  }

  private shouldBecomeTemporaryServer(): boolean {
    // Don't become server if already one exists or if we're already admin
    return !this.networkStatus.temporaryServerId && 
           !this.networkStatus.hasActiveAdmin && 
           !DeviceIDManager.isAdmin() &&
           !this.miniServerBridge.isServerRunning();
  }

  private async promoteToTemporaryServer(): Promise<void> {
    console.log('MeshNetworkCoordinator: Promoting to temporary server');
    
    if (!this.organizationId) {
      console.error('Cannot promote to temporary server: no organization ID');
      return;
    }
    
    try {
      const serverOffer = await this.miniServerBridge.startMiniServer(this.organizationId);
      
      this.networkStatus.temporaryServerId = DeviceIDManager.getOrCreateDeviceId();
      
      // Broadcast new server offer to all connected devices
      this.broadcastTemporaryServerOffer(serverOffer);
      
      this.notifyStatusChange();
    } catch (error) {
      console.error('MeshNetworkCoordinator: Failed to promote to temporary server:', error);
    }
  }

  private async demoteFromTemporaryServer(): Promise<void> {
    console.log('MeshNetworkCoordinator: Demoting from temporary server');
    
    await this.miniServerBridge.stopMiniServer();
    this.networkStatus.temporaryServerId = null;
    
    this.notifyStatusChange();
  }

  private broadcastTemporaryServerOffer(serverOffer: WebRTCServerOffer): void {
    const event = new CustomEvent('webrtc-temporary-server-offer', {
      detail: { serverOffer, serverId: DeviceIDManager.getOrCreateDeviceId() }
    });
    window.dispatchEvent(event);
  }

  private broadcastAdminReconnection(): void {
    const event = new CustomEvent('webrtc-admin-reconnected');
    window.dispatchEvent(event);
  }

  addDeviceToMesh(deviceInfo: DeviceInfo): void {
    const existingIndex = this.networkStatus.connectedDevices.findIndex(d => d.deviceId === deviceInfo.deviceId);
    
    if (existingIndex >= 0) {
      this.networkStatus.connectedDevices[existingIndex] = deviceInfo;
    } else {
      this.networkStatus.connectedDevices.push(deviceInfo);
    }
    
    this.notifyStatusChange();
  }

  removeDeviceFromMesh(deviceId: string): void {
    this.networkStatus.connectedDevices = this.networkStatus.connectedDevices.filter(d => d.deviceId !== deviceId);
    this.networkStatus.meshTopology.delete(deviceId);
    
    // Remove this device from other devices' connections
    this.networkStatus.meshTopology.forEach((connections, id) => {
      this.networkStatus.meshTopology.set(id, connections.filter(c => c !== deviceId));
    });
    
    this.notifyStatusChange();
  }

  updateMeshTopology(deviceId: string, connectedPeers: string[]): void {
    this.networkStatus.meshTopology.set(deviceId, connectedPeers);
    this.notifyStatusChange();
  }

  getNetworkStatus(): MeshNetworkStatus {
    return { ...this.networkStatus };
  }

  getMiniServerStats(): any {
    return this.miniServerBridge.getServerStats();
  }

  onNetworkStatusUpdate(callback: (status: MeshNetworkStatus) => void): void {
    this.onNetworkStatusChange = callback;
  }

  onPromoteToTemporaryServer(callback: () => Promise<WebRTCServerOffer>): void {
    this.onPromoteToServer = callback;
  }

  onDemoteFromTemporaryServer(callback: () => void): void {
    this.onDemoteFromServer = callback;
  }

  private notifyStatusChange(): void {
    if (this.onNetworkStatusChange) {
      this.onNetworkStatusChange(this.getNetworkStatus());
    }
  }

  cleanup(): void {
    if (this.adminHeartbeatInterval) {
      clearInterval(this.adminHeartbeatInterval);
      this.adminHeartbeatInterval = null;
    }
    
    this.miniServerBridge.stopMiniServer();
    DeviceIDManager.markAsTemporaryServer(false);
  }
}
