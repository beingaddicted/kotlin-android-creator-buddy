
import { WebSocketServer } from './server/WebSocketServer';
import { AdminElection } from './coordination/AdminElection';
import { DeviceInfo } from './types/DeviceTypes';

export interface MiniServerOptions {
  port?: number;
  organizationId: string;
  deviceInfo: DeviceInfo;
  autoStart?: boolean;
}

export class WebRTCMiniServer {
  private wsServer: WebSocketServer;
  private adminElection: AdminElection;
  private isRunning = false;

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
        if (client.ws.readyState === 1) { // WebSocket.OPEN
          client.ws.send(JSON.stringify({
            type: 'admin-heartbeat',
            data: event
          }));
        }
      });
    });

    // Handle mini server events
    const miniServer = this.wsServer.getMiniServer();
    
    miniServer.on('client-connected', (event) => {
      // Register new client as potential admin candidate if they have admin capabilities
      if (event.capabilities.includes('admin.manage')) {
        this.adminElection.registerCandidate({
          deviceId: event.clientId,
          deviceName: event.clientName,
          capabilities: event.capabilities,
          joinTime: Date.now(),
          lastSeen: Date.now(),
          priority: this.calculatePriority(event.capabilities)
        });
      }
    });

    miniServer.on('client-disconnected', (event) => {
      this.adminElection.removeCandidateFromElection(event.clientId);
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
  }

  private demoteFromAdmin(): void {
    console.log('MiniServer: Demoting from admin role');
    // Clean up admin-specific functionality
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    try {
      console.log('MiniServer: Starting WebRTC Mini Server');
      
      await this.wsServer.start();
      this.adminElection.start();
      
      this.isRunning = true;
      console.log('MiniServer: WebRTC Mini Server started successfully');
      
    } catch (error) {
      console.error('MiniServer: Failed to start:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('MiniServer: Stopping WebRTC Mini Server');
    
    this.adminElection.stop();
    await this.wsServer.stop();
    
    this.isRunning = false;
    console.log('MiniServer: WebRTC Mini Server stopped');
  }

  isServerRunning(): boolean {
    return this.isRunning && this.wsServer.isRunning();
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
      isRunning: this.isRunning,
      clientCount: miniServer.getClientCount(),
      currentAdmin: this.adminElection.getCurrentAdmin(),
      isAdmin: this.adminElection.isCurrentDeviceAdmin(),
      candidates: this.adminElection.getCandidates(),
      config: miniServer.getConfig()
    };
  }
}

// Export for easy instantiation
export { DeviceInfo } from './types/DeviceTypes';
export default WebRTCMiniServer;
