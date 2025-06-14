
import { WebRTCServerOffer } from './types';
import { WebRTCConnection } from './WebRTCConnection';
import { ConnectionManager } from './ConnectionManager';
import { ReconnectionManager } from './ReconnectionManager';
import { WebRTCOfferManager } from './WebRTCOfferManager';
import { AutoReconnectionManager } from './AutoReconnectionManager';
import { IPChangeManager } from './IPChangeManager';

export class WebRTCServerManager {
  private webrtcConnection: WebRTCConnection;
  public connectionManager: ConnectionManager; // Changed to public
  private reconnectionManager: ReconnectionManager;
  private offerManager: WebRTCOfferManager;
  private autoReconnectionManager: AutoReconnectionManager;
  private ipChangeManager: IPChangeManager;

  constructor(
    webrtcConnection: WebRTCConnection,
    connectionManager: ConnectionManager,
    reconnectionManager: ReconnectionManager,
    offerManager: WebRTCOfferManager,
    autoReconnectionManager: AutoReconnectionManager,
    ipChangeManager: IPChangeManager
  ) {
    this.webrtcConnection = webrtcConnection;
    this.connectionManager = connectionManager;
    this.reconnectionManager = reconnectionManager;
    this.offerManager = offerManager;
    this.autoReconnectionManager = autoReconnectionManager;
    this.ipChangeManager = ipChangeManager;
  }

  async createServerOffer(
    organizationId: string, 
    organizationName: string,
    userId: string
  ): Promise<WebRTCServerOffer> {
    this.connectionManager.setAsServer(true);
    this.reconnectionManager.setAsAdmin(true);
    
    console.log('WebRTC: Creating server offer for organization:', organizationId);
    
    const connection = this.webrtcConnection.createConnection();
    
    // Server creates data channel for each client
    const dataChannel = this.webrtcConnection.createDataChannel('location', {
      ordered: true
    });

    // Initialize server state for auto-reconnection
    this.autoReconnectionManager.initializeServerState(organizationId, organizationName, userId);

    const serverOffer = await this.offerManager.createServerOffer(
      this.webrtcConnection,
      organizationId,
      organizationName,
      userId,
      this.ipChangeManager.getCurrentIPSync()
    );

    // Try to auto-reconnect to previous clients
    setTimeout(async () => {
      await this.attemptAutoReconnectionToClients();
    }, 1000);

    return serverOffer;
  }

  private async attemptAutoReconnectionToClients(): Promise<void> {
    console.log('Attempting auto-reconnection to previous clients...');
    
    const reconnected = await this.autoReconnectionManager.attemptAutoReconnection(
      this.webrtcConnection,
      this.offerManager,
      this.connectionManager
    );

    if (reconnected) {
      console.log('Auto-reconnection initiated successfully');
      
      // Dispatch event to notify UI
      const event = new CustomEvent('webrtc-auto-reconnection-started', {
        detail: { reconnectedClients: this.autoReconnectionManager.getStoredState()?.clients.length || 0 }
      });
      window.dispatchEvent(event);
    }
  }

  requestLocationFromClient(clientId: string): void {
    this.connectionManager.requestLocationUpdate(clientId);
  }

  requestLocationFromAllClients(): void {
    this.connectionManager.requestLocationFromAllClients();
  }

  canAutoReconnect(): boolean {
    return this.autoReconnectionManager.getStoredState() !== null;
  }

  getStoredClientCount(): number {
    const state = this.autoReconnectionManager.getStoredState();
    return state?.clients.length || 0;
  }

  sendToPeer(peerId: string, data: any): void {
    this.connectionManager.sendToPeer(peerId, data);
  }

  deactivateServer(): void {
    this.autoReconnectionManager.deactivateServer();
  }

  clearServerState(): void {
    this.autoReconnectionManager.clearServerState();
  }
}
