
import { WebRTCConnection } from './WebRTCConnection';
import { ConnectionManager } from './ConnectionManager';
import { IPChangeManager } from './IPChangeManager';
import { ReconnectionManager } from './ReconnectionManager';
import { WebRTCSignaling } from './WebRTCSignaling';
import { WebRTCEventHandler } from './WebRTCEventHandler';
import { WebRTCOfferManager } from './WebRTCOfferManager';
import { AutoReconnectionManager } from './AutoReconnectionManager';
import { EnhancedReconnectionManager } from './EnhancedReconnectionManager';

export class WebRTCServiceCore {
  public webrtcConnection = new WebRTCConnection();
  public connectionManager = new ConnectionManager();
  public ipChangeManager = new IPChangeManager();
  public reconnectionManager = new ReconnectionManager();
  public webrtcSignaling = new WebRTCSignaling();
  public eventHandler = new WebRTCEventHandler();
  public offerManager = new WebRTCOfferManager();
  public autoReconnectionManager = new AutoReconnectionManager();
  public enhancedReconnectionManager: EnhancedReconnectionManager | null = null;

  public isAdmin = false;
  public userId: string | null = null;
  public organizationId: string | null = null;

  updateStates(isAdmin: boolean, userId: string | null, organizationId: string | null): void {
    this.isAdmin = isAdmin;
    this.userId = userId;
    this.organizationId = organizationId;

    // Initialize enhanced reconnection manager
    if (userId && organizationId) {
      this.enhancedReconnectionManager = new EnhancedReconnectionManager(
        userId,
        organizationId,
        isAdmin
      );
      
      // Try to initialize lightweight signaling
      this.enhancedReconnectionManager.initialize().then(connected => {
        if (connected) {
          console.log('WebRTCServiceCore: Enhanced reconnection initialized');
          this.setupEnhancedReconnectionHandlers();
        } else {
          console.log('WebRTCServiceCore: Falling back to original reconnection system');
        }
      }).catch(error => {
        console.error('WebRTCServiceCore: Enhanced reconnection failed, using fallback:', error);
      });
    }
  }

  private setupEnhancedReconnectionHandlers(): void {
    // Handle reconnection events from enhanced manager
    window.addEventListener('webrtc-reconnection-requested', (event: CustomEvent) => {
      console.log('WebRTCServiceCore: Reconnection requested by admin');
      // Client should attempt to reconnect
    });

    window.addEventListener('webrtc-signaling-offer', (event: CustomEvent) => {
      const { offer, fromId } = event.detail;
      console.log('WebRTCServiceCore: Received signaling offer from:', fromId);
      // Handle the offer through existing WebRTC flow
    });

    window.addEventListener('webrtc-signaling-answer', (event: CustomEvent) => {
      const { answer, fromId } = event.detail;
      console.log('WebRTCServiceCore: Received signaling answer from:', fromId);
      // Handle the answer through existing WebRTC flow
    });

    window.addEventListener('webrtc-signaling-ice', (event: CustomEvent) => {
      const { candidate, fromId } = event.detail;
      console.log('WebRTCServiceCore: Received signaling ICE candidate from:', fromId);
      // Handle the ICE candidate through existing WebRTC flow
    });
  }

  getConnectionStatus(): 'disconnected' | 'connecting' | 'connected' {
    const state = this.webrtcConnection.getConnectionState();
    
    if (state === 'connected') return 'connected';
    if (state === 'connecting') return 'connecting';
    
    return 'disconnected';
  }

  isEnhancedSignalingAvailable(): boolean {
    return this.enhancedReconnectionManager?.isSignalingConnected() || false;
  }

  cleanup(): void {
    this.ipChangeManager.stopMonitoring();
    this.reconnectionManager.clearAllReconnections();
    this.webrtcConnection.close();
    this.connectionManager.clearPeers();
    this.offerManager.clearLastServerOffer();
    
    if (this.enhancedReconnectionManager) {
      this.enhancedReconnectionManager.cleanup();
      this.enhancedReconnectionManager = null;
    }
  }
}
