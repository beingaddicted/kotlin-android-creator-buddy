
import { EventEmitter } from 'events';
import { HeartbeatEvent } from './types';

export class HeartbeatManager extends EventEmitter {
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private deviceId: string,
    private onStaleCheck: () => void
  ) {
    super();
  }

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.heartbeatInterval = setInterval(() => {
      try {
        // Broadcast heartbeat
        const event: HeartbeatEvent = {
          deviceId: this.deviceId,
          timestamp: Date.now()
        };
        
        this.emit('heartbeat-broadcast', event);
        
        // Check for stale candidates
        this.onStaleCheck();
      } catch (error) {
        console.error('HeartbeatManager: Heartbeat error:', error);
      }
    }, 10000); // Every 10 seconds
  }

  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }
}
