
export class DeviceIDManager {
  private static readonly DEVICE_ID_KEY = 'webrtc_device_id';

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
      // Fallback to session-based ID
      return this.generateDeviceId();
    }
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
