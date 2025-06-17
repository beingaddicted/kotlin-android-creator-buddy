// src/services/SignalingService.ts
// Simple WebSocket signaling client for WebRTC

export class SignalingService {
  private ws: WebSocket | null = null;
  private listeners: ((msg: any) => void)[] = [];

  connect(url: string) {
    this.ws = new WebSocket(url);
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.listeners.forEach((cb) => cb(data));
    };
  }

  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  onMessage(cb: (msg: any) => void) {
    this.listeners.push(cb);
  }
}

export const signalingService = new SignalingService();
