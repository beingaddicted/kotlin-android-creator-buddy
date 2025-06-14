
import { WebRTCServerOffer, WebRTCMessage, PeerConnection } from './webrtc/types';
import { ConnectionManager } from './webrtc/ConnectionManager';

class WebRTCService {
  private localConnection: RTCPeerConnection | null = null;
  private connectionManager = new ConnectionManager();
  private isAdmin = false;
  private userId: string | null = null;
  private organizationId: string | null = null;
  private pendingIceCandidates: RTCIceCandidate[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval: NodeJS.Timeout | null = null;
  
  private rtcConfiguration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ]
  };

  async createServerOffer(organizationId: string, organizationName: string): Promise<WebRTCServerOffer> {
    this.isAdmin = true;
    this.organizationId = organizationId;
    this.userId = `admin-${organizationId}-${Date.now()}`;
    this.connectionManager.setAsServer(true);
    
    console.log('WebRTC: Creating server offer for organization:', organizationId);
    
    const connection = new RTCPeerConnection(this.rtcConfiguration);
    this.localConnection = connection;
    
    // Server creates data channel for each client
    const dataChannel = connection.createDataChannel('location', {
      ordered: true
    });
    
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.pendingIceCandidates.push(event.candidate);
        console.log('ICE candidate generated, total:', this.pendingIceCandidates.length);
      }
    };

    connection.onconnectionstatechange = () => {
      console.log('Connection state changed:', connection.connectionState);
      if (connection.connectionState === 'disconnected' || connection.connectionState === 'failed') {
        this.handleReconnection();
      }
    };

    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);

    return {
      type: 'webrtc_server_offer',
      offer,
      adminId: this.userId,
      organizationId,
      organizationName,
      timestamp: Date.now(),
      serverIp: await this.getLocalIP()
    };
  }

  async connectToServer(offerData: WebRTCServerOffer, userId: string, userName: string): Promise<void> {
    this.isAdmin = false;
    this.userId = userId;
    this.organizationId = offerData.organizationId;
    this.connectionManager.setAsServer(false);
    
    console.log('WebRTC: Connecting to server');
    
    const connection = new RTCPeerConnection(this.rtcConfiguration);
    this.localConnection = connection;
    
    connection.ondatachannel = (event) => {
      this.connectionManager.setupDataChannel(event.channel, offerData.adminId);
    };
    
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.pendingIceCandidates.push(event.candidate);
        console.log('ICE candidate generated, total:', this.pendingIceCandidates.length);
      }
    };

    connection.onconnectionstatechange = () => {
      console.log('Connection state changed:', connection.connectionState);
      if (connection.connectionState === 'connected') {
        this.reconnectAttempts = 0;
        console.log('Successfully connected to server');
      } else if (connection.connectionState === 'disconnected' || connection.connectionState === 'failed') {
        this.handleReconnection();
      }
    };

    await connection.setRemoteDescription(offerData.offer);
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);
    
    // Add ICE candidates
    for (const candidate of this.pendingIceCandidates) {
      try {
        await connection.addIceCandidate(candidate);
      } catch (error) {
        console.warn('Failed to add ICE candidate:', error);
      }
    }
    this.pendingIceCandidates = [];

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

  // Admin method to request location from specific client
  requestLocationFromClient(clientId: string) {
    if (!this.isAdmin) return;
    this.connectionManager.requestLocationUpdate(clientId);
  }

  // Admin method to request location from all clients
  requestLocationFromAllClients() {
    if (!this.isAdmin) return;
    this.connectionManager.requestLocationFromAllClients();
  }

  // Client method to send location to server
  sendLocationUpdate(locationData: any) {
    if (this.isAdmin) return;
    this.connectionManager.sendLocationUpdate(locationData);
  }

  private async handleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    // Wait before attempting reconnection
    await new Promise(resolve => setTimeout(resolve, 2000 * this.reconnectAttempts));

    try {
      // Re-establish connection logic would go here
      console.log('Reconnection logic would be implemented here');
    } catch (error) {
      console.error('Reconnection failed:', error);
    }
  }

  private async getLocalIP(): Promise<string> {
    try {
      // Create a temporary peer connection to get local IP
      const tempConnection = new RTCPeerConnection({ iceServers: [] });
      const tempChannel = tempConnection.createDataChannel('');
      
      return new Promise((resolve) => {
        tempConnection.onicecandidate = (event) => {
          if (event.candidate) {
            const candidate = event.candidate.candidate;
            const ipMatch = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
            if (ipMatch) {
              tempConnection.close();
              resolve(ipMatch[1]);
              return;
            }
          }
        };
        
        tempConnection.createOffer().then(offer => {
          tempConnection.setLocalDescription(offer);
        });
        
        // Fallback after 3 seconds
        setTimeout(() => {
          tempConnection.close();
          resolve('unknown');
        }, 3000);
      });
    } catch (error) {
      console.error('Failed to get local IP:', error);
      return 'unknown';
    }
  }

  onLocationUpdate(callback: (userId: string, location: any) => void) {
    this.connectionManager.onLocationUpdate(callback);
  }

  onPeerStatusUpdate(callback: (peers: PeerConnection[]) => void) {
    this.connectionManager.onPeerStatusUpdate(callback);
  }

  getConnectedPeers(): PeerConnection[] {
    return this.connectionManager.getConnectedPeers();
  }

  getConnectionStatus(): 'disconnected' | 'connecting' | 'connected' {
    if (!this.localConnection) return 'disconnected';
    
    if (this.localConnection.connectionState === 'connected') return 'connected';
    if (this.localConnection.connectionState === 'connecting') return 'connecting';
    
    return 'disconnected';
  }

  disconnect() {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    if (this.localConnection) {
      this.localConnection.close();
      this.localConnection = null;
    }

    this.connectionManager.clearPeers();
    this.pendingIceCandidates = [];
    this.reconnectAttempts = 0;
  }
}

export const webRTCService = new WebRTCService();
export type { WebRTCServerOffer, PeerConnection, WebRTCMessage };
