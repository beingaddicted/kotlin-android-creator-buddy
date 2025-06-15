
export interface ErrorContext {
  code: string;
  message: string;
  timestamp: number;
  context: {
    connectionState: string;
    iceConnectionState: string;
    iceGatheringState: string;
    signalingState: string;
    networkType?: string;
    userAgent: string;
  };
  recovery?: {
    attempted: string[];
    successful?: string;
    failed?: string[];
  };
}

export class ErrorContextManager {
  private errorHistory: ErrorContext[] = [];
  private maxHistorySize = 50;
  private onErrorCallbacks: ((error: ErrorContext) => void)[] = [];

  logError(
    code: string, 
    message: string, 
    connection?: RTCPeerConnection,
    additionalContext?: Record<string, any>
  ): ErrorContext {
    const context: ErrorContext = {
      code,
      message,
      timestamp: Date.now(),
      context: {
        connectionState: connection?.connectionState || 'unknown',
        iceConnectionState: connection?.iceConnectionState || 'unknown',
        iceGatheringState: connection?.iceGatheringState || 'unknown',
        signalingState: connection?.signalingState || 'unknown',
        networkType: this.getNetworkType(),
        userAgent: navigator.userAgent,
        ...additionalContext
      }
    };

    this.errorHistory.push(context);
    
    // Maintain history size
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }

    // Notify callbacks
    this.onErrorCallbacks.forEach(callback => {
      try {
        callback(context);
      } catch (err) {
        console.error('Error callback failed:', err);
      }
    });

    console.error('WebRTC Error Context:', context);
    return context;
  }

  updateRecoveryAttempt(errorCode: string, attemptedMethod: string, success: boolean): void {
    const recentError = this.errorHistory
      .slice()
      .reverse()
      .find(err => err.code === errorCode && Date.now() - err.timestamp < 60000);

    if (recentError) {
      if (!recentError.recovery) {
        recentError.recovery = { attempted: [] };
      }

      recentError.recovery.attempted.push(attemptedMethod);
      
      if (success) {
        recentError.recovery.successful = attemptedMethod;
      } else {
        if (!recentError.recovery.failed) {
          recentError.recovery.failed = [];
        }
        recentError.recovery.failed.push(attemptedMethod);
      }
    }
  }

  getErrorHistory(): ErrorContext[] {
    return [...this.errorHistory];
  }

  getRecurringErrors(): { code: string; count: number; lastOccurrence: number }[] {
    const errorCounts = new Map<string, { count: number; lastOccurrence: number }>();
    
    this.errorHistory.forEach(error => {
      const existing = errorCounts.get(error.code);
      if (existing) {
        existing.count++;
        existing.lastOccurrence = Math.max(existing.lastOccurrence, error.timestamp);
      } else {
        errorCounts.set(error.code, { count: 1, lastOccurrence: error.timestamp });
      }
    });

    return Array.from(errorCounts.entries())
      .map(([code, data]) => ({ code, ...data }))
      .filter(error => error.count > 1)
      .sort((a, b) => b.lastOccurrence - a.lastOccurrence);
  }

  onError(callback: (error: ErrorContext) => void): void {
    this.onErrorCallbacks.push(callback);
  }

  private getNetworkType(): string {
    // @ts-ignore - navigator.connection is experimental
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return connection?.effectiveType || 'unknown';
  }

  clearHistory(): void {
    this.errorHistory = [];
  }
}
