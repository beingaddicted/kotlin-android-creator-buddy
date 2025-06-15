
import { WebRTCMiniServer, MiniServerOptions, DeviceInfo } from '../../../webrtc-mini-server/src/index';
import { DeviceIDManager } from './DeviceIDManager';
import { WebRTCServerOffer } from './types';

export class MiniServerBridge {
  private miniServer: WebRTCMiniServer | null = null;
  private isRunning = false;
  private onServerOfferGenerated?: (offer: WebRTCServerOffer) => void;

  async startMiniServer(organizationId: string): Promise<WebRTCServerOffer> {
    if (this.miniServer && this.isRunning) {
      throw new Error('Mini server is already running');
    }

    const deviceId = DeviceIDManager.getOrCreateDeviceId();
    const deviceInfo = DeviceIDManager.getDeviceInfo();
    
    if (!deviceInfo) {
      throw new Error('Device info not available for mini server');
    }

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
    
    return serverOffer;
  }

  async stopMiniServer(): Promise<void> {
    if (this.miniServer && this.isRunning) {
      await this.miniServer.stop();
      this.miniServer = null;
      this.isRunning = false;
      
      // Remove temporary server flag
      DeviceIDManager.markAsTemporaryServer(false);
    }
  }

  private setupEventHandlers(): void {
    if (!this.miniServer) return;

    // Listen for admin election events
    window.addEventListener('webrtc-admin-reconnected', () => {
      console.log('MiniServerBridge: Admin reconnected, stopping mini server');
      this.stopMiniServer();
    });

    // Forward mini server events to main WebRTC system
    window.addEventListener('webrtc-client-connected', (event: CustomEvent) => {
      console.log('MiniServerBridge: Client connected to mini server', event.detail);
    });
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
    return priority;
  }

  isServerRunning(): boolean {
    return this.isRunning && this.miniServer?.isServerRunning() || false;
  }

  getServerStats(): any {
    return this.miniServer?.getServerStats() || null;
  }

  getCurrentAdmin(): string | null {
    return this.miniServer?.getCurrentAdmin() || null;
  }

  getConnectedClients(): any[] {
    return this.miniServer?.getConnectedClients() || [];
  }

  onServerOfferReady(callback: (offer: WebRTCServerOffer) => void): void {
    this.onServerOfferGenerated = callback;
  }
}
