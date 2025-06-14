
import { WebRTCServerOffer, WebRTCMessage, PeerConnection } from './webrtc/types';
import { ConnectionManager } from './webrtc/ConnectionManager';
import { SignalingMessage } from './webrtc/SignalingService';
import { IPChangeManager, IPChangeEvent } from './webrtc/IPChangeManager';
import { ReconnectionManager } from './webrtc/ReconnectionManager';
import { WebRTCConnection } from './webrtc/WebRTCConnection';
import { WebRTCSignaling } from './webrtc/WebRTCSignaling';
import { WebRTCEventHandler } from './webrtc/WebRTCEventHandler';
import { WebRTCOfferManager } from './webrtc/WebRTCOfferManager';

class WebRTCService {
  private webrtcConnection = new WebRTCConnection();
  private connectionManager = new ConnectionManager();
  private ipChangeManager = new IPChangeManager();
  private reconnectionManager = new ReconnectionManager();
  private webrtcSignaling = new WebRTCSignaling();
  private eventHandler = new WebRTCEventHandler();
  private offerManager = new WebRTCOfferManager();
  
  private isAdmin = false;
  private userId: string | null = null;
  private organizationId: string | null = null;

  async createServerOffer(organizationId: string, organizationName: string): Promise<WebRTCServerOffer> {
    this.isAdmin = true;
    this.organizationId = organizationId;
    this.userId = `admin-${organizationId}-${Date.now()}`;
    
    this.connectionManager.setAsServer(true);
    this.reconnectionManager.setAsAdmin(true);
    
    console.log('WebRTC: Creating server offer for organization:', organizationId);
    
    const connection = this.webrtcConnection.createConnection();
    
    // Server creates data channel for each client
    const dataChannel = this.webrtcConnection.createDataChannel('location', {
      ordered: true
    });
    
    this.setupConnectionHandlers();
    this.setupIPChangeHandling();

    const serverOffer = await this.offerManager.createServerOffer(
      this.webrtcConnection,
      organizationId,
      organizationName,
      this.userId,
      this.ipChangeManager.getCurrentIPSync()
    );

    return serverOffer;
  }

  async connectToServer(offerData: WebRTCServerOffer, userId: string, userName: string): Promise<void> {
    this.isAdmin = false;
    this.userId = userId;
    this.organizationId = offerData.organizationId;
    
    this.connectionManager.setAsServer(false);
    this.reconnectionManager.setAsAdmin(false);
    this.offerManager.setLastServerOffer(offerData);
    
    console.log('WebRTC: Connecting to server');
    
    const connection = this.webrtcConnection.createConnection();
    
    this.setupConnectionHandlers();
    this.setupIPChangeHandling();

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

  private setupConnectionHandlers(): void {
    const connection = this.webrtcConnection.getConnection();
    if (!connection) return;

    this.eventHandler.setupConnectionEvents(connection, {
      onIceCandidate: (candidate) => {
        this.webrtcConnection.addPendingIceCandidate(candidate);
        console.log('ICE candidate generated');
        
        const peers = this.connectionManager.getConnectedPeers();
        peers.forEach(peer => {
          this.connectionManager.sendIceCandidate(peer.id, candidate);
        });
      },
      
      onConnectionStateChange: (state) => {
        if (state === 'connected') {
          const peers = this.connectionManager.getConnectedPeers();
          peers.forEach(peer => {
            this.reconnectionManager.markReconnectionSuccess(peer.id);
          });
          
          this.ipChangeManager.setConnectionInstability(false);
          console.log('Successfully connected to peer');
        } else if (state === 'disconnected' || state === 'failed') {
          this.handleConnectionLoss();
        }
      },
      
      onDataChannel: (channel) => {
        if (this.offerManager.getLastServerOffer()) {
          this.connectionManager.setupDataChannel(channel, this.offerManager.getLastServerOffer()!.adminId);
        }
      }
    });

    this.setupSignalingHandler();
  }

  private setupIPChangeHandling(): void {
    this.ipChangeManager.startMonitoring();
    
    this.ipChangeManager.onIPChange((event: IPChangeEvent) => {
      this.handleIPChangeEvent(event);
    });
    
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

  private async handleIPChangeEvent(event: IPChangeEvent): Promise<void> {
    console.log('Handling IP change event:', event);
    
    if (event.source === 'local') {
      await this.handleLocalIPChange(event);
    } else if (event.source === 'peer' && event.peerId) {
      await this.handlePeerIPChange(event.peerId, event.oldIP, event.newIP);
    }
  }

  private async handleLocalIPChange(event: IPChangeEvent): Promise<void> {
    console.log('Local IP changed from', event.oldIP, 'to', event.newIP);
    
    this.connectionManager.notifyIpChange(event.newIP);
    
    if (this.isAdmin) {
      await this.sendUpdatedOfferToAllClients(event.newIP);
    } else {
      await this.handleClientIPChange();
    }
  }

  private async handlePeerIPChange(peerId: string, oldIP: string, newIP: string): Promise<void> {
    console.log(`Peer ${peerId} IP changed from ${oldIP} to ${newIP}`);
    
    if (this.isAdmin && this.reconnectionManager.shouldInitiateReconnection(peerId, 'ip-change')) {
      const attemptNumber = this.reconnectionManager.startReconnectionAttempt(peerId, 'ip-change');
      const delay = this.reconnectionManager.getDelayForAttempt(attemptNumber);
      
      setTimeout(async () => {
        await this.sendUpdatedOfferToClient(peerId);
      }, delay);
    }
  }

  private setupSignalingHandler(): void {
    this.connectionManager.onSignalingMessage((message, fromPeerId) => {
      this.handleSignalingMessage(message, fromPeerId);
    });
  }

  private async handleSignalingMessage(message: SignalingMessage, fromPeerId: string): Promise<void> {
    console.log('Handling signaling message:', message.type, 'from:', fromPeerId);
    const connection = this.webrtcConnection.getConnection();
    if (!connection) return;

    switch (message.type) {
      case 'new-offer':
        if (!this.isAdmin) {
          await this.webrtcSignaling.handleNewOffer(
            message.data, 
            fromPeerId, 
            connection,
            (peerId, answer) => this.connectionManager.sendNewAnswer(peerId, answer)
          );
          this.offerManager.setLastServerOffer(message.data);
        }
        break;

      case 'new-answer':
        if (this.isAdmin) {
          await this.webrtcSignaling.handleNewAnswer(
            message.data,
            connection,
            () => this.reconnectionManager.markReconnectionSuccess(fromPeerId)
          );
        }
        break;

      case 'ice-candidate':
        await this.webrtcSignaling.handleIceCandidate(message.data, connection);
        break;

      case 'ip-changed':
        this.ipChangeManager.handlePeerIPChange(fromPeerId, 'unknown', message.data.newIp);
        break;
    }
  }

  private async sendUpdatedOfferToAllClients(newIP: string): Promise<void> {
    try {
      console.log('Sending updated offer to all clients due to IP change to:', newIP);
      
      const newServerOffer = await this.offerManager.createUpdatedOffer(
        this.webrtcConnection, 
        newIP, 
        { iceRestart: true }
      );
      
      if (!newServerOffer) return;
      
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

  private async sendUpdatedOfferToClient(clientId: string): Promise<void> {
    try {
      console.log('Sending updated offer to client:', clientId);
      
      const newServerOffer = await this.offerManager.createUpdatedOffer(
        this.webrtcConnection,
        this.ipChangeManager.getCurrentIPSync(),
        { iceRestart: true }
      );
      
      if (newServerOffer) {
        this.connectionManager.sendNewOffer(clientId, newServerOffer);
      }
      
    } catch (error) {
      console.error('Failed to send updated offer to client:', error);
    }
  }

  private async handleClientIPChange(): Promise<void> {
    console.log('Client IP changed, waiting for admin response...');
    
    setTimeout(() => {
      const connectedPeers = this.connectionManager.getConnectedPeers();
      if (connectedPeers.length === 0 && this.offerManager.getLastServerOffer()) {
        console.log('No admin response, attempting client-side reconnection...');
        this.handleConnectionLoss();
      }
    }, 10000);
  }

  private handleConnectionLoss(): void {
    const peers = this.connectionManager.getConnectedPeers();
    
    peers.forEach(peer => {
      if (this.reconnectionManager.shouldInitiateReconnection(peer.id, 'connection-lost')) {
        const attemptNumber = this.reconnectionManager.startReconnectionAttempt(peer.id, 'connection-lost');
        const delay = this.reconnectionManager.getDelayForAttempt(attemptNumber);
        
        setTimeout(async () => {
          await this.attemptReconnection(peer.id);
        }, delay);
      }
    });
  }

  private async attemptReconnection(peerId: string): Promise<void> {
    try {
      console.log('Attempting reconnection for peer:', peerId);
      
      const newServerOffer = await this.offerManager.createUpdatedOffer(
        this.webrtcConnection,
        this.ipChangeManager.getCurrentIPSync(),
        { iceRestart: true }
      );
      
      if (this.isAdmin && newServerOffer) {
        this.connectionManager.sendNewOffer(peerId, newServerOffer);
      }
      
      console.log('Reconnection attempt initiated for:', peerId);
      
    } catch (error) {
      console.error('Reconnection attempt failed for', peerId, error);
      this.reconnectionManager.markReconnectionFailed(peerId);
    }
  }

  private notifyConnectionLost(peerId?: string): void {
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

  // Public API methods
  requestLocationFromClient(clientId: string): void {
    if (!this.isAdmin) return;
    this.connectionManager.requestLocationUpdate(clientId);
  }

  requestLocationFromAllClients(): void {
    if (!this.isAdmin) return;
    this.connectionManager.requestLocationFromAllClients();
  }

  sendLocationUpdate(locationData: any): void {
    if (this.isAdmin) return;
    this.connectionManager.sendLocationUpdate(locationData);
  }

  onLocationUpdate(callback: (userId: string, location: any) => void): void {
    this.connectionManager.onLocationUpdate(callback);
  }

  onPeerStatusUpdate(callback: (peers: PeerConnection[]) => void): void {
    this.connectionManager.onPeerStatusUpdate(callback);
  }

  getConnectedPeers(): PeerConnection[] {
    return this.connectionManager.getConnectedPeers();
  }

  getConnectionStatus(): 'disconnected' | 'connecting' | 'connected' {
    const state = this.webrtcConnection.getConnectionState();
    
    if (state === 'connected') return 'connected';
    if (state === 'connecting') return 'connecting';
    
    return 'disconnected';
  }

  isCurrentlyReconnecting(): boolean {
    const allStates = this.reconnectionManager.getAllReconnectionStates();
    return allStates.size > 0;
  }

  getReconnectAttempts(): number {
    const allStates = this.reconnectionManager.getAllReconnectionStates();
    if (allStates.size === 0) return 0;
    
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

  disconnect(): void {
    this.ipChangeManager.stopMonitoring();
    this.reconnectionManager.clearAllReconnections();
    this.webrtcConnection.close();
    this.connectionManager.clearPeers();
    this.offerManager.clearLastServerOffer();
  }

  async forceReconnect(): Promise<void> {
    const peers = this.connectionManager.getConnectedPeers();
    
    peers.forEach(peer => {
      this.reconnectionManager.clearReconnectionAttempt(peer.id);
    });
    
    await this.handleConnectionLoss();
  }
}

export const webRTCService = new WebRTCService();
export type { WebRTCServerOffer, PeerConnection, WebRTCMessage };
