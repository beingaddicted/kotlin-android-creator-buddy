
import { DeviceIDManager, DeviceInfo } from './DeviceIDManager';

export interface AdminDevice {
  deviceId: string;
  deviceName: string;
  lastSeen: number;
  isPrimary: boolean;
  capabilities: string[];
}

export class MultiAdminManager {
  private adminDevices = new Map<string, AdminDevice>();
  private currentAdminId: string | null = null;
  private adminSyncInterval: NodeJS.Timeout | null = null;
  private onAdminStatusChange?: (admins: AdminDevice[]) => void;

  startMultiAdminCoordination(organizationId: string): void {
    console.log('MultiAdminManager: Starting multi-admin coordination');
    
    // Register current device as admin if it is one
    if (DeviceIDManager.isAdmin()) {
      this.registerAsAdmin();
    }
    
    // Start syncing with other admins
    this.startAdminSync();
    
    // Set up admin discovery
    this.setupAdminDiscovery();
  }

  private registerAsAdmin(): void {
    const deviceId = DeviceIDManager.getOrCreateDeviceId();
    const deviceInfo = DeviceIDManager.getDeviceInfo();
    
    if (deviceInfo) {
      const adminDevice: AdminDevice = {
        deviceId,
        deviceName: deviceInfo.deviceName,
        lastSeen: Date.now(),
        isPrimary: this.adminDevices.size === 0, // First admin becomes primary
        capabilities: deviceInfo.capabilities
      };
      
      this.adminDevices.set(deviceId, adminDevice);
      this.currentAdminId = deviceId;
      
      // Broadcast admin presence
      this.broadcastAdminPresence(adminDevice);
      
      this.notifyAdminStatusChange();
    }
  }

  private startAdminSync(): void {
    this.adminSyncInterval = setInterval(() => {
      // Send heartbeat if we're an admin
      if (DeviceIDManager.isAdmin()) {
        this.sendAdminHeartbeat();
      }
      
      // Clean up stale admin devices
      this.cleanupStaleAdmins();
      
      // Check if primary admin is still active
      this.checkPrimaryAdminStatus();
    }, 5000);
  }

  private setupAdminDiscovery(): void {
    window.addEventListener('webrtc-admin-presence', (event: CustomEvent) => {
      const { adminDevice } = event.detail;
      this.handleAdminPresence(adminDevice);
    });

    window.addEventListener('webrtc-admin-heartbeat', (event: CustomEvent) => {
      const { adminId } = event.detail;
      this.updateAdminLastSeen(adminId);
    });

    window.addEventListener('webrtc-admin-promotion', (event: CustomEvent) => {
      const { newPrimaryId } = event.detail;
      this.handleAdminPromotion(newPrimaryId);
    });
  }

  private sendAdminHeartbeat(): void {
    const deviceId = DeviceIDManager.getOrCreateDeviceId();
    
    // Update our own last seen
    const adminDevice = this.adminDevices.get(deviceId);
    if (adminDevice) {
      adminDevice.lastSeen = Date.now();
      this.adminDevices.set(deviceId, adminDevice);
    }
    
    // Broadcast heartbeat
    const event = new CustomEvent('webrtc-admin-heartbeat', {
      detail: { adminId: deviceId, timestamp: Date.now() }
    });
    window.dispatchEvent(event);
  }

  private broadcastAdminPresence(adminDevice: AdminDevice): void {
    const event = new CustomEvent('webrtc-admin-presence', {
      detail: { adminDevice }
    });
    window.dispatchEvent(event);
  }

  private handleAdminPresence(adminDevice: AdminDevice): void {
    console.log('MultiAdminManager: New admin device detected:', adminDevice.deviceId);
    
    // If this admin is newer than current primary, don't make it primary
    const currentPrimary = this.getPrimaryAdmin();
    if (currentPrimary && !adminDevice.isPrimary) {
      adminDevice.isPrimary = false;
    }
    
    this.adminDevices.set(adminDevice.deviceId, adminDevice);
    this.notifyAdminStatusChange();
  }

  private updateAdminLastSeen(adminId: string): void {
    const adminDevice = this.adminDevices.get(adminId);
    if (adminDevice) {
      adminDevice.lastSeen = Date.now();
      this.adminDevices.set(adminId, adminDevice);
    }
  }

  private cleanupStaleAdmins(): void {
    const now = Date.now();
    const staleTimeout = 30000; // 30 seconds
    
    let removedAny = false;
    
    for (const [adminId, adminDevice] of this.adminDevices) {
      if (now - adminDevice.lastSeen > staleTimeout) {
        console.log('MultiAdminManager: Removing stale admin:', adminId);
        this.adminDevices.delete(adminId);
        removedAny = true;
      }
    }
    
    if (removedAny) {
      this.notifyAdminStatusChange();
    }
  }

  private checkPrimaryAdminStatus(): void {
    const primaryAdmin = this.getPrimaryAdmin();
    
    if (!primaryAdmin) {
      // No primary admin, promote the oldest active admin
      this.promoteToPrimary();
    } else {
      const timeSinceLastSeen = Date.now() - primaryAdmin.lastSeen;
      if (timeSinceLastSeen > 15000) { // 15 seconds
        console.log('MultiAdminManager: Primary admin appears inactive, promoting new primary');
        this.promoteToPrimary();
      }
    }
  }

  private promoteToPrimary(): void {
    // Find the admin with the earliest join time (lowest device ID timestamp)
    let newPrimary: AdminDevice | null = null;
    
    for (const adminDevice of this.adminDevices.values()) {
      if (!newPrimary || adminDevice.deviceId < newPrimary.deviceId) {
        newPrimary = adminDevice;
      }
    }
    
    if (newPrimary) {
      // Clear all primary flags
      for (const adminDevice of this.adminDevices.values()) {
        adminDevice.isPrimary = false;
      }
      
      // Set new primary
      newPrimary.isPrimary = true;
      this.adminDevices.set(newPrimary.deviceId, newPrimary);
      
      console.log('MultiAdminManager: Promoted new primary admin:', newPrimary.deviceId);
      
      // Broadcast promotion
      const event = new CustomEvent('webrtc-admin-promotion', {
        detail: { newPrimaryId: newPrimary.deviceId }
      });
      window.dispatchEvent(event);
      
      this.notifyAdminStatusChange();
    }
  }

  private handleAdminPromotion(newPrimaryId: string): void {
    // Clear all primary flags
    for (const adminDevice of this.adminDevices.values()) {
      adminDevice.isPrimary = false;
    }
    
    // Set new primary
    const newPrimary = this.adminDevices.get(newPrimaryId);
    if (newPrimary) {
      newPrimary.isPrimary = true;
      this.adminDevices.set(newPrimaryId, newPrimary);
    }
    
    this.notifyAdminStatusChange();
  }

  getPrimaryAdmin(): AdminDevice | null {
    for (const adminDevice of this.adminDevices.values()) {
      if (adminDevice.isPrimary) {
        return adminDevice;
      }
    }
    return null;
  }

  getAllAdmins(): AdminDevice[] {
    return Array.from(this.adminDevices.values());
  }

  isCurrentDevicePrimary(): boolean {
    const currentId = DeviceIDManager.getOrCreateDeviceId();
    const currentAdmin = this.adminDevices.get(currentId);
    return currentAdmin?.isPrimary || false;
  }

  canPerformAdminActions(): boolean {
    // Any admin can perform basic actions, but some might require primary admin
    return DeviceIDManager.isAdmin();
  }

  canAccessLocationData(): boolean {
    // All admins can access location data
    return DeviceIDManager.isAdmin();
  }

  onAdminStatusUpdate(callback: (admins: AdminDevice[]) => void): void {
    this.onAdminStatusChange = callback;
  }

  private notifyAdminStatusChange(): void {
    if (this.onAdminStatusChange) {
      this.onAdminStatusChange(this.getAllAdmins());
    }
  }

  cleanup(): void {
    if (this.adminSyncInterval) {
      clearInterval(this.adminSyncInterval);
      this.adminSyncInterval = null;
    }
    
    this.adminDevices.clear();
    this.currentAdminId = null;
  }
}
