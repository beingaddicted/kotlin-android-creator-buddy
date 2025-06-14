
import { WebRTCConnection } from './WebRTCConnection';
import { ConnectionManager } from './ConnectionManager';
import { ReconnectionManager } from './ReconnectionManager';
import { WebRTCOfferManager } from './WebRTCOfferManager';
import { IPChangeManager } from './IPChangeManager';
import { ExponentialBackoff } from '@/utils/backoff';

export interface ReconnectionMetrics {
  successfulReconnections: number;
  failedReconnections: number;
  totalAttempts: number;
  averageReconnectionTime: number;
  lastReconnectionTime: number;
}

export class WebRTCReconnectionHandler {
  private webrtcConnection: WebRTCConnection;
  private connectionManager: ConnectionManager;
  private reconnectionManager: ReconnectionManager;
  private offerManager: WebRTCOfferManager;
  private ipChangeManager: IPChangeManager;
  private isAdmin: boolean;
  private backoff: ExponentialBackoff;
  private metrics: ReconnectionMetrics;
  private reconnectionTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    webrtcConnection: WebRTCConnection,
    connectionManager: ConnectionManager,
    reconnectionManager: ReconnectionManager,
    offerManager: WebRTCOfferManager,
    ipChangeManager: IPChangeManager,
    isAdmin: boolean
  ) {
    this.webrtcConnection = webrtcConnection;
    this.connectionManager = connectionManager;
    this.reconnectionManager = reconnectionManager;
    this.offerManager = offerManager;
    this.ipChangeManager = ipChangeManager;
    this.isAdmin = isAdmin;
    
    this.backoff = new ExponentialBackoff({
      initial: 2000,
      max: 30000,
      multiplier: 1.8,
      strategy: 'exponential'
    });
    
    this.metrics = {
      successfulReconnections: 0,
      failedReconnections: 0,
      totalAttempts: 0,
      averageReconnectionTime: 0,
      lastReconnectionTime: 0
    };
  }

  async sendUpdatedOfferToAllClients(newIP: string): Promise<void> {
    try {
      console.log('Sending updated offer to all clients due to IP change to:', newIP);
      
      const newServerOffer = await this.offerManager.createUpdatedOffer(
        this.webrtcConnection, 
        newIP, 
        { iceRestart: true }
      );
      
      if (!newServerOffer) {
        console.error('Failed to create updated offer');
        return;
      }
      
      const connectedPeers = this.connectionManager.getConnectedPeers();
      const reconnectionPromises = connectedPeers.map(async (peer) => {
        if (this.reconnectionManager.shouldInitiateReconnection(peer.id, 'ip-change')) {
          return this.initiateReconnectionForPeer(peer.id, newServerOffer, 'ip-change');
        }
      });
      
      await Promise.allSettled(reconnectionPromises);
      
    } catch (error) {
      console.error('Failed to send updated offer to clients:', error);
      this.metrics.failedReconnections++;
    }
  }

  async sendUpdatedOfferToClient(clientId: string): Promise<void> {
    try {
      console.log('Sending updated offer to client:', clientId);
      
      const newServerOffer = await this.offerManager.createUpdatedOffer(
        this.webrtcConnection,
        this.ipChangeManager.getCurrentIPSync(),
        { iceRestart: true }
      );
      
      if (newServerOffer) {
        await this.initiateReconnectionForPeer(clientId, newServerOffer, 'ip-change');
      }
      
    } catch (error) {
      console.error('Failed to send updated offer to client:', error);
      this.metrics.failedReconnections++;
    }
  }

  private async initiateReconnectionForPeer(
    peerId: string, 
    serverOffer: any, 
    reason: 'ip-change' | 'connection-lost'
  ): Promise<void> {
    const startTime = Date.now();
    this.metrics.totalAttempts++;
    
    try {
      this.reconnectionManager.startReconnectionAttempt(peerId, reason);
      
      // Clear any existing timeout
      const existingTimeout = this.reconnectionTimeouts.get(peerId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }
      
      // Send the offer
      this.connectionManager.sendNewOffer(peerId, serverOffer);
      
      // Set timeout for this reconnection attempt
      const timeout = setTimeout(() => {
        console.warn(`Reconnection timeout for peer ${peerId}`);
        this.handleReconnectionTimeout(peerId);
      }, 15000); // 15 second timeout
      
      this.reconnectionTimeouts.set(peerId, timeout);
      
      console.log(`Reconnection initiated for ${peerId} (${reason})`);
      
    } catch (error) {
      console.error('Failed to initiate reconnection for', peerId, error);
      this.handleReconnectionFailure(peerId, startTime);
    }
  }

  private handleReconnectionTimeout(peerId: string): void {
    this.reconnectionTimeouts.delete(peerId);
    this.reconnectionManager.markReconnectionFailed(peerId);
    this.metrics.failedReconnections++;
    
    // Trigger a new attempt with backoff if not at max attempts
    const state = this.reconnectionManager.getReconnectionState(peerId);
    if (state.isReconnecting && state.attempt < state.maxAttempts) {
      const delay = this.backoff.getNextInterval();
      console.log(`Scheduling retry for ${peerId} in ${delay}ms`);
      
      setTimeout(() => {
        this.attemptReconnection(peerId);
      }, delay);
    }
  }

  private handleReconnectionFailure(peerId: string, startTime: number): void {
    const duration = Date.now() - startTime;
    this.metrics.failedReconnections++;
    this.updateAverageReconnectionTime(duration);
    this.reconnectionManager.markReconnectionFailed(peerId);
    
    const timeout = this.reconnectionTimeouts.get(peerId);
    if (timeout) {
      clearTimeout(timeout);
      this.reconnectionTimeouts.delete(peerId);
    }
  }

  async attemptReconnection(peerId: string): Promise<void> {
    try {
      console.log('Attempting reconnection for peer:', peerId);
      
      const newServerOffer = await this.offerManager.createUpdatedOffer(
        this.webrtcConnection,
        this.ipChangeManager.getCurrentIPSync(),
        { iceRestart: true }
      );
      
      if (this.isAdmin && newServerOffer) {
        await this.initiateReconnectionForPeer(peerId, newServerOffer, 'connection-lost');
      }
      
    } catch (error) {
      console.error('Reconnection attempt failed for', peerId, error);
      this.handleReconnectionFailure(peerId, Date.now());
    }
  }

  // Called when a reconnection succeeds
  markReconnectionSuccess(peerId: string): void {
    const timeout = this.reconnectionTimeouts.get(peerId);
    if (timeout) {
      clearTimeout(timeout);
      this.reconnectionTimeouts.delete(peerId);
    }
    
    this.metrics.successfulReconnections++;
    this.metrics.lastReconnectionTime = Date.now();
    this.backoff.reset(); // Reset backoff on success
    
    console.log(`Reconnection successful for ${peerId}. Success rate: ${this.getSuccessRate().toFixed(2)}%`);
  }

  async forceReconnect(): Promise<void> {
    const peers = this.connectionManager.getConnectedPeers();
    
    // Clear all existing reconnection attempts
    peers.forEach(peer => {
      this.reconnectionManager.clearReconnectionAttempt(peer.id);
      const timeout = this.reconnectionTimeouts.get(peer.id);
      if (timeout) {
        clearTimeout(timeout);
        this.reconnectionTimeouts.delete(peer.id);
      }
    });
    
    // Trigger force reconnect event
    const event = new CustomEvent('webrtc-force-reconnect', {
      detail: { 
        timestamp: Date.now(),
        peerCount: peers.length,
        isAdmin: this.isAdmin
      }
    });
    window.dispatchEvent(event);
  }

  private updateAverageReconnectionTime(duration: number): void {
    const totalReconnections = this.metrics.successfulReconnections + this.metrics.failedReconnections;
    if (totalReconnections === 1) {
      this.metrics.averageReconnectionTime = duration;
    } else {
      this.metrics.averageReconnectionTime = 
        ((this.metrics.averageReconnectionTime * (totalReconnections - 1)) + duration) / totalReconnections;
    }
  }

  getSuccessRate(): number {
    const total = this.metrics.successfulReconnections + this.metrics.failedReconnections;
    return total > 0 ? (this.metrics.successfulReconnections / total) * 100 : 0;
  }

  getMetrics(): ReconnectionMetrics & { successRate: number; backoffMetrics: any } {
    return {
      ...this.metrics,
      successRate: this.getSuccessRate(),
      backoffMetrics: this.backoff.getMetrics()
    };
  }

  // Cleanup method
  cleanup(): void {
    this.reconnectionTimeouts.forEach(timeout => clearTimeout(timeout));
    this.reconnectionTimeouts.clear();
    this.backoff.reset();
  }
}
