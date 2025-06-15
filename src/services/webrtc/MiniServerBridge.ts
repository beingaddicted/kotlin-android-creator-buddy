
export class MiniServerBridge {
  private serverRunning = false;
  private serverStats = {
    startTime: null as number | null,
    connections: 0,
    messages: 0
  };
  private onServerOfferReadyCallback?: (offer: any) => void;

  async startMiniServer(organizationId: string): Promise<any> {
    try {
      this.serverRunning = true;
      this.serverStats.startTime = Date.now();
      this.serverStats.connections = 0;
      this.serverStats.messages = 0;
      
      console.log('Mini server started for organization:', organizationId);
      
      return {
        success: true,
        organizationId,
        startTime: this.serverStats.startTime
      };
    } catch (error) {
      console.error('Failed to start mini server:', error);
      this.serverRunning = false;
      throw error;
    }
  }

  async stopMiniServer(): Promise<void> {
    this.serverRunning = false;
    this.serverStats.startTime = null;
    console.log('Mini server stopped');
  }

  isServerRunning(): boolean {
    return this.serverRunning;
  }

  getServerStats(): any {
    return { ...this.serverStats };
  }

  onServerOfferReady(callback: (offer: any) => void): void {
    this.onServerOfferReadyCallback = callback;
  }

  incrementConnections(): void {
    this.serverStats.connections++;
  }

  incrementMessages(): void {
    this.serverStats.messages++;
  }
}
