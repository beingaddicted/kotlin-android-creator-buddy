import { WebRTCServerOffer } from './types';
import { WebRTCConnection } from './WebRTCConnection';
import { ConnectionManager } from './ConnectionManager';
import { WebRTCOfferManager } from './WebRTCOfferManager';
import { AutoReconnectionManager } from './AutoReconnectionManager';

export class WebRTCServerManager {
  private webrtcConnection: WebRTCConnection;
  private connectionManager: ConnectionManager;
  private offerManager: WebRTCOfferManager;
  private reconnectionManager: AutoReconnectionManager;

  constructor(
    webrtcConnection: WebRTCConnection,
    connectionManager: ConnectionManager,
    offerManager: WebRTCOfferManager,
    reconnectionManager: AutoReconnectionManager
  ) {
    this.webrtcConnection = webrtcConnection;
    this.connectionManager = connectionManager;
    this.offerManager = offerManager;
    this.reconnectionManager = reconnectionManager;
  }

  async createServerOffer(organizationId: string, organizationName: string, adminId: string): Promise<WebRTCServerOffer> {
    try {
      const offer = await this.webrtcConnection.createOffer();
      
      const serverOffer: WebRTCServerOffer = {
        type: 'webrtc_server_offer',
        offer,
        adminId,
        organizationId,
        organizationName,
        timestamp: Date.now(),
        serverIp: await this.getCurrentIP()
      };

      this.offerManager.setLastServerOffer(serverOffer);
      
      return serverOffer;
    } catch (error) {
      console.error('Failed to create server offer:', error);
      throw error;
    }
  }

  async startServer(organizationId: string, organizationName: string, adminId: string): Promise<WebRTCServerOffer> {
    return this.createServerOffer(organizationId, organizationName, adminId);
  }

  async sendUpdatedOfferToAllClients(newIP?: string): Promise<void> {
    console.log('Sending updated offer to all clients');
    // Implementation for sending updated offers
  }

  async sendUpdatedOfferToClient(clientId: string): Promise<void> {
    console.log('Sending updated offer to client:', clientId);
    // Implementation for sending updated offer to specific client
  }

  private async getCurrentIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.error('Failed to get current IP:', error);
      return 'unknown';
    }
  }
}
