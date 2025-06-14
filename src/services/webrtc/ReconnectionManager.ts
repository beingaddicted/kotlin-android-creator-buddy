
import { WebRTCServerOffer } from './types';

export interface ReconnectionAttempt {
  peerId: string;
  attempt: number;
  startTime: number;
  reason: 'ip-change' | 'connection-lost' | 'ice-failed';
}

export class ReconnectionManager {
  private reconnectionAttempts = new Map<string, ReconnectionAttempt>();
  private maxAttempts = 5;
  private isAdmin = false;
  private reconnectionTimeouts = new Map<string, NodeJS.Timeout>();
  private onReconnectionStateChanged?: (peerId: string, state: 'attempting' | 'success' | 'failed') => void;

  setAsAdmin(isAdmin: boolean) {
    this.isAdmin = isAdmin;
  }

  shouldInitiateReconnection(peerId: string, reason: 'ip-change' | 'connection-lost' | 'ice-failed'): boolean {
    const attempt = this.reconnectionAttempts.get(peerId);
    
    // If already at max attempts, don't try again
    if (attempt && attempt.attempt >= this.maxAttempts) {
      return false;
    }
    
    // Admin always has priority for IP changes
    if (reason === 'ip-change' && this.isAdmin) {
      return true;
    }
    
    // For connection loss, both can try but with different strategies
    if (reason === 'connection-lost') {
      return true;
    }
    
    // For ICE failures, always try to reconnect
    if (reason === 'ice-failed') {
      return true;
    }
    
    return false;
  }

  startReconnectionAttempt(peerId: string, reason: 'ip-change' | 'connection-lost' | 'ice-failed'): number {
    const existingAttempt = this.reconnectionAttempts.get(peerId);
    const attemptNumber = existingAttempt ? existingAttempt.attempt + 1 : 1;
    
    const attempt: ReconnectionAttempt = {
      peerId,
      attempt: attemptNumber,
      startTime: Date.now(),
      reason
    };
    
    this.reconnectionAttempts.set(peerId, attempt);
    
    console.log(`ReconnectionManager: Starting attempt ${attemptNumber}/${this.maxAttempts} for ${peerId} (${reason})`);
    
    if (this.onReconnectionStateChanged) {
      this.onReconnectionStateChanged(peerId, 'attempting');
    }
    
    // Clear any existing timeout
    const existingTimeout = this.reconnectionTimeouts.get(peerId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Set timeout for this attempt
    const timeout = setTimeout(() => {
      this.handleReconnectionTimeout(peerId);
    }, this.getTimeoutForAttempt(attemptNumber));
    
    this.reconnectionTimeouts.set(peerId, timeout);
    
    return attemptNumber;
  }

  markReconnectionSuccess(peerId: string) {
    console.log(`ReconnectionManager: Reconnection successful for ${peerId}`);
    
    this.reconnectionAttempts.delete(peerId);
    
    const timeout = this.reconnectionTimeouts.get(peerId);
    if (timeout) {
      clearTimeout(timeout);
      this.reconnectionTimeouts.delete(peerId);
    }
    
    if (this.onReconnectionStateChanged) {
      this.onReconnectionStateChanged(peerId, 'success');
    }
  }

  markReconnectionFailed(peerId: string) {
    const attempt = this.reconnectionAttempts.get(peerId);
    
    if (attempt && attempt.attempt >= this.maxAttempts) {
      console.log(`ReconnectionManager: Reconnection permanently failed for ${peerId}`);
      
      this.reconnectionAttempts.delete(peerId);
      
      const timeout = this.reconnectionTimeouts.get(peerId);
      if (timeout) {
        clearTimeout(timeout);
        this.reconnectionTimeouts.delete(peerId);
      }
      
      if (this.onReconnectionStateChanged) {
        this.onReconnectionStateChanged(peerId, 'failed');
      }
    }
  }

  private handleReconnectionTimeout(peerId: string) {
    console.log(`ReconnectionManager: Reconnection timeout for ${peerId}`);
    this.reconnectionTimeouts.delete(peerId);
    // The timeout doesn't automatically fail the reconnection, just logs it
  }

  private getTimeoutForAttempt(attemptNumber: number): number {
    // Exponential backoff: 5s, 10s, 20s, 40s, 60s
    return Math.min(5000 * Math.pow(2, attemptNumber - 1), 60000);
  }

  getDelayForAttempt(attemptNumber: number): number {
    // Exponential backoff for retry delays: 1s, 2s, 4s, 8s, 15s
    return Math.min(1000 * Math.pow(2, attemptNumber - 1), 15000);
  }

  getReconnectionState(peerId: string): { isReconnecting: boolean; attempt: number; maxAttempts: number } {
    const attempt = this.reconnectionAttempts.get(peerId);
    
    return {
      isReconnecting: !!attempt,
      attempt: attempt?.attempt || 0,
      maxAttempts: this.maxAttempts
    };
  }

  getAllReconnectionStates(): Map<string, ReconnectionAttempt> {
    return new Map(this.reconnectionAttempts);
  }

  onReconnectionStateChange(callback: (peerId: string, state: 'attempting' | 'success' | 'failed') => void) {
    this.onReconnectionStateChanged = callback;
  }

  clearReconnectionAttempt(peerId: string) {
    this.reconnectionAttempts.delete(peerId);
    
    const timeout = this.reconnectionTimeouts.get(peerId);
    if (timeout) {
      clearTimeout(timeout);
      this.reconnectionTimeouts.delete(peerId);
    }
  }

  clearAllReconnections() {
    this.reconnectionAttempts.clear();
    
    this.reconnectionTimeouts.forEach(timeout => clearTimeout(timeout));
    this.reconnectionTimeouts.clear();
  }
}
