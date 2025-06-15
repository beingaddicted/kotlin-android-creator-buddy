
import { PeerConnection } from './types';
import { WebRTCServiceCore } from './WebRTCServiceCore';

export class WebRTCStatusManager {
  constructor(private core: WebRTCServiceCore) {}

  getConnectionStatus(): 'disconnected' | 'connecting' | 'connected' {
    return this.core.getConnectionStatus();
  }

  isCurrentlyReconnecting(): boolean {
    const allStates = this.core.reconnectionManager.getAllReconnectionStates();
    return allStates.size > 0 || this.core.autoReconnectionManager.isReconnecting();
  }

  getReconnectAttempts(): number {
    const allStates = this.core.reconnectionManager.getAllReconnectionStates();
    if (allStates.size === 0) return 0;

    return Math.max(...Array.from(allStates.values()).map(state => state.attempt));
  }

  getDetailedReconnectionStatus(): Map<string, { isReconnecting: boolean; attempt: number; maxAttempts: number }> {
    const peers = this.core.connectionManager.getAllPeers();
    const statusMap = new Map();

    peers.forEach(peer => {
      statusMap.set(peer.id, this.core.reconnectionManager.getReconnectionState(peer.id));
    });

    return statusMap;
  }

  getConnectedPeers(): PeerConnection[] {
    return this.core.connectionManager.getConnectedPeers();
  }
}
