
import { WebSocketServer } from './server/WebSocketServer';
import { AdminElection } from './coordination/AdminElection';
import type { DeviceInfo } from './types/DeviceTypes';

export interface MiniServerOptions {
  port?: number;
  organizationId: string;
  deviceInfo: DeviceInfo;
  autoStart?: boolean;
}

export class WebRTCMiniServer {
  private wsServer: WebSocketServer;
  private adminElection: AdminElection;
  private serverRunning = false;

  constructor(options: MiniServerOptions) {
    const port = options.port || 8080;
    
    this.wsServer = new WebSocketServer({
      port,
      organizationId: options.organizationId,
      deviceId: options.deviceInfo.deviceId,
      deviceName: options.deviceInfo.deviceName
    });

    this.adminElection = new AdminElection(
      options.organizationId,
      options.deviceInfo.deviceId,
      options.deviceInfo.deviceName,
      options.deviceInfo.capabilities
    );

    this.setupEventHandlers();

    if (options.autoStart) {
      this.start().catch(console.error);
    }
  }

  private setupEventHandlers(): void {
    // Handle admin election events
    this.adminElection.on('admin-elected', (event) => {
      console.log('MiniServer: New admin elected:', event.adminId);
      
      // Emit to window for integration with main WebRTC service
      const windowEvent = new CustomEvent('webrtc-admin-elected', {
        detail: {
          adminId: event.adminId,
          adminName: event.adminName,
          previousAdmin: event.previousAdmin,
          isOwnDevice: event.isOwnDevice
        }
      });
      window.dispatchEvent(windowEvent);
      
      if (event.isOwnDevice) {
        console.log('MiniServer: This device is now the admin');
        this.promoteToAdmin();
      } else {
        console.log('MiniServer: Another device is admin, demoting if needed');
        this.demoteFromAdmin();
      }
    });

    this.adminElection.on('heartbeat-broadcast', (event) => {
      // Broadcast heartbeat to connected clients
      const miniServer = this.wsServer.getMiniServer();
      const clients = miniServer.getConnectedClients();
      
      clients.forEach(client => {
        if (client.ws && client.ws.readyState === 1) { // WebSocket.OPEN
          try {
            client.ws.send(JSON.stringify({
              type: 'admin-heartbeat',
              data: event
            }));
          } catch (error) {
            console.error('MiniServer: Failed to send heartbeat to client:', error);
          }
        }
      });

      // Emit to window for main WebRTC service
      const windowEvent = new CustomEvent('webrtc-admin-heartbeat', {
        detail: { adminId: event.deviceId, timestamp: event.timestamp }
      });
      window.dispatchEvent(windowEvent);
    });

    // Handle mini server events
    const miniServer = this.wsServer.getMiniServer();
    
    miniServer.on('client-connected', (event) => {
      console.log('MiniServer: Client connected:', event.clientId);
      
      // Register new client as potential admin candidate if they have admin capabilities
      if (event.capabilities && event.capabilities.includes('admin.manage')) {
        this.adminElection.registerCandidate({
          deviceId: event.clientId,
          deviceName: event.clientName,
          capabilities: event.capabilities,
          joinTime: Date.now(),
          lastSeen: Date.now(),
          priority: this.calculatePriority(event.capabilities)
        });
      }

      // Emit to window for main WebRTC service integration
      const windowEvent = new CustomEvent('webrtc-client-connected', {
        detail: {
          clientId: event.clientId,
          clientName: event.clientName,
          capabilities: event.capabilities || [],
          organizationId: this.wsServer.getConfig().organizationId
        }
      });
      window.dispatchEvent(windowEvent);
    });

    miniServer.on('client-disconnected', (event) => {
      console.log('MiniServer: Client disconnected:', event.clientId);
      
      this.adminElection.removeCandidateFromElection(event.clientId);

      // Emit to window for main WebRTC service integration
      const windowEvent = new CustomEvent('webrtc-client-disconnected', {
        detail: { clientId: event.clientId }
      });
      window.dispatchEvent(windowEvent);
    });

    miniServer.on('location-update', (event) => {
      console.log('MiniServer: Location update received:', event);
      
      // Emit to window for main WebRTC service integration
      const windowEvent = new CustomEvent('webrtc-location-update', {
        detail: event
      });
      window.dispatchEvent(windowEvent);
    });

    // Listen for external admin election triggers
    window.addEventListener('webrtc-trigger-admin-election', () => {
      console.log('MiniServer: External admin election trigger received');
      if (this.adminElection.isRunning()) {
        // Force a new election by removing current admin
        const currentAdmin = this.adminElection.getCurrentAdmin();
        if (currentAdmin) {
          this.adminElection.removeCandidateFromElection(currentAdmin);
        }
      }
    });

    // Listen for app lifecycle events (Android)
    window.addEventListener('webrtc-reduce-activity', () => {
      console.log('MiniServer: Reducing activity due to app backgrounding');
      // Could implement heartbeat reduction here
    });

    window.addEventListener('webrtc-resume-activity', () => {
      console.log('MiniServer: Resuming normal activity');
      // Could implement activity restoration here
    });
  }

  private calculatePriority(capabilities: string[]): number {
    let priority = capabilities.length;
    if (capabilities.includes('location.view')) priority += 5;
    if (capabilities.includes('admin.manage')) priority += 10;
    if (capabilities.includes('server.temporary')) priority += 3;
    return priority;
  }

  private promoteToAdmin(): void {
    console.log('MiniServer: Promoting to admin role');
    // Additional admin-specific functionality can be added here
    
    // Emit promotion event
    const event = new CustomEvent('webrtc-mini-server-promoted-to-admin', {
      detail: { deviceId: this.wsServer.getConfig().deviceId }
    });
    window.dispatchEvent(event);
  }

  private demoteFromAdmin(): void {
    console.log('MiniServer: Demoting from admin role');
    // Clean up admin-specific functionality
    
    // Emit demotion event
    const event = new CustomEvent('webrtc-mini-server-demoted-from-admin', {
      detail: { deviceId: this.wsServer.getConfig().deviceId }
    });
    window.dispatchEvent(event);
  }

  async start(): Promise<void> {
    if (this.serverRunning) return;

    try {
      console.log('MiniServer: Starting WebRTC Mini Server');
      
      await this.wsServer.start();
      this.adminElection.start();
      
      this.serverRunning = true;
      console.log('MiniServer: WebRTC Mini Server started successfully');
      
      // Emit started event
      const event = new CustomEvent('webrtc-mini-server-started', {
        detail: { 
          organizationId: this.wsServer.getConfig().organizationId,
          deviceId: this.wsServer.getConfig().deviceId
        }
      });
      window.dispatchEvent(event);
      
    } catch (error) {
      console.error('MiniServer: Failed to start:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.serverRunning) return;

    console.log('MiniServer: Stopping WebRTC Mini Server');
    
    this.adminElection.stop();
    await this.wsServer.stop();
    
    this.serverRunning = false;
    console.log('MiniServer: WebRTC Mini Server stopped');
    
    // Emit stopped event
    const event = new CustomEvent('webrtc-mini-server-stopped', {
      detail: { organizationId: this.wsServer.getConfig().organizationId }
    });
    window.dispatchEvent(event);
  }

  isServerRunning(): boolean {
    return this.serverRunning && this.wsServer.isRunning();
  }

  getCurrentAdmin(): string | null {
    return this.adminElection.getCurrentAdmin();
  }

  isCurrentDeviceAdmin(): boolean {
    return this.adminElection.isCurrentDeviceAdmin();
  }

  getConnectedClients(): any[] {
    return this.wsServer.getMiniServer().getConnectedClients();
  }

  getServerStats(): any {
    const miniServer = this.wsServer.getMiniServer();
    return {
      isRunning: this.serverRunning,
      clientCount: miniServer.getClientCount(),
      currentAdmin: this.adminElection.getCurrentAdmin(),
      isAdmin: this.adminElection.isCurrentDeviceAdmin(),
      candidates: this.adminElection.getCandidates(),
      config: miniServer.getConfig(),
      adminElectionActive: this.adminElection.isElectionActive()
    };
  }

  // Enhanced methods for better integration
  getAdminElection(): AdminElection {
    return this.adminElection;
  }

  getWebSocketServer(): WebSocketServer {
    return this.wsServer;
  }

  forceAdminElection(): void {
    if (this.adminElection.isRunning()) {
      const event = new CustomEvent('webrtc-trigger-admin-election');
      window.dispatchEvent(event);
    }
  }

  updateCandidateHeartbeat(deviceId: string): void {
    this.adminElection.updateCandidateHeartbeat(deviceId);
  }

  registerExternalCandidate(candidate: any): void {
    this.adminElection.registerCandidate(candidate);
  }
}

// Export for easy instantiation
export type { DeviceInfo } from './types/DeviceTypes';
export default WebRTCMiniServer;
