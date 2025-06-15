
interface ReconnectionAttempt {
  peerId: string;
  reason: string;
  attempts: number;
  maxAttempts: number;
  lastAttempt: number;
  isReconnecting: boolean;
  attempt: number;
}

export class ReconnectionManager {
  private reconnectionAttempts = new Map<string, ReconnectionAttempt>();
  private isAdmin = false;
  private onStateChangeCallback?: (peerId: string, state: string) => void;

  setAsAdmin(isAdmin: boolean) {
    this.isAdmin = isAdmin;
  }

  onReconnectionStateChange(callback: (peerId: string, state: string) => void) {
    this.onStateChangeCallback = callback;
  }

  shouldInitiateReconnection(peerId: string, reason: string): boolean {
    const attempt = this.reconnectionAttempts.get(peerId);
    
    if (!attempt) {
      return true;
    }
    
    return attempt.attempts < attempt.maxAttempts;
  }

  startReconnectionAttempt(peerId: string, reason: string): number {
    const existing = this.reconnectionAttempts.get(peerId);
    
    if (existing) {
      existing.attempts++;
      existing.attempt = existing.attempts;
      existing.lastAttempt = Date.now();
      existing.isReconnecting = true;
      this.reconnectionAttempts.set(peerId, existing);
      this.onStateChangeCallback?.(peerId, 'attempting');
      return existing.attempts;
    } else {
      const newAttempt: ReconnectionAttempt = {
        peerId,
        reason,
        attempts: 1,
        attempt: 1,
        maxAttempts: 5,
        lastAttempt: Date.now(),
        isReconnecting: true
      };
      this.reconnectionAttempts.set(peerId, newAttempt);
      this.onStateChangeCallback?.(peerId, 'attempting');
      return 1;
    }
  }

  markReconnectionSuccess(peerId: string): void {
    this.reconnectionAttempts.delete(peerId);
    this.onStateChangeCallback?.(peerId, 'success');
  }

  markReconnectionFailure(peerId: string): void {
    const attempt = this.reconnectionAttempts.get(peerId);
    if (attempt) {
      attempt.isReconnecting = false;
      if (attempt.attempts >= attempt.maxAttempts) {
        this.onStateChangeCallback?.(peerId, 'failed');
      }
    }
  }

  markReconnectionFailed(peerId: string): void {
    this.markReconnectionFailure(peerId);
  }

  getDelayForAttempt(attemptNumber: number): number {
    return Math.min(1000 * Math.pow(2, attemptNumber - 1), 30000);
  }

  clearReconnection(peerId: string): void {
    this.reconnectionAttempts.delete(peerId);
  }

  clearReconnectionAttempt(peerId: string): void {
    this.clearReconnection(peerId);
  }

  clearAllReconnections(): void {
    this.reconnectionAttempts.clear();
  }

  getReconnectionStatus(peerId: string): ReconnectionAttempt | null {
    return this.reconnectionAttempts.get(peerId) || null;
  }

  getReconnectionState(peerId: string): ReconnectionAttempt {
    return this.reconnectionAttempts.get(peerId) || {
      peerId,
      reason: 'none',
      attempts: 0,
      attempt: 0,
      maxAttempts: 5,
      lastAttempt: 0,
      isReconnecting: false
    };
  }

  getAllReconnectionStatuses(): Map<string, ReconnectionAttempt> {
    return new Map(this.reconnectionAttempts);
  }

  getAllReconnectionStates(): Map<string, ReconnectionAttempt> {
    return new Map(this.reconnectionAttempts);
  }
}
