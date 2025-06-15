
export class AutoReconnectionManager {
  private isAutoReconnecting = false;
  private reconnectionInterval: NodeJS.Timeout | null = null;

  startAutoReconnection(organizationId: string): void {
    if (this.isAutoReconnecting) return;
    
    this.isAutoReconnecting = true;
    console.log('Starting auto-reconnection for organization:', organizationId);
    
    // Dispatch event to notify UI
    window.dispatchEvent(new CustomEvent('webrtc-auto-reconnection-started', {
      detail: { organizationId, reconnectedClients: 0 }
    }));
    
    // Set a timeout to stop auto-reconnection after some time
    setTimeout(() => {
      this.stopAutoReconnection();
    }, 120000); // 2 minutes
  }

  stopAutoReconnection(): void {
    this.isAutoReconnecting = false;
    
    if (this.reconnectionInterval) {
      clearInterval(this.reconnectionInterval);
      this.reconnectionInterval = null;
    }
    
    console.log('Auto-reconnection stopped');
  }

  isCurrentlyAutoReconnecting(): boolean {
    return this.isAutoReconnecting;
  }

  isReconnecting(): boolean {
    return this.isAutoReconnecting;
  }
}
