
import { EventEmitter } from 'events';
import { WebSocket } from 'ws';

export interface ClientConnection {
  id: string;
  name: string;
  ws: WebSocket;
  lastSeen: number;
  capabilities: string[];
  organizationId: string;
}

export interface MiniServerConfig {
  port: number;
  organizationId: string;
  deviceId: string;
  deviceName: string;
  heartbeatInterval: number;
  clientTimeout: number;
}

export class MiniServerCore extends EventEmitter {
  private clients = new Map<string, ClientConnection>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private config: MiniServerConfig;
  private isActive = false;

  constructor(config: MiniServerConfig) {
    super();
    this.config = config;
  }

  start(): void {
    if (this.isActive) return;
    
    this.isActive = true;
    this.startHeartbeat();
    
    console.log(`MiniServer started for organization: ${this.config.organizationId}`);
    this.emit('server-started', { organizationId: this.config.organizationId });
  }

  stop(): void {
    if (!this.isActive) return;
    
    this.isActive = false;
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    // Disconnect all clients
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close();
      }
    });
    
    this.clients.clear();
    
    console.log('MiniServer stopped');
    this.emit('server-stopped');
  }

  addClient(clientId: string, clientName: string, ws: WebSocket, capabilities: string[]): void {
    const client: ClientConnection = {
      id: clientId,
      name: clientName,
      ws,
      lastSeen: Date.now(),
      capabilities,
      organizationId: this.config.organizationId
    };
    
    this.clients.set(clientId, client);
    
    // Set up WebSocket handlers
    ws.on('message', (data) => {
      this.handleClientMessage(clientId, data);
    });
    
    ws.on('close', () => {
      this.removeClient(clientId);
    });
    
    ws.on('error', (error) => {
      console.error(`Client ${clientId} WebSocket error:`, error);
      this.removeClient(clientId);
    });
    
    console.log(`Client connected: ${clientId} (${clientName})`);
    this.emit('client-connected', { clientId, clientName, capabilities });
    
    // Broadcast updated client list
    this.broadcastClientList();
  }

  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
      console.log(`Client disconnected: ${clientId}`);
      this.emit('client-disconnected', { clientId });
      
      // Broadcast updated client list
      this.broadcastClientList();
    }
  }

  private handleClientMessage(clientId: string, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());
      const client = this.clients.get(clientId);
      
      if (!client) return;
      
      // Update last seen
      client.lastSeen = Date.now();
      
      switch (message.type) {
        case 'heartbeat':
          this.handleHeartbeat(clientId);
          break;
          
        case 'location-update':
          this.handleLocationUpdate(clientId, message.data);
          break;
          
        case 'peer-message':
          this.handlePeerMessage(clientId, message.data);
          break;
          
        case 'request-client-list':
          this.sendClientList(clientId);
          break;
          
        default:
          console.warn(`Unknown message type from ${clientId}:`, message.type);
      }
    } catch (error) {
      console.error(`Error handling message from ${clientId}:`, error);
    }
  }

  private handleHeartbeat(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({
        type: 'heartbeat-ack',
        timestamp: Date.now()
      }));
    }
  }

  private handleLocationUpdate(clientId: string, locationData: any): void {
    console.log(`Location update from ${clientId}:`, locationData);
    
    // Broadcast location to other connected clients (admins)
    this.broadcast({
      type: 'location-update',
      data: {
        clientId,
        location: locationData,
        timestamp: Date.now()
      }
    }, [clientId]); // Exclude the sender
    
    this.emit('location-update', { clientId, location: locationData });
  }

  private handlePeerMessage(clientId: string, messageData: any): void {
    const { targetId, message } = messageData;
    
    if (targetId === 'broadcast') {
      // Broadcast to all clients except sender
      this.broadcast({
        type: 'peer-message',
        data: {
          fromId: clientId,
          message
        }
      }, [clientId]);
    } else {
      // Send to specific client
      const targetClient = this.clients.get(targetId);
      if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
        targetClient.ws.send(JSON.stringify({
          type: 'peer-message',
          data: {
            fromId: clientId,
            message
          }
        }));
      }
    }
  }

  private sendClientList(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;
    
    const clientList = Array.from(this.clients.values()).map(c => ({
      id: c.id,
      name: c.name,
      capabilities: c.capabilities,
      lastSeen: c.lastSeen
    }));
    
    client.ws.send(JSON.stringify({
      type: 'client-list',
      data: { clients: clientList }
    }));
  }

  private broadcastClientList(): void {
    const clientList = Array.from(this.clients.values()).map(c => ({
      id: c.id,
      name: c.name,
      capabilities: c.capabilities,
      lastSeen: c.lastSeen
    }));
    
    this.broadcast({
      type: 'client-list-update',
      data: { clients: clientList }
    });
  }

  private broadcast(message: any, exclude: string[] = []): void {
    const messageStr = JSON.stringify(message);
    
    this.clients.forEach((client, clientId) => {
      if (!exclude.includes(clientId) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const staleClients: string[] = [];
      
      // Check for stale clients
      this.clients.forEach((client, clientId) => {
        if (now - client.lastSeen > this.config.clientTimeout) {
          staleClients.push(clientId);
        }
      });
      
      // Remove stale clients
      staleClients.forEach(clientId => {
        this.removeClient(clientId);
      });
      
      // Send heartbeat to remaining clients
      this.broadcast({
        type: 'server-heartbeat',
        timestamp: now,
        clientCount: this.clients.size
      });
      
    }, this.config.heartbeatInterval);
  }

  getConnectedClients(): ClientConnection[] {
    return Array.from(this.clients.values());
  }

  getClientCount(): number {
    return this.clients.size;
  }

  isRunning(): boolean {
    return this.isActive;
  }

  getConfig(): MiniServerConfig {
    return { ...this.config };
  }
}
