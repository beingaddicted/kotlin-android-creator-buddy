import { WebRTCServerOffer, WebRTCMessage, PeerConnection } from './webrtc/types';
import { ConnectionManager } from './webrtc/ConnectionManager';
import { SignalingMessage } from './webrtc/SignalingService';
import { IPChangeManager, IPChangeEvent } from './webrtc/IPChangeManager';
import { ReconnectionManager } from './webrtc/ReconnectionManager';

class WebRTCService {
  private localConnection: RTCPeerConnection | null = null;
  private connectionManager = new ConnectionManager();
  private ipChangeManager = new IPChangeManager();
  private reconnectionManager = new ReconnectionManager();
  private isAdmin = false;
  private userId: string | null = null;
  private organizationId: string | null = null;
  private pendingIceCandidates: RTCIceCandidate[] = [];
  private lastServerOffer: WebRTCServerOffer | null = null;
  
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
    this.reconnectionManager.setAsAdmin(true);
    
    console.log('WebRTC: Creating server offer for organization:', organizationId);
    
    const connection = new RTCPeerConnection(this.rtcConfiguration);
    this.localConnection = connection;
    
    // Server creates data channel for each client
    const dataChannel = connection.createDataChannel('location', {
      ordered: true
    });
    
    this.setupConnectionEventHandlers(connection);
    this.setupSignalingHandler();
    this.setupIPChangeHandling();

    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);

    const serverOffer: WebRTCServerOffer = {
      type: 'webrtc_server_offer',
      offer,
      adminId: this.userId,
      organizationId,
      organizationName,
      timestamp: Date.now(),
      serverIp: this.ipChangeManager.getCurrentIPSync()
    };

    this.lastServerOffer = serverOffer;
    return serverOffer;
  }

  async connectToServer(offerData: WebRTCServerOffer, userId: string, userName: string): Promise<void> {
    this.isAdmin = false;
    this.userId = userId;
    this.organizationId = offerData.organizationId;
    this.connectionManager.setAsServer(false);
    this.reconnectionManager.setAsAdmin(false);
    this.lastServerOffer = offerData;
    
    console.log('WebRTC: Connecting to server');
    
    const connection = new RTCPeerConnection(this.rtcConfiguration);
    this.localConnection = connection;
    
    connection.ondatachannel = (event) => {
      this.connectionManager.setupDataChannel(event.channel, offerData.adminId);
    };
    
    this.setupConnectionEventHandlers(connection);
    this.setupSignalingHandler();
    this.setupIPChangeHandling();

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

  private setupIPChangeHandling() {
    // Start IP monitoring
    this.ipChangeManager.startMonitoring();
    
    // Handle IP change events
    this.ipChangeManager.onIPChange((event: IPChangeEvent) => {
      this.handleIPChangeEvent(event);
    });
    
    // Handle reconnection state changes
    this.reconnectionManager.onReconnectionStateChange((peerId, state) => {
      console.log(`Reconnection state changed for ${peerId}: ${state}`);
      
      if (state === 'success') {
        this.ipChangeManager.setConnectionInstability(false);
      } else if (state === 'attempting') {
        this.ipChangeManager.setConnectionInstability(true);
      } else if (state === 'failed') {
        this.notifyConnectionLost(peerId);
      }
    });
  }

  private async handleIPChangeEvent(event: IPChangeEvent) {
    console.log('Handling IP change event:', event);
    
    if (event.source === 'local') {
      // Our IP changed
      await this.handleLocalIPChange(event);
    } else if (event.source === 'peer' && event.peerId) {
      // Peer's IP changed
      await this.handlePeerIPChange(event.peerId, event.oldIP, event.newIP);
    }
  }

  private async handleLocalIPChange(event: IPChangeEvent) {
    console.log('Local IP changed from', event.oldIP, 'to', event.newIP);
    
    // Notify all peers about our IP change
    this.connectionManager.notifyIpChange(event.newIP);
    
    if (this.isAdmin) {
      // Admin sends new offers to all clients
      await this.sendUpdatedOfferToAllClients(event.newIP);
    } else {
      // Client waits for new offer from admin or initiates reconnection if needed
      await this.handleClientIPChange();
    }
  }

  private async handlePeerIPChange(peerId: string, oldIP: string, newIP: string) {
    console.log(`Peer ${peerId} IP changed from ${oldIP} to ${newIP}`);
    
    if (this.isAdmin && this.reconnectionManager.shouldInitiateReconnection(peerId, 'ip-change')) {
      // Admin initiates reconnection for the client
      const attemptNumber = this.reconnectionManager.startReconnectionAttempt(peerId, 'ip-change');
      
      // Add delay before attempting
      const delay = this.reconnectionManager.getDelayForAttempt(attemptNumber);
      
      setTimeout(async () => {
        await this.sendUpdatedOfferToClient(peerId);
      }, delay);
    }
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
        if (!this.isAdmin) {
          await this.handleNewOffer(message.data, fromPeerId);
        }
        break;

      case 'new-answer':
        if (this.isAdmin && this.localConnection) {
          await this.localConnection.setRemoteDescription(message.data);
          this.reconnectionManager.markReconnectionSuccess(fromPeerId);
          console.log('Applied new answer from client and marked reconnection success');
        }
        break;

      case 'ice-candidate':
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
        this.ipChangeManager.handlePeerIPChange(fromPeerId, 'unknown', message.data.newIp);
        break;
    }
  }

  private async handleNewOffer(newOffer: WebRTCServerOffer, fromPeerId: string) {
    if (!this.localConnection) return;

    try {
      console.log('Applying new offer from admin');
      
      this.lastServerOffer = newOffer;
      
      await this.localConnection.setRemoteDescription(newOffer.offer);
      
      const answer = await this.localConnection.createAnswer();
      await this.localConnection.setLocalDescription(answer);
      
      this.connectionManager.sendNewAnswer(fromPeerId, answer);
      
      console.log('Sent new answer to admin');
    } catch (error) {
      console.error('Failed to handle new offer:', error);
    }
  }

  private async sendUpdatedOfferToAllClients(newIP: string) {
    if (!this.localConnection || !this.lastServerOffer) return;

    try {
      console.log('Sending updated offer to all clients due to IP change to:', newIP);
      
      const offer = await this.localConnection.createOffer({ iceRestart: true });
      await this.localConnection.setLocalDescription(offer);
      
      const newServerOffer: WebRTCServerOffer = {
        ...this.lastServerOffer,
        offer,
        timestamp: Date.now(),
        serverIp: newIP
      };
      
      this.lastServerOffer = newServerOffer;
      
      const connectedPeers = this.connectionManager.getConnectedPeers();
      connectedPeers.forEach(peer => {
        if (this.reconnectionManager.shouldInitiateReconnection(peer.id, 'ip-change')) {
          this.reconnectionManager.startReconnectionAttempt(peer.id, 'ip-change');
          this.connectionManager.sendNewOffer(peer.id, newServerOffer);
        }
      });
      
    } catch (error) {
      console.error('Failed to send updated offer to clients:', error);
    }
  }

  private async sendUpdatedOfferToClient(clientId: string) {
    if (!this.localConnection || !this.lastServerOffer) return;

    try {
      console.log('Sending updated offer to client:', clientId);
      
      const offer = await this.localConnection.createOffer({ iceRestart: true });
      await this.localConnection.setLocalDescription(offer);
      
      const newServerOffer: WebRTCServerOffer = {
        ...this.lastServerOffer,
        offer,
        timestamp: Date.now(),
        serverIp: this.ipChangeManager.getCurrentIPSync()
      };
      
      this.connectionManager.sendNewOffer(clientId, newServerOffer);
      
    } catch (error) {
      console.error('Failed to send updated offer to client:', error);
    }
  }

  private async handleClientIPChange() {
    // Client detected own IP change - wait for admin's new offer or timeout and reconnect
    console.log('Client IP changed, waiting for admin response...');
    
    // If no response from admin within 10 seconds, try to reconnect
    setTimeout(() => {
      const connectedPeers = this.connectionManager.getConnectedPeers();
      if (connectedPeers.length === 0 && this.lastServerOffer) {
        console.log('No admin response, attempting client-side reconnection...');
        this.handleConnectionLoss();
      }
    }, 10000);
  }

  private setupConnectionEventHandlers(connection: RTCPeerConnection) {
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.pendingIceCandidates.push(event.candidate);
        console.log('ICE candidate generated, total:', this.pendingIceCandidates.length);
        
        const peers = this.connectionManager.getConnectedPeers();
        peers.forEach(peer => {
          this.connectionManager.sendIceCandidate(peer.id, event.candidate!);
        });
      }
    };

    connection.onconnectionstatechange = () => {
      console.log('Connection state changed:', connection.connectionState);
      
      if (connection.connectionState === 'connected') {
        // Mark successful reconnection for all peers
        const peers = this.connectionManager.getConnectedPeers();
        peers.forEach(peer => {
          this.reconnectionManager.markReconnectionSuccess(peer.id);
        });
        
        this.ipChangeManager.setConnectionInstability(false);
        console.log('Successfully connected to peer');
      } else if (connection.connectionState === 'disconnected' || connection.connectionState === 'failed') {
        this.handleConnectionLoss();
      }
    };

    connection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', connection.iceConnectionState);
      
      if (connection.iceConnectionState === 'disconnected' || connection.iceConnectionState === 'failed') {
        this.handleConnectionLoss();
      }
    };
  }

  private handleConnectionLoss() {
    const peers = this.connectionManager.getConnectedPeers();
    
    peers.forEach(peer => {
      if (this.reconnectionManager.shouldInitiateReconnection(peer.id, 'connection-lost')) {
        const attemptNumber = this.reconnectionManager.startReconnectionAttempt(peer.id, 'connection-lost');
        
        // Add delay before attempting
        const delay = this.reconnectionManager.getDelayForAttempt(attemptNumber);
        
        setTimeout(async () => {
          await this.attemptReconnection(peer.id);
        }, delay);
      }
    });
  }

  private async attemptReconnection(peerId: string) {
    try {
      console.log('Attempting reconnection for peer:', peerId);
      
      if (!this.localConnection) {
        throw new Error('No local connection available');
      }
      
      // Try ICE restart first
      const offer = await this.localConnection.createOffer({ iceRestart: true });
      await this.localConnection.setLocalDescription(offer);
      
      if (this.isAdmin && this.lastServerOffer) {
        // Admin sends new offer
        const newServerOffer: WebRTCServerOffer = {
          ...this.lastServerOffer,
          offer,
          timestamp: Date.now(),
          serverIp: this.ipChangeManager.getCurrentIPSync()
        };
        
        this.connectionManager.sendNewOffer(peerId, newServerOffer);
      }
      
      console.log('Reconnection attempt initiated for:', peerId);
      
    } catch (error) {
      console.error('Reconnection attempt failed for', peerId, error);
      this.reconnectionManager.markReconnectionFailed(peerId);
    }
  }

  private notifyConnectionLost(peerId?: string) {
    console.log('Connection permanently lost for peer:', peerId);
    
    const event = new CustomEvent('webrtc-connection-lost', {
      detail: {
        isAdmin: this.isAdmin,
        organizationId: this.organizationId,
        peerId: peerId,
        reconnectionState: peerId ? this.reconnectionManager.getReconnectionState(peerId) : null
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
    const allStates = this.reconnectionManager.getAllReconnectionStates();
    return allStates.size > 0;
  }

  getReconnectAttempts(): number {
    const allStates = this.reconnectionManager.getAllReconnectionStates();
    if (allStates.size === 0) return 0;
    
    // Return the highest attempt number
    return Math.max(...Array.from(allStates.values()).map(state => state.attempt));
  }

  getDetailedReconnectionStatus(): Map<string, { isReconnecting: boolean; attempt: number; maxAttempts: number }> {
    const peers = this.connectionManager.getAllPeers();
    const statusMap = new Map();
    
    peers.forEach(peer => {
      statusMap.set(peer.id, this.reconnectionManager.getReconnectionState(peer.id));
    });
    
    return statusMap;
  }

  disconnect() {
    this.ipChangeManager.stopMonitoring();
    this.reconnectionManager.clearAllReconnections();

    if (this.localConnection) {
      this.localConnection.close();
      this.localConnection = null;
    }

    this.connectionManager.clearPeers();
    this.pendingIceCandidates = [];
    this.lastServerOffer = null;
  }

  async forceReconnect() {
    const peers = this.connectionManager.getConnectedPeers();
    
    // Clear existing reconnection attempts
    peers.forEach(peer => {
      this.reconnectionManager.clearReconnectionAttempt(peer.id);
    });
    
    // Force new reconnection attempts
    await this.handleConnectionLoss();
  }
}

export const webRTCService = new WebRTCService();
export type { WebRTCServerOffer, PeerConnection, WebRTCMessage };
