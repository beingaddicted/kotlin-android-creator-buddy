
import { WebRTCConnection } from './WebRTCConnection';
import { ConnectionManager } from './ConnectionManager';
import { WebRTCOfferManager } from './WebRTCOfferManager';
import { ReconnectionManager } from './ReconnectionManager';
import { WebRTCServerOffer } from './types';

export class WebRTCServerManager {
  private webrtcConnection: WebRTCConnection;
  private connectionManager: ConnectionManager;
  private offerManager: WebRTCOfferManager;
  private reconnectionManager: ReconnectionManager;

  constructor(
    webrtcConnection: WebRTCConnection,
    connectionManager: ConnectionManager,
    offerManager: WebRTCOfferManager,
    reconnectionManager: ReconnectionManager
  ) {
    this.webrtcConnection = webrtcConnection;
    this.connectionManager = connectionManager;
    this.offerManager = offerManager;
    this.reconnectionManager = reconnectionManager;
  }

  async startServer(organizationId: string, organizationName: string, adminId: string): Promise<WebRTCServerOffer> {
    this.connectionManager.setAsServer(true);
    this.reconnectionManager.setAsAdmin(true);
    
    console.log('WebRTC: Starting server');
    
    const connection = this.webrtcConnection.createConnection();
    
    // Setup connection event handlers
    this.setupConnectionHandlers(connection);
    
    // Create data channel
    const dataChannel = connection.createDataChannel('location-sync', {
      ordered: true
    });
    
    this.connectionManager.setupDataChannel(dataChannel, 'broadcast');
    
    // Get server IP (simplified for demo)
    const serverIp = await this.getServerIP();
    
    // Create and return server offer
    return await this.offerManager.createServerOffer(
      this.webrtcConnection,
      organizationId,
      organizationName,
      adminId,
      serverIp
    );
  }

  async sendUpdatedOfferToAllClients(newIP?: string): Promise<void> {
    const currentIP = newIP || await this.getServerIP();
    const updatedOffer = await this.offerManager.createUpdatedOffer(
      this.webrtcConnection,
      currentIP
    );
    
    if (updatedOffer) {
      console.log('Sending updated offer to all clients');
      // In a real implementation, this would send to all connected clients
      // For now, we'll just log it
      console.log('Updated offer:', updatedOffer);
    }
  }

  async sendUpdatedOfferToClient(clientId: string): Promise<void> {
    const serverIP = await this.getServerIP();
    const updatedOffer = await this.offerManager.createUpdatedOffer(
      this.webrtcConnection,
      serverIP
    );
    
    if (updatedOffer) {
      console.log(`Sending updated offer to client: ${clientId}`);
      // In a real implementation, this would send to the specific client
      console.log('Updated offer for client:', updatedOffer);
    }
  }

  private setupConnectionHandlers(connection: RTCPeerConnection): void {
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('ICE candidate generated:', event.candidate);
      }
    };

    connection.ondatachannel = (event) => {
      const channel = event.channel;
      console.log('Data channel received:', channel.label);
      this.connectionManager.setupDataChannel(channel, 'client');
    };
  }

  private async getServerIP(): Promise<string> {
    try {
      // In a real implementation, this would get the actual server IP
      // For demo purposes, we'll use a placeholder
      return 'localhost';
    } catch (error) {
      console.error('Failed to get server IP:', error);
      return 'localhost';
    }
  }
}
