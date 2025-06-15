
import { IPChangeEvent } from './types';

export class IPChangeManager {
  private currentIP: string | null = null;
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private onIPChangeCallback?: (event: IPChangeEvent) => void;
  private connectionInstable = false;

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.currentIP = await this.getCurrentIP();
    
    this.monitoringInterval = setInterval(async () => {
      const newIP = await this.getCurrentIP();
      if (newIP && newIP !== this.currentIP) {
        const oldIP = this.currentIP;
        this.currentIP = newIP;
        
        const event: IPChangeEvent = {
          source: 'local',
          oldIP: oldIP || 'unknown',
          newIP,
          timestamp: Date.now()
        };
        
        this.onIPChangeCallback?.(event);
      }
    }, 30000); // Check every 30 seconds
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  onIPChange(callback: (event: IPChangeEvent) => void): void {
    this.onIPChangeCallback = callback;
  }

  async getCurrentIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.error('Failed to get current IP:', error);
      return '';
    }
  }

  getCurrentIPSync(): string {
    return this.currentIP || '';
  }

  setConnectionInstability(instable: boolean): void {
    this.connectionInstable = instable;
  }

  isConnectionInstable(): boolean {
    return this.connectionInstable;
  }
}

export { IPChangeEvent };
