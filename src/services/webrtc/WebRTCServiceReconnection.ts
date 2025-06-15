
import { WebRTCServiceCore } from './WebRTCServiceCore';
import { WebRTCServerManager } from './WebRTCServerManager';

export class WebRTCServiceReconnection {
  constructor(
    private core: WebRTCServiceCore,
    private serverManager: WebRTCServerManager
  ) {}

  async forceReconnect(): Promise<void> {
    console.log('Force reconnecting...');
    
    if (this.core.isAdmin) {
      await this.serverManager.sendUpdatedOfferToAllClients();
    } else {
      const lastOffer = this.core.offerManager.getLastServerOffer();
      if (lastOffer) {
        // Would need to call connectToServer but we need client manager reference
        // This will be handled in the main service
      }
    }
  }

  canAutoReconnect(): boolean {
    return this.core.autoReconnectionManager.isCurrentlyAutoReconnecting();
  }

  getStoredClientCount(): number {
    return this.core.connectionManager.getConnectedPeers().length;
  }

  isCurrentlyReconnecting(): boolean {
    return this.core.autoReconnectionManager.isCurrentlyAutoReconnecting();
  }

  getReconnectAttempts(): number {
    const statuses = this.core.reconnectionManager.getAllReconnectionStatuses();
    return Array.from(statuses.values()).reduce((max, status) => Math.max(max, status.attempts), 0);
  }

  getDetailedReconnectionStatus(): Map<string, any> {
    return this.core.reconnectionManager.getAllReconnectionStatuses();
  }
}
