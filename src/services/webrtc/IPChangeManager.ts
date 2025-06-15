
export interface IPChangeEvent {
  oldIP: string;
  newIP: string;
  source: 'local' | 'peer';
  peerId?: string;
  timestamp: number;
}

export class IPChangeManager {
  private currentIP: string | null = null;
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private onIPChangeCallback?: (event: IPChangeEvent) => void;
  private connectionInstable = false;

  startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.getCurrentIP().then(ip => {
      this.currentIP = ip;
    });
    
    this.monitoringInterval = setInterval(() => {
      this.checkForIPChange();
    }, 5000);
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

  setConnectionInstability(unstable: boolean): void {
    this.connectionInstable = unstable;
  }

  private async checkForIPChange(): Promise<void> {
    try {
      const newIP = await this.getCurrentIP();
      
      if (this.currentIP && newIP && this.currentIP !== newIP) {
        const event: IPChangeEvent = {
          oldIP: this.currentIP,
          newIP: newIP,
          source: 'local',
          timestamp: Date.now()
        };
        
        this.currentIP = newIP;
        this.onIPChangeCallback?.(event);
      }
    } catch (error) {
      console.error('Failed to check for IP change:', error);
    }
  }

  private async getCurrentIP(): Promise<string | null> {
    try {
      // Using a public IP detection service
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.error('Failed to get current IP:', error);
      return null;
    }
  }
}
