
export interface DeviceInfo {
  deviceId: string;
  deviceType: 'admin' | 'client' | 'server';
  deviceName: string;
  organizationId?: string;
  isTemporaryServer: boolean;
  lastSeen: number;
  capabilities: string[];
}

export class DeviceIDManager {
  private static readonly DEVICE_ID_KEY = 'webrtc_device_id';
  private static readonly DEVICE_INFO_KEY = 'webrtc_device_info';

  static getOrCreateDeviceId(): string {
    try {
      let deviceId = localStorage.getItem(this.DEVICE_ID_KEY);
      
      if (!deviceId) {
        deviceId = this.generateDeviceId();
        localStorage.setItem(this.DEVICE_ID_KEY, deviceId);
      }
      
      return deviceId;
    } catch (error) {
      console.error('Failed to get/create device ID:', error);
      return this.generateDeviceId();
    }
  }

  static getDeviceInfo(): DeviceInfo | null {
    try {
      const stored = localStorage.getItem(this.DEVICE_INFO_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      return null;
    } catch (error) {
      console.error('Failed to get device info:', error);
      return null;
    }
  }

  static setDeviceInfo(deviceInfo: DeviceInfo): void {
    try {
      localStorage.setItem(this.DEVICE_INFO_KEY, JSON.stringify(deviceInfo));
    } catch (error) {
      console.error('Failed to set device info:', error);
    }
  }

  static markAsTemporaryServer(isServer: boolean): void {
    const info = this.getDeviceInfo();
    if (info) {
      info.isTemporaryServer = isServer;
      this.setDeviceInfo(info);
    }
  }

  static isTemporaryServer(): boolean {
    const info = this.getDeviceInfo();
    return info?.isTemporaryServer || false;
  }

  static isAdmin(): boolean {
    const info = this.getDeviceInfo();
    return info?.deviceType === 'admin' || false;
  }

  static regenerateDeviceId(): string {
    const newId = this.generateDeviceId();
    
    try {
      localStorage.setItem(this.DEVICE_ID_KEY, newId);
    } catch (error) {
      console.error('Failed to store new device ID:', error);
    }
    
    return newId;
  }

  static clearDeviceId(): void {
    try {
      localStorage.removeItem(this.DEVICE_ID_KEY);
      localStorage.removeItem(this.DEVICE_INFO_KEY);
    } catch (error) {
      console.error('Failed to clear device ID:', error);
    }
  }

  private static generateDeviceId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `device_${timestamp}_${randomPart}`;
  }
}
