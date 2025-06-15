
import { WebRTCServiceCore } from './WebRTCServiceCore';
import { DeviceIDManager, DeviceInfo } from './DeviceIDManager';
import { MeshNetworkCoordinator } from './MeshNetworkCoordinator';
import { MultiAdminManager } from './MultiAdminManager';

export class WebRTCServiceIntegration {
  private core: WebRTCServiceCore;
  private meshCoordinator: MeshNetworkCoordinator;
  private multiAdminManager: MultiAdminManager;

  constructor(core: WebRTCServiceCore, meshCoordinator: MeshNetworkCoordinator, multiAdminManager: MultiAdminManager) {
    this.core = core;
    this.meshCoordinator = meshCoordinator;
    this.multiAdminManager = multiAdminManager;
  }

  getMeshNetworkStatus(): any {
    return this.meshCoordinator.getNetworkStatus();
  }

  getAllAdmins(): any[] {
    return this.multiAdminManager.getAllAdmins();
  }

  isPrimaryAdmin(): boolean {
    return this.multiAdminManager.isCurrentDevicePrimary();
  }

  canPerformAdminActions(): boolean {
    return this.multiAdminManager.canPerformAdminActions();
  }

  canAccessLocationData(): boolean {
    return this.multiAdminManager.canAccessLocationData();
  }

  getCurrentDeviceId(): string {
    return DeviceIDManager.getOrCreateDeviceId();
  }

  getCurrentDeviceInfo(): DeviceInfo | null {
    return DeviceIDManager.getDeviceInfo();
  }

  getMiniServerStats(): any {
    if (this.core.isMiniServerRunning()) {
      return this.core.getMiniServerStats();
    }
    return null;
  }

  updateDeviceInfo(deviceInfo: DeviceInfo): void {
    DeviceIDManager.setDeviceInfo(deviceInfo);
    
    // Update mesh coordinator
    this.meshCoordinator.addDeviceToMesh(deviceInfo);
    
    // Emit device info update event
    const event = new CustomEvent('webrtc-device-info-updated', { 
      detail: { deviceInfo } 
    });
    window.dispatchEvent(event);
  }

  handleAdminElectionResult(adminId: string, isOwnDevice: boolean): void {
    // Update core admin state
    this.core.updateStates(isOwnDevice, adminId, this.core.organizationId);
    
    // Notify mesh coordinator
    if (isOwnDevice) {
      console.log('WebRTCServiceIntegration: This device is now admin');
    } else {
      console.log('WebRTCServiceIntegration: Another device is admin:', adminId);
    }
    
    // Emit admin change event
    const event = new CustomEvent('webrtc-admin-changed', { 
      detail: { adminId, isOwnDevice } 
    });
    window.dispatchEvent(event);
  }

  handleMiniServerPromotion(): void {
    console.log('WebRTCServiceIntegration: Device promoted to temporary server');
    DeviceIDManager.markAsTemporaryServer(true);
    
    const event = new CustomEvent('webrtc-temporary-server-promoted');
    window.dispatchEvent(event);
  }

  handleMiniServerDemotion(): void {
    console.log('WebRTCServiceIntegration: Device demoted from temporary server');
    DeviceIDManager.markAsTemporaryServer(false);
    
    const event = new CustomEvent('webrtc-temporary-server-demoted');
    window.dispatchEvent(event);
  }

  syncStateWithMiniServer(): void {
    if (this.core.isMiniServerRunning()) {
      const stats = this.core.getMiniServerStats();
      
      // Update admin status if needed
      if (stats && stats.isAdmin !== this.core.isAdmin) {
        this.core.updateStates(stats.isAdmin, this.core.userId, this.core.organizationId);
      }
    }
  }
}
