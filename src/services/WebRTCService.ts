import { WebRTCServerOffer, WebRTCMessage, PeerConnection } from './webrtc/types';
import { ConnectionManager } from './webrtc/ConnectionManager';
import { SignalingMessage } from './webrtc/SignalingService';

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
  private currentLocalIP: string | null = null;
  
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
    this.setupSignalingHandler();

    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);

    // Get and store current IP
    this.currentLocalIP = await this.getLocalIP();

    const serverOffer: WebRTCServerOffer = {
      type: 'webrtc_server_offer',
      offer,
      adminId: this.userId,
      organizationId,
      organizationName,
      timestamp: Date.now(),
      serverIp: this.currentLocalIP
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
    this.setupSignalingHandler();

    await connection.setRemoteDescription(offerData.offer);
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);
    
    // Get current IP
    this.currentLocalIP = await this.getLocalIP();
    
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

  private setupSignalingHandler() {
    this.connectionManager.onSignalingMessage((message, fromPeerId) => {
      this.handleSignalingMessage(message, fromPeerId);
    });
  }

  private async handleSignalingMessage(message: SignalingMessage, fromPeerId: string) {
    console.log('Handling signaling message:', message.type, 'from:', fromPeerId);

    switch (message.type) {
      case 'new-offer':
        // Client receives new offer from admin
        if (!this.isAdmin) {
          await this.handleNewOffer(message.data, fromPeerId);
        }
        break;

      case 'new-answer':
        // Admin receives new answer from client
        if (this.isAdmin && this.localConnection) {
          await this.localConnection.setRemoteDescription(message.data);
          console.log('Applied new answer from client');
        }
        break;

      case 'ice-candidate':
        // Both can receive ICE candidates
        if (this.localConnection) {
          try {
            await this.localConnection.addIceCandidate(message.data);
            console.log('Added new ICE candidate from peer');
          } catch (error) {
            console.warn('Failed to add ICE candidate:', error);
          }
        }
        break;

      case 'ip-changed':
        // Handle IP change notification
        console.log('Peer IP changed:', message.data.newIp);
        if (!this.isReconnecting) {
          this.handlePeerIpChange(fromPeerId, message.data.newIp);
        }
        break;
    }
  }

  private async handleNewOffer(newOffer: WebRTCServerOffer, fromPeerId: string) {
    if (!this.localConnection) return;

    try {
      console.log('Applying new offer from admin');
      
      // Update stored server offer
      this.lastServerOffer = newOffer;
      
      // Set new remote description
      await this.localConnection.setRemoteDescription(newOffer.offer);
      
      // Create and send new answer
      const answer = await this.localConnection.createAnswer();
      await this.localConnection.setLocalDescription(answer);
      
      // Send answer back through signaling
      this.connectionManager.sendNewAnswer(fromPeerId, answer);
      
      console.log('Sent new answer to admin');
    } catch (error) {
      console.error('Failed to handle new offer:', error);
    }
  }

  private async handlePeerIpChange(peerId: string, newIp: string) {
    console.log('Handling peer IP change for:', peerId, 'new IP:', newIp);
    
    // If we're the admin and client IP changed, we might need to restart ICE
    if (this.isAdmin) {
      await this.handleClientIpChange(peerId);
    } else {
      // If we're client and admin IP changed, admin should send new offer
      console.log('Admin IP changed, waiting for new offer...');
    }
  }

  private async handleClientIpChange(clientId: string) {
    if (!this.localConnection) return;

    try {
      console.log('Client IP changed, performing ICE restart');
      
      // Perform ICE restart
      const offer = await this.localConnection.createOffer({ iceRestart: true });
      await this.localConnection.setLocalDescription(offer);
      
      // Send new offer to client
      if (this.lastServerOffer) {
        const newServerOffer: WebRTCServerOffer = {
          ...this.lastServerOffer,
          offer,
          timestamp: Date.now(),
          serverIp: this.currentLocalIP || 'unknown'
        };
        
        this.connectionManager.sendNewOffer(clientId, newServerOffer);
        console.log('Sent new offer to client after IP change');
      }
    } catch (error) {
      console.error('Failed to handle client IP change:', error);
    }
  }

  private setupConnectionEventHandlers(connection: RTCPeerConnection) {
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.pendingIceCandidates.push(event.candidate);
        console.log('ICE candidate generated, total:', this.pendingIceCandidates.length);
        
        // Send ICE candidate to peers through signaling
        const peers = this.connectionManager.getConnectedPeers();
        peers.forEach(peer => {
          this.connectionManager.sendIceCandidate(peer.id, event.candidate!);
        });
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
        
        // Check if our IP changed
        this.checkForIpChange();
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

  private async checkForIpChange() {
    const newIp = await this.getLocalIP();
    if (newIp !== this.currentLocalIP && newIp !== 'unknown') {
      console.log('Local IP changed from', this.currentLocalIP, 'to', newIp);
      this.currentLocalIP = newIp;
      
      // Notify peers about IP change
      this.connectionManager.notifyIpChange(newIp);
      
      // If we're admin, send new offer to all clients
      if (this.isAdmin) {
        await this.sendUpdatedOfferToAllClients();
      }
    }
  }

  private async sendUpdatedOfferToAllClients() {
    if (!this.localConnection || !this.lastServerOffer) return;

    try {
      console.log('Sending updated offer to all clients due to IP change');
      
      // Create new offer
      const offer = await this.localConnection.createOffer({ iceRestart: true });
      await this.localConnection.setLocalDescription(offer);
      
      // Update server offer
      const newServerOffer: WebRTCServerOffer = {
        ...this.lastServerOffer,
        offer,
        timestamp: Date.now(),
        serverIp: this.currentLocalIP || 'unknown'
      };
      
      this.lastServerOffer = newServerOffer;
      
      // Send to all connected clients
      const connectedPeers = this.connectionManager.getConnectedPeers();
      connectedPeers.forEach(peer => {
        this.connectionManager.sendNewOffer(peer.id, newServerOffer);
      });
      
    } catch (error) {
      console.error('Failed to send updated offer to clients:', error);
    }
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

      // Check for IP change first
      await this.checkForIpChange();

      // Try ICE restart
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
        console.log('Client performing ICE restart...');
        // Don't do full reconnection anymore - let signaling handle it
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
    console.log('Connection permanently lost - trying signaling-based recovery...');
    
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

  requestLocationFromClient(clientId: string) {
    if (!this.isAdmin) return;
    this.connectionManager.requestLocationUpdate(clientId);
  }

  requestLocationFromAllClients() {
    if (!this.isAdmin) return;
    this.connectionManager.requestLocationFromAllClients();
  }

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
    this.currentLocalIP = null;
  }

  async forceReconnect() {
    if (this.isReconnecting) return;
    
    this.reconnectAttempts = 0;
    await this.handleReconnection();
  }
}

export const webRTCService = new WebRTCService();
export type { WebRTCServerOffer, PeerConnection, WebRTCMessage };
