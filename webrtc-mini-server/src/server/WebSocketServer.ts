
import { BrowserEventEmitter } from '../utils/BrowserEventEmitter';
import { MiniServerCore } from '../core/MiniServerCore';

export interface WebSocketServerConfig {
  port: number;
  organizationId: string;
  deviceId: string;
  deviceName: string;
}

export class WebSocketServer extends BrowserEventEmitter {
  private miniServer: MiniServerCore;
  private isRunning = false;
  private config: WebSocketServerConfig;

  constructor(config: WebSocketServerConfig) {
    super();
    this.config = config;
    
    // Use MiniServerCore for browser-compatible WebSocket management
    this.miniServer = new MiniServerCore({
      port: config.port,
      organizationId: config.organizationId,
      deviceId: config.deviceId,
      deviceName: config.deviceName,
      heartbeatInterval: 10000,
      clientTimeout: 30000
    });

    this.setupMiniServerHandlers();
  }

  private setupMiniServerHandlers(): void {
    this.miniServer.on('server-started', (event) => {
      console.log('WebSocketServer: Mini server started for org:', event.organizationId);
      this.emit('server-started', event);
    });

    this.miniServer.on('server-stopped', () => {
      console.log('WebSocketServer: Mini server stopped');
      this.emit('server-stopped');
    });

    this.miniServer.on('client-connected', (event) => {
      console.log('WebSocketServer: Client connected:', event.clientId);
      this.emit('client-connected', event);
    });

    this.miniServer.on('client-disconnected', (event) => {
      console.log('WebSocketServer: Client disconnected:', event.clientId);
      this.emit('client-disconnected', event);
    });

    this.miniServer.on('location-update', (event) => {
      this.emit('location-update', event);
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    try {
      console.log('WebSocketServer: Starting on port', this.config.port);
      this.miniServer.start();
      this.isRunning = true;
      console.log('WebSocketServer: Started successfully');
    } catch (error) {
      console.error('WebSocketServer: Failed to start:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('WebSocketServer: Stopping...');
    this.miniServer.stop();
    this.isRunning = false;
    console.log('WebSocketServer: Stopped');
  }

  isRunning(): boolean {
    return this.isRunning && this.miniServer.isRunning();
  }

  getMiniServer(): MiniServerCore {
    return this.miniServer;
  }

  getConfig(): WebSocketServerConfig {
    return { ...this.config };
  }
}
