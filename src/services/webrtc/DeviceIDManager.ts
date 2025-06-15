
export interface DeviceInfo {
  deviceId: string;
  deviceType: 'admin' | 'client';
  deviceName: string;
  organizationId: string;
  isTemporaryServer: boolean;
  lastSeen: number;
  capabilities: string[];
}

export class DeviceIDManager {
  private static DEVICE_ID_KEY = 'webrtc_device_id';
  private static DEVICE_INFO_KEY = 'webrtc_device_info';
  
  static generateDeviceId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `device_${timestamp}_${random}`;
  }

  static getOrCreateDeviceId(): string {
    let deviceId = localStorage.getItem(this.DEVICE_ID_KEY);
    
    if (!deviceId) {
      deviceId = this.generateDeviceId();
      localStorage.setItem(this.DEVICE_ID_KEY, deviceId);
    }
    
    return deviceId;
  }

  static setDeviceInfo(info: DeviceInfo): void {
    localStorage.setItem(this.DEVICE_INFO_KEY, JSON.stringify(info));
  }

  static getDeviceInfo(): DeviceInfo | null {
    const stored = localStorage.getItem(this.DEVICE_INFO_KEY);
    return stored ? JSON.parse(stored) : null;
  }

  static updateDeviceType(deviceType: 'admin' | 'client'): void {
    const info = this.getDeviceInfo();
    if (info) {
      info.deviceType = deviceType;
      info.lastSeen = Date.now();
      this.setDeviceInfo(info);
    }
  }

  static markAsTemporaryServer(isTemporary: boolean): void {
    const info = this.getDeviceInfo();
    if (info) {
      info.isTemporaryServer = isTemporary;
      info.lastSeen = Date.now();
      this.setDeviceInfo(info);
    }
  }

  static isAdmin(): boolean {
    const info = this.getDeviceInfo();
    return info?.deviceType === 'admin' || false;
  }

  static isTemporaryServer(): boolean {
    const info = this.getDeviceInfo();
    return info?.isTemporaryServer || false;
  }

  static clearDeviceInfo(): void {
    localStorage.removeItem(this.DEVICE_INFO_KEY);
  }
}
