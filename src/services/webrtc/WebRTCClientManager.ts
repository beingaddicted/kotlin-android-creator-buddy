
import { WebRTCServerOffer } from './types';
import { WebRTCConnection } from './WebRTCConnection';
import { ConnectionManager } from './ConnectionManager';
import { ReconnectionManager } from './ReconnectionManager';
import { WebRTCOfferManager } from './WebRTCOfferManager';

export class WebRTCClientManager {
  private webrtcConnection: WebRTCConnection;
  private connectionManager: ConnectionManager;
  private reconnectionManager: ReconnectionManager;
  private offerManager: WebRTCOfferManager;

  constructor(
    webrtcConnection: WebRTCConnection,
    connectionManager: ConnectionManager,
    reconnectionManager: ReconnectionManager,
    offerManager: WebRTCOfferManager
  ) {
    this.webrtcConnection = webrtcConnection;
    this.connectionManager = connectionManager;
    this.reconnectionManager = reconnectionManager;
    this.offerManager = offerManager;
  }

  async connectToServer(
    offerData: WebRTCServerOffer, 
    userId: string, 
    userName: string
  ): Promise<void> {
    this.connectionManager.setAsServer(false);
    this.reconnectionManager.setAsAdmin(false);
    this.offerManager.setLastServerOffer(offerData);
    
    console.log('WebRTC: Connecting to server');
    
    const connection = this.webrtcConnection.createConnection();

    await this.webrtcConnection.setRemoteDescription(offerData.offer);
    await this.webrtcConnection.createAnswer();
    
    // Process pending ICE candidates
    await this.webrtcConnection.processPendingIceCandidates();

    // Add server as peer
    this.connectionManager.addPeer({
      id: offerData.adminId,
      name: `Server-${offerData.organizationName}`,
      organizationId: offerData.organizationId,
      connection: connection,
      status: 'connecting',
      lastSeen: Date.now()
    });
  }

  sendLocationUpdate(locationData: any): void {
    this.connectionManager.sendLocationUpdate(locationData);
  }
}
