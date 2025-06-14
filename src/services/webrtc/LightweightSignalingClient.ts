
export interface SignalingServerMessage {
  type: 'register' | 'offer' | 'answer' | 'ice-candidate' | 'presence' | 'reconnection-request';
  data: any;
  fromId: string;
  toId?: string;
  organizationId: string;
  timestamp: number;
}

export interface DeviceRegistration {
  deviceId: string;
  deviceType: 'admin' | 'client';
  organizationId: string;
  isOnline: boolean;
  lastSeen: number;
}

export class LightweightSignalingClient {
  private ws: WebSocket | null = null;
  private deviceId: string;
  private deviceType: 'admin' | 'client';
  private organizationId: string;
  private isConnected = false;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private messageHandlers = new Map<string, (message: SignalingServerMessage) => void>();

  // Use a public signaling server or localhost for development
  private readonly SIGNALING_SERVER_URL = 'wss://your-signaling-server.com/ws'; // Replace with actual server

  constructor(deviceId: string, deviceType: 'admin' | 'client', organizationId: string) {
    this.deviceId = deviceId;
    this.deviceType = deviceType;
    this.organizationId = organizationId;
  }

  async connect(): Promise<boolean> {
    try {
      console.log('LightweightSignaling: Connecting to signaling server...');
      
      this.ws = new WebSocket(this.SIGNALING_SERVER_URL);
      
      return new Promise((resolve, reject) => {
        if (!this.ws) {
          reject(new Error('WebSocket not initialized'));
          return;
        }

        this.ws.onopen = () => {
          console.log('LightweightSignaling: Connected to signaling server');
          this.isConnected = true;
          this.register();
          this.startHeartbeat();
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const message: SignalingServerMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('LightweightSignaling: Failed to parse message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('LightweightSignaling: Connection closed');
          this.isConnected = false;
          this.scheduleReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('LightweightSignaling: WebSocket error:', error);
          reject(error);
        };

        // Timeout after 10 seconds
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('Connection timeout'));
          }
        }, 10000);
      });
    } catch (error) {
      console.error('LightweightSignaling: Connection failed:', error);
      return false;
    }
  }

  private register(): void {
    const message: SignalingServerMessage = {
      type: 'register',
      data: {
        deviceType: this.deviceType,
        organizationId: this.organizationId
      },
      fromId: this.deviceId,
      organizationId: this.organizationId,
      timestamp: Date.now()
    };

    this.sendMessage(message);
  }

  private startHeartbeat(): void {
    // Send presence every 30 seconds
    setInterval(() => {
      if (this.isConnected) {
        const message: SignalingServerMessage = {
          type: 'presence',
          data: { status: 'online' },
          fromId: this.deviceId,
          organizationId: this.organizationId,
          timestamp: Date.now()
        };
        this.sendMessage(message);
      }
    }, 30000);
  }

  private scheduleReconnect(): void {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
    }

    // Attempt reconnect every 5 seconds
    this.reconnectInterval = setTimeout(() => {
      console.log('LightweightSignaling: Attempting to reconnect...');
      this.connect().catch(() => {
        // Reconnection failed, will try again
      });
    }, 5000);
  }

  sendOffer(targetDeviceId: string, offer: any): void {
    const message: SignalingServerMessage = {
      type: 'offer',
      data: offer,
      fromId: this.deviceId,
      toId: targetDeviceId,
      organizationId: this.organizationId,
      timestamp: Date.now()
    };

    this.sendMessage(message);
  }

  sendAnswer(targetDeviceId: string, answer: any): void {
    const message: SignalingServerMessage = {
      type: 'answer',
      data: answer,
      fromId: this.deviceId,
      toId: targetDeviceId,
      organizationId: this.organizationId,
      timestamp: Date.now()
    };

    this.sendMessage(message);
  }

  sendIceCandidate(targetDeviceId: string, candidate: RTCIceCandidate): void {
    const message: SignalingServerMessage = {
      type: 'ice-candidate',
      data: candidate,
      fromId: this.deviceId,
      toId: targetDeviceId,
      organizationId: this.organizationId,
      timestamp: Date.now()
    };

    this.sendMessage(message);
  }

  requestReconnection(targetDeviceIds: string[]): void {
    targetDeviceIds.forEach(targetId => {
      const message: SignalingServerMessage = {
        type: 'reconnection-request',
        data: { requestReconnection: true },
        fromId: this.deviceId,
        toId: targetId,
        organizationId: this.organizationId,
        timestamp: Date.now()
      };

      this.sendMessage(message);
    });
  }

  private sendMessage(message: SignalingServerMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      console.log('LightweightSignaling: Sent message:', message.type);
    } else {
      console.warn('LightweightSignaling: Cannot send message - not connected');
    }
  }

  private handleMessage(message: SignalingServerMessage): void {
    console.log('LightweightSignaling: Received message:', message.type, 'from:', message.fromId);

    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message);
    }
  }

  onMessage(type: string, handler: (message: SignalingServerMessage) => void): void {
    this.messageHandlers.set(type, handler);
  }

  disconnect(): void {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
  }

  isSignalingConnected(): boolean {
    return this.isConnected;
  }
}
