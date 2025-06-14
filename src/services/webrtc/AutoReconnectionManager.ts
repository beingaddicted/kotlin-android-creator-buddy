
import { PersistentStorage, StoredClientInfo, StoredServerState } from './PersistentStorage';
import { WebRTCConnection } from './WebRTCConnection';
import { WebRTCOfferManager } from './WebRTCOfferManager';
import { ConnectionManager } from './ConnectionManager';

export class AutoReconnectionManager {
  private persistentStorage = new PersistentStorage();
  private isAutoReconnecting = false;
  private reconnectionTimeout: NodeJS.Timeout | null = null;

  async attemptAutoReconnection(
    webrtcConnection: WebRTCConnection,
    offerManager: WebRTCOfferManager,
    connectionManager: ConnectionManager
  ): Promise<boolean> {
    const storedState = this.persistentStorage.loadServerState();
    
    if (!storedState || !storedState.isActive || storedState.clients.length === 0) {
      console.log('No stored server state or clients found for auto-reconnection');
      return false;
    }

    console.log(`AutoReconnection: Found ${storedState.clients.length} stored clients to reconnect`);
    this.isAutoReconnecting = true;

    try {
      // Restore the last server offer if available
      if (storedState.lastServerOffer) {
        offerManager.setLastServerOffer(storedState.lastServerOffer);
      }

      // Create new server offer for reconnection
      const newServerOffer = await offerManager.createUpdatedOffer(
        webrtcConnection,
        'auto-reconnect-ip',
        { iceRestart: true }
      );

      if (!newServerOffer) {
        console.error('Failed to create updated offer for auto-reconnection');
        return false;
      }

      // Update persistent storage with new offer
      this.persistentStorage.updateLastServerOffer(newServerOffer);

      // Attempt to reconnect to each stored client
      let reconnectedCount = 0;
      for (const client of storedState.clients) {
        try {
          await this.reconnectToClient(client, newServerOffer, connectionManager);
          reconnectedCount++;
        } catch (error) {
          console.error(`Failed to reconnect to client ${client.id}:`, error);
          this.incrementClientConnectionAttempts(client.id);
        }
      }

      console.log(`AutoReconnection: Successfully initiated reconnection to ${reconnectedCount}/${storedState.clients.length} clients`);
      
      // Schedule cleanup of failed clients
      this.scheduleFailedClientCleanup();
      
      return reconnectedCount > 0;

    } catch (error) {
      console.error('Auto-reconnection failed:', error);
      return false;
    } finally {
      this.isAutoReconnecting = false;
    }
  }

  private async reconnectToClient(
    client: StoredClientInfo,
    serverOffer: any,
    connectionManager: ConnectionManager
  ): Promise<void> {
    console.log(`Attempting to reconnect to client: ${client.name} (${client.id})`);

    // Add client back to connection manager
    connectionManager.addPeer({
      id: client.id,
      name: client.name,
      organizationId: client.organizationId,
      connection: connectionManager.getPeer(client.id)?.connection || new RTCPeerConnection(),
      status: 'connecting',
      lastSeen: client.lastConnected
    });

    // Send new offer through signaling
    connectionManager.sendNewOffer(client.id, serverOffer);

    // Update client's last connection attempt
    this.persistentStorage.addOrUpdateClient({
      ...client,
      lastConnected: Date.now(),
      connectionAttempts: client.connectionAttempts + 1
    });
  }

  private incrementClientConnectionAttempts(clientId: string): void {
    const storedClients = this.persistentStorage.getStoredClients();
    const client = storedClients.find(c => c.id === clientId);
    
    if (client) {
      client.connectionAttempts += 1;
      
      // Remove clients that have failed too many times
      if (client.connectionAttempts > 5) {
        console.log(`Removing client ${clientId} after ${client.connectionAttempts} failed attempts`);
        this.persistentStorage.removeClient(clientId);
      } else {
        this.persistentStorage.addOrUpdateClient(client);
      }
    }
  }

  private scheduleFailedClientCleanup(): void {
    if (this.reconnectionTimeout) {
      clearTimeout(this.reconnectionTimeout);
    }

    // Clean up clients that haven't connected after 30 seconds
    this.reconnectionTimeout = setTimeout(() => {
      const storedClients = this.persistentStorage.getStoredClients();
      const failedClients = storedClients.filter(client => 
        Date.now() - client.lastConnected > 30000 && client.connectionAttempts > 3
      );

      failedClients.forEach(client => {
        console.log(`Cleaning up failed client: ${client.name} (${client.id})`);
        this.persistentStorage.removeClient(client.id);
      });
    }, 30000);
  }

  saveClientConnection(clientId: string, clientName: string, organizationId: string): void {
    const clientInfo: StoredClientInfo = {
      id: clientId,
      name: clientName,
      organizationId,
      lastConnected: Date.now(),
      connectionAttempts: 0
    };

    this.persistentStorage.addOrUpdateClient(clientInfo);
    console.log(`Saved client connection: ${clientName} (${clientId})`);
  }

  initializeServerState(organizationId: string, organizationName: string, adminId: string): void {
    const serverState: StoredServerState = {
      organizationId,
      organizationName,
      adminId,
      lastServerOffer: null,
      clients: [],
      isActive: true
    };

    this.persistentStorage.saveServerState(serverState);
    console.log('Initialized server state for auto-reconnection');
  }

  deactivateServer(): void {
    this.persistentStorage.setServerActive(false);
    
    if (this.reconnectionTimeout) {
      clearTimeout(this.reconnectionTimeout);
      this.reconnectionTimeout = null;
    }
  }

  clearServerState(): void {
    this.persistentStorage.clearServerState();
    
    if (this.reconnectionTimeout) {
      clearTimeout(this.reconnectionTimeout);
      this.reconnectionTimeout = null;
    }
  }

  isReconnecting(): boolean {
    return this.isAutoReconnecting;
  }

  getStoredState(): StoredServerState | null {
    return this.persistentStorage.loadServerState();
  }
}
