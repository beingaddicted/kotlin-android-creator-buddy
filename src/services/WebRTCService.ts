
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
  private lastServerOffer: WebRTCServerOffer | null = null;
  private isReconnecting = false;
  
  private rtcConfiguration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10
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
    
    this.setupConnectionEventHandlers(connection);

    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);

    const serverOffer: WebRTCServerOffer = {
      type: 'webrtc_server_offer',
      offer,
      adminId: this.userId,
      organizationId,
      organizationName,
      timestamp: Date.now(),
      serverIp: await this.getLocalIP()
    };

    this.lastServerOffer = serverOffer;
    return serverOffer;
  }

  async connectToServer(offerData: WebRTCServerOffer, userId: string, userName: string): Promise<void> {
    this.isAdmin = false;
    this.userId = userId;
    this.organizationId = offerData.organizationId;
    this.connectionManager.setAsServer(false);
    this.lastServerOffer = offerData;
    
    console.log('WebRTC: Connecting to server');
    
    const connection = new RTCPeerConnection(this.rtcConfiguration);
    this.localConnection = connection;
    
    connection.ondatachannel = (event) => {
      this.connectionManager.setupDataChannel(event.channel, offerData.adminId);
    };
    
    this.setupConnectionEventHandlers(connection);

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

  private setupConnectionEventHandlers(connection: RTCPeerConnection) {
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
        this.isReconnecting = false;
        console.log('Successfully connected to peer');
        
        if (this.reconnectInterval) {
          clearTimeout(this.reconnectInterval);
          this.reconnectInterval = null;
        }
      } else if (connection.connectionState === 'disconnected' || connection.connectionState === 'failed') {
        if (!this.isReconnecting) {
          console.log('Connection lost, attempting reconnection...');
          this.handleReconnection();
        }
      }
    };

    // Handle ICE connection state changes for better reconnection detection
    connection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', connection.iceConnectionState);
      
      if (connection.iceConnectionState === 'disconnected' || connection.iceConnectionState === 'failed') {
        if (!this.isReconnecting && this.reconnectAttempts < this.maxReconnectAttempts) {
          console.log('ICE connection lost, triggering reconnection...');
          this.handleReconnection();
        }
      }
    };
  }

  private async handleReconnection() {
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached. Connection permanently lost.');
        this.notifyConnectionLost();
      }
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    try {
      // Wait before attempting reconnection with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
      await new Promise(resolve => setTimeout(resolve, delay));

      if (!this.localConnection) {
        console.error('No local connection available for reconnection');
        this.isReconnecting = false;
        return;
      }

      // Try ICE restart first
      await this.performICERestart();

    } catch (error) {
      console.error('Reconnection failed:', error);
      this.isReconnecting = false;
      
      // Schedule next reconnection attempt
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectInterval = setTimeout(() => {
          this.handleReconnection();
        }, 5000);
      } else {
        this.notifyConnectionLost();
      }
    }
  }

  private async performICERestart() {
    if (!this.localConnection) return;

    console.log('Performing ICE restart...');
    
    try {
      // Create new offer with ICE restart
      const offer = await this.localConnection.createOffer({ iceRestart: true });
      await this.localConnection.setLocalDescription(offer);
      
      // Clear pending candidates
      this.pendingIceCandidates = [];
      
      // For client reconnection, we need the server offer again
      if (!this.isAdmin && this.lastServerOffer) {
        console.log('Client performing full reconnection...');
        await this.reconnectAsClient();
      }
      
      this.isReconnecting = false;
      console.log('ICE restart completed');
      
    } catch (error) {
      console.error('ICE restart failed:', error);
      throw error;
    }
  }

  private async reconnectAsClient() {
    if (!this.lastServerOffer || !this.userId) return;

    try {
      console.log('Client reconnecting to server...');
      
      // Create new connection
      const newConnection = new RTCPeerConnection(this.rtcConfiguration);
      
      // Close old connection
      if (this.localConnection) {
        this.localConnection.close();
      }
      
      this.localConnection = newConnection;
      
      // Setup handlers for new connection
      this.setupConnectionEventHandlers(newConnection);
      
      newConnection.ondatachannel = (event) => {
        this.connectionManager.setupDataChannel(event.channel, this.lastServerOffer!.adminId);
      };
      
      // Set remote description and create answer
      await newConnection.setRemoteDescription(this.lastServerOffer.offer);
      const answer = await newConnection.createAnswer();
      await newConnection.setLocalDescription(answer);
      
      console.log('Client reconnection initiated');
      
    } catch (error) {
      console.error('Client reconnection failed:', error);
      throw error;
    }
  }

  private notifyConnectionLost() {
    console.log('Connection permanently lost - may need to re-scan QR code');
    
    // Dispatch custom event for UI to handle
    const event = new CustomEvent('webrtc-connection-lost', {
      detail: {
        isAdmin: this.isAdmin,
        organizationId: this.organizationId,
        reconnectAttempts: this.reconnectAttempts
      }
    });
    window.dispatchEvent(event);
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

  isCurrentlyReconnecting(): boolean {
    return this.isReconnecting;
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
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
    this.isReconnecting = false;
    this.lastServerOffer = null;
  }

  // Method to manually trigger reconnection (for UI buttons)
  async forceReconnect() {
    if (this.isReconnecting) return;
    
    this.reconnectAttempts = 0;
    await this.handleReconnection();
  }
}

export const webRTCService = new WebRTCService();
export type { WebRTCServerOffer, PeerConnection, WebRTCMessage };
