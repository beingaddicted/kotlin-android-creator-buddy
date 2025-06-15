
import { WebRTCServerOffer } from './types';
import { TURNServerManager } from './TURNServerManager';
import { ConnectionHealthMonitor } from './ConnectionHealthMonitor';
import { ErrorContextManager } from './ErrorContextManager';

export class WebRTCConnection {
  private connection: RTCPeerConnection | null = null;
  private pendingIceCandidates: RTCIceCandidate[] = [];
  private turnManager = new TURNServerManager();
  private healthMonitor = new ConnectionHealthMonitor();
  private errorManager = new ErrorContextManager();
  
  private rtcConfiguration: RTCConfiguration;

  constructor() {
    this.rtcConfiguration = {
      iceServers: this.turnManager.getICEServers(),
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    };

    // Setup error monitoring
    this.errorManager.onError((error) => {
      this.handleConnectionError(error);
    });
  }

  createConnection(): RTCPeerConnection {
    try {
      this.connection = new RTCPeerConnection(this.rtcConfiguration);
      
      // Setup enhanced error handling
      this.connection.onicecandidateerror = (event) => {
        this.errorManager.logError(
          'ICE_CANDIDATE_ERROR',
          `ICE candidate error: ${event.errorText}`,
          this.connection,
          { errorCode: event.errorCode, url: event.url }
        );
      };

      // Setup health monitoring
      this.healthMonitor.setConnection(this.connection);
      this.healthMonitor.startMonitoring();

      console.log('WebRTC connection created with enhanced configuration');
      return this.connection;
    } catch (error) {
      this.errorManager.logError(
        'CONNECTION_CREATION_FAILED',
        `Failed to create RTCPeerConnection: ${error}`,
        undefined,
        { error: error instanceof Error ? error.message : String(error) }
      );
      throw error;
    }
  }

  getConnection(): RTCPeerConnection | null {
    return this.connection;
  }

  async createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit> {
    if (!this.connection) throw new Error('No connection available');
    
    try {
      const enhancedOptions = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
        iceRestart: false,
        ...options
      };

      const offer = await this.connection.createOffer(enhancedOptions);
      await this.connection.setLocalDescription(offer);
      
      console.log('Offer created successfully with options:', enhancedOptions);
      return offer;
    } catch (error) {
      this.errorManager.logError(
        'OFFER_CREATION_FAILED',
        `Failed to create offer: ${error}`,
        this.connection,
        { options }
      );
      throw error;
    }
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.connection) throw new Error('No connection available');
    
    try {
      const answer = await this.connection.createAnswer();
      await this.connection.setLocalDescription(answer);
      
      console.log('Answer created successfully');
      return answer;
    } catch (error) {
      this.errorManager.logError(
        'ANSWER_CREATION_FAILED',
        `Failed to create answer: ${error}`,
        this.connection
      );
      throw error;
    }
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (!this.connection) throw new Error('No connection available');
    
    try {
      await this.connection.setRemoteDescription(description);
      console.log('Remote description set successfully');
      
      // Process pending ICE candidates after setting remote description
      await this.processPendingIceCandidates();
    } catch (error) {
      this.errorManager.logError(
        'REMOTE_DESCRIPTION_FAILED',
        `Failed to set remote description: ${error}`,
        this.connection,
        { description }
      );
      throw error;
    }
  }

  async addIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    if (!this.connection) throw new Error('No connection available');
    
    try {
      await this.connection.addIceCandidate(candidate);
      console.log('ICE candidate added successfully');
    } catch (error) {
      this.errorManager.logError(
        'ICE_CANDIDATE_FAILED',
        `Failed to add ICE candidate: ${error}`,
        this.connection,
        { candidate: candidate.candidate }
      );
      
      // Don't throw, as this is recoverable
      console.warn('ICE candidate failed, but continuing:', error);
    }
  }

  addPendingIceCandidate(candidate: RTCIceCandidate): void {
    this.pendingIceCandidates.push(candidate);
    console.log('ICE candidate queued, total pending:', this.pendingIceCandidates.length);
  }

  async processPendingIceCandidates(): Promise<void> {
    if (!this.connection || this.pendingIceCandidates.length === 0) return;
    
    console.log('Processing', this.pendingIceCandidates.length, 'pending ICE candidates');
    
    const candidates = [...this.pendingIceCandidates];
    this.pendingIceCandidates = [];
    
    for (const candidate of candidates) {
      try {
        await this.connection.addIceCandidate(candidate);
      } catch (error) {
        console.warn('Failed to add pending ICE candidate:', error);
        // Continue processing other candidates
      }
    }
  }

  createDataChannel(label: string, options?: RTCDataChannelInit): RTCDataChannel {
    if (!this.connection) throw new Error('No connection available');
    
    const enhancedOptions = {
      ordered: true,
      maxRetransmits: 3,
      ...options
    };
    
    try {
      const channel = this.connection.createDataChannel(label, enhancedOptions);
      console.log('Data channel created:', label, 'with options:', enhancedOptions);
      return channel;
    } catch (error) {
      this.errorManager.logError(
        'DATA_CHANNEL_CREATION_FAILED',
        `Failed to create data channel: ${error}`,
        this.connection,
        { label, options: enhancedOptions }
      );
      throw error;
    }
  }

  getConnectionState(): RTCPeerConnectionState {
    return this.connection?.connectionState || 'closed';
  }

  getIceConnectionState(): RTCIceConnectionState {
    return this.connection?.iceConnectionState || 'closed';
  }

  async restartIce(): Promise<void> {
    if (!this.connection) throw new Error('No connection available');
    
    try {
      console.log('Restarting ICE...');
      this.connection.restartIce();
      
      this.errorManager.updateRecoveryAttempt('ICE_CONNECTION_FAILED', 'ice_restart', true);
      console.log('ICE restart initiated successfully');
    } catch (error) {
      this.errorManager.logError(
        'ICE_RESTART_FAILED',
        `Failed to restart ICE: ${error}`,
        this.connection
      );
      this.errorManager.updateRecoveryAttempt('ICE_CONNECTION_FAILED', 'ice_restart', false);
      throw error;
    }
  }

  async testConnectivity(): Promise<boolean> {
    return await this.turnManager.testConnectivity();
  }

  getHealthMonitor(): ConnectionHealthMonitor {
    return this.healthMonitor;
  }

  getErrorManager(): ErrorContextManager {
    return this.errorManager;
  }

  private handleConnectionError(error: any): void {
    // Emit custom event for error handling at service level
    const event = new CustomEvent('webrtc-connection-error', {
      detail: error
    });
    window.dispatchEvent(event);
  }

  close(): void {
    this.healthMonitor.stopMonitoring();
    
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    this.pendingIceCandidates = [];
    
    console.log('WebRTC connection closed and cleaned up');
  }
}
