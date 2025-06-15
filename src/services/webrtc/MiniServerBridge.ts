
import { WebRTCMiniServer, MiniServerOptions, DeviceInfo } from '../../../webrtc-mini-server/src/index';
import { DeviceIDManager } from './DeviceIDManager';
import { WebRTCServerOffer } from './types';
import { AndroidWebRTCOptimizer } from './AndroidWebRTCOptimizer';

export class MiniServerBridge {
  private miniServer: WebRTCMiniServer | null = null;
  private isRunning = false;
  private onServerOfferGenerated?: (offer: WebRTCServerOffer) => void;
  private androidOptimizer: AndroidWebRTCOptimizer;

  constructor() {
    this.androidOptimizer = AndroidWebRTCOptimizer.getInstance();
  }

  async startMiniServer(organizationId: string): Promise<WebRTCServerOffer> {
    if (this.miniServer && this.isRunning) {
      throw new Error('Mini server is already running');
    }

    const deviceId = DeviceIDManager.getOrCreateDeviceId();
    const deviceInfo = DeviceIDManager.getDeviceInfo();
    
    if (!deviceInfo) {
      throw new Error('Device info not available for mini server');
    }

    // Apply Android optimizations
    const networkOptimizations = this.androidOptimizer.getNetworkOptimizations();

    const options: MiniServerOptions = {
      port: 8080, // Use different port than main signaling server
      organizationId,
      deviceInfo: {
        deviceId,
        deviceName: deviceInfo.deviceName,
        deviceType: 'client', // Mini server runs on client devices
        organizationId,
        capabilities: [...deviceInfo.capabilities, 'server.temporary'],
        joinTime: Date.now(),
        lastSeen: Date.now(),
        priority: this.calculatePriority(deviceInfo.capabilities),
        isTemporaryServer: true
      },
      autoStart: false
    };

    this.miniServer = new WebRTCMiniServer(options);
    
    // Set up event handlers
    this.setupEventHandlers();
    
    await this.miniServer.start();
    this.isRunning = true;

    // Generate server offer for other clients to connect
    const serverOffer = await this.generateServerOffer(organizationId);
    
    // Mark device as temporary server
    DeviceIDManager.markAsTemporaryServer(true);
    
    // Emit mini server started event
    const event = new CustomEvent('webrtc-mini-server-started', {
      detail: { serverOffer, organizationId }
    });
    window.dispatchEvent(event);
    
    return serverOffer;
  }

  async stopMiniServer(): Promise<void> {
    if (this.miniServer && this.isRunning) {
      await this.miniServer.stop();
      this.miniServer = null;
      this.isRunning = false;
      
      // Remove temporary server flag
      DeviceIDManager.markAsTemporaryServer(false);
      
      // Emit mini server stopped event
      const event = new CustomEvent('webrtc-mini-server-stopped');
      window.dispatchEvent(event);
    }
  }

  private setupEventHandlers(): void {
    if (!this.miniServer) return;

    // Listen for admin election events from the mini server
    window.addEventListener('webrtc-admin-elected', (event: CustomEvent) => {
      const { adminId, isOwnDevice } = event.detail;
      console.log('MiniServerBridge: Admin elected:', adminId, 'isOwn:', isOwnDevice);
      
      // Forward to main WebRTC service
      const forwardEvent = new CustomEvent('webrtc-admin-elected', {
        detail: { adminId, isOwnDevice }
      });
      window.dispatchEvent(forwardEvent);
    });

    // Listen for admin reconnection
    window.addEventListener('webrtc-admin-reconnected', () => {
      console.log('MiniServerBridge: Admin reconnected, stopping mini server');
      this.stopMiniServer();
    });

    // Forward mini server events to main WebRTC system
    window.addEventListener('webrtc-client-connected', (event: CustomEvent) => {
      console.log('MiniServerBridge: Client connected to mini server', event.detail);
      
      // Notify integration layer
      const integratedEvent = new CustomEvent('webrtc-device-connected', {
        detail: {
          deviceInfo: {
            deviceId: event.detail.clientId,
            deviceName: event.detail.clientName,
            capabilities: event.detail.capabilities || [],
            organizationId: event.detail.organizationId
          }
        }
      });
      window.dispatchEvent(integratedEvent);
    });

    window.addEventListener('webrtc-client-disconnected', (event: CustomEvent) => {
      console.log('MiniServerBridge: Client disconnected from mini server', event.detail);
      
      // Notify integration layer
      const integratedEvent = new CustomEvent('webrtc-device-disconnected', {
        detail: { deviceId: event.detail.clientId }
      });
      window.dispatchEvent(integratedEvent);
    });

    // Handle Android-specific events
    if (this.androidOptimizer.isAndroidEnvironment()) {
      window.addEventListener('android-app-backgrounded', () => {
        console.log('MiniServerBridge: App backgrounded, reducing mini server activity');
        this.handleAppBackgrounded();
      });

      window.addEventListener('android-app-foregrounded', () => {
        console.log('MiniServerBridge: App foregrounded, resuming mini server activity');
        this.handleAppForegrounded();
      });
    }
  }

  private handleAppBackgrounded(): void {
    // Reduce mini server activity when app is backgrounded
    if (this.miniServer && this.isRunning) {
      // Could implement heartbeat reduction or other optimizations here
      console.log('MiniServerBridge: Reducing activity for backgrounded app');
    }
  }

  private handleAppForegrounded(): void {
    // Resume normal mini server activity when app is foregrounded
    if (this.miniServer && this.isRunning) {
      console.log('MiniServerBridge: Resuming normal activity for foregrounded app');
      
      // Check if mini server is still functioning properly
      const stats = this.getServerStats();
      if (!stats || !stats.isRunning) {
        console.warn('MiniServerBridge: Mini server appears to have stopped, attempting restart');
        // Could implement restart logic here
      }
    }
  }

  private async generateServerOffer(organizationId: string): Promise<WebRTCServerOffer> {
    const deviceId = DeviceIDManager.getOrCreateDeviceId();
    const deviceInfo = DeviceIDManager.getDeviceInfo();
    
    // Create a mock offer for now - in real implementation this would create actual WebRTC offer
    const serverOffer: WebRTCServerOffer = {
      type: 'webrtc_server_offer',
      offer: {
        type: 'offer',
        sdp: 'mock-sdp-for-mini-server' // This should be actual SDP in real implementation
      },
      adminId: deviceId,
      organizationId,
      organizationName: `Temp Server ${deviceId.slice(-4)}`,
      timestamp: Date.now(),
      serverIp: window.location.hostname // Use current device IP
    };

    if (this.onServerOfferGenerated) {
      this.onServerOfferGenerated(serverOffer);
    }

    return serverOffer;
  }

  private calculatePriority(capabilities: string[]): number {
    let priority = capabilities.length;
    if (capabilities.includes('location.view')) priority += 5;
    if (capabilities.includes('admin.manage')) priority += 10;
    if (capabilities.includes('server.temporary')) priority += 3;
    
    // Android devices get slightly lower priority for server role
    if (this.androidOptimizer.isAndroidEnvironment()) {
      priority -= 1;
    }
    
    return priority;
  }

  isServerRunning(): boolean {
    return this.isRunning && (this.miniServer?.isServerRunning() || false);
  }

  getServerStats(): any {
    if (!this.miniServer) return null;
    
    const stats = this.miniServer.getServerStats();
    if (stats) {
      // Add Android-specific stats
      stats.isAndroid = this.androidOptimizer.isAndroidEnvironment();
      if (stats.isAndroid) {
        stats.androidOptimizations = this.androidOptimizer.getNetworkOptimizations();
      }
    }
    
    return stats;
  }

  getCurrentAdmin(): string | null {
    return this.miniServer?.getCurrentAdmin() || null;
  }

  getConnectedClients(): any[] {
    return this.miniServer?.getConnectedClients() || [];
  }

  isCurrentDeviceAdmin(): boolean {
    return this.miniServer?.isCurrentDeviceAdmin() || false;
  }

  onServerOfferReady(callback: (offer: WebRTCServerOffer) => void): void {
    this.onServerOfferGenerated = callback;
  }

  // Enhanced methods for integration
  getMiniServerInstance(): WebRTCMiniServer | null {
    return this.miniServer;
  }

  getAdminElectionCandidates(): any[] {
    if (!this.miniServer) return [];
    
    const stats = this.miniServer.getServerStats();
    return stats?.candidates || [];
  }

  triggerAdminElection(): void {
    if (this.miniServer) {
      // Trigger election through event system
      const event = new CustomEvent('webrtc-trigger-admin-election');
      window.dispatchEvent(event);
    }
  }
}
