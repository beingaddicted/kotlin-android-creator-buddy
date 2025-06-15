
import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { MiniServerCore } from '../core/MiniServerCore';

export interface WebSocketServerConfig {
  port: number;
  organizationId: string;
  deviceId: string;
  deviceName: string;
}

export class WebSocketServer {
  private wss: WSServer | null = null;
  private miniServer: MiniServerCore;
  private config: WebSocketServerConfig;

  constructor(config: WebSocketServerConfig) {
    this.config = config;
    this.miniServer = new MiniServerCore({
      ...config,
      heartbeatInterval: 10000, // 10 seconds
      clientTimeout: 30000 // 30 seconds
    });
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WSServer({ 
          port: this.config.port,
          verifyClient: (info) => this.verifyClient(info)
        });

        this.wss.on('connection', (ws, request) => {
          this.handleConnection(ws, request);
        });

        this.wss.on('listening', () => {
          console.log(`WebSocket server listening on port ${this.config.port}`);
          this.miniServer.start();
          resolve();
        });

        this.wss.on('error', (error) => {
          console.error('WebSocket server error:', error);
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.miniServer.stop();
      
      if (this.wss) {
        this.wss.close(() => {
          console.log('WebSocket server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private verifyClient(info: { origin: string; secure: boolean; req: IncomingMessage }): boolean {
    // Basic verification - in production, you might want more sophisticated checks
    const url = new URL(info.req.url || '', `http://${info.req.headers.host}`);
    const organizationId = url.searchParams.get('organizationId');
    
    if (!organizationId || organizationId !== this.config.organizationId) {
      console.log(`Rejected connection - invalid organization ID: ${organizationId}`);
      return false;
    }
    
    return true;
  }

  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    console.log('New WebSocket connection');
    
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const clientId = url.searchParams.get('clientId');
    const clientName = url.searchParams.get('clientName') || 'Unknown Client';
    const capabilities = url.searchParams.get('capabilities')?.split(',') || [];
    
    if (!clientId) {
      console.log('Rejected connection - missing client ID');
      ws.close(1008, 'Missing client ID');
      return;
    }
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'welcome',
      data: {
        serverId: this.config.deviceId,
        serverName: this.config.deviceName,
        organizationId: this.config.organizationId,
        timestamp: Date.now()
      }
    }));
    
    // Add client to mini server
    this.miniServer.addClient(clientId, clientName, ws, capabilities);
  }

  getMiniServer(): MiniServerCore {
    return this.miniServer;
  }

  isRunning(): boolean {
    return this.wss !== null && this.miniServer.isRunning();
  }
}
