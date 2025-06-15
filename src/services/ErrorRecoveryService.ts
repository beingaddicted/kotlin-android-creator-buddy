interface ErrorContext {
  component: string;
  operation: string;
  timestamp: number;
  userAgent: string;
  url: string;
}

interface RecoveryStrategy {
  name: string;
  condition: (error: Error, context: ErrorContext) => boolean;
  execute: (error: Error, context: ErrorContext) => Promise<boolean>;
  maxRetries: number;
}

// Extend Window interface to include webRTCService
declare global {
  interface Window {
    webRTCService?: {
      disconnect?: () => void;
      getConnectionStatus?: () => string;
      onLocationUpdate?: (callback: (userId: string, locationData: any) => void) => void;
      onPeerStatusUpdate?: (callback: (peers: any[]) => void) => void;
      requestLocationFromAllClients?: () => void;
      getConnectedPeers?: () => any[];
      forceReconnect?: () => Promise<void>;
      canAutoReconnect?: () => boolean;
      getStoredClientCount?: () => number;
      isCurrentlyReconnecting?: () => boolean;
      getReconnectAttempts?: () => number;
      getDetailedReconnectionStatus?: () => Map<string, any>;
    };
    errorRecoveryService?: ErrorRecoveryService;
  }
}

export class ErrorRecoveryService {
  private static instance: ErrorRecoveryService;
  private recoveryStrategies: RecoveryStrategy[] = [];
  private errorHistory: Map<string, number> = new Map();
  private isRecovering = false;

  private constructor() {
    this.initializeRecoveryStrategies();
    this.setupGlobalErrorHandlers();
  }

  static getInstance(): ErrorRecoveryService {
    if (!ErrorRecoveryService.instance) {
      ErrorRecoveryService.instance = new ErrorRecoveryService();
    }
    return ErrorRecoveryService.instance;
  }

  private initializeRecoveryStrategies(): void {
    // WebRTC connection recovery
    this.recoveryStrategies.push({
      name: 'webrtc_reconnection',
      condition: (error, context) => 
        error.message.includes('WebRTC') || 
        error.message.includes('connection') ||
        context.operation.includes('webrtc'),
      execute: async (error, context) => {
        try {
          console.log('Attempting WebRTC recovery...');
          
          // Clear existing connections with proper type checking
          if (window.webRTCService?.disconnect) {
            window.webRTCService.disconnect();
          }
          
          // Wait before retry
          await this.delay(2000);
          
          // Attempt to restore from localStorage
          const lastConnection = localStorage.getItem('last_webrtc_connection');
          if (lastConnection) {
            try {
              const connectionData = JSON.parse(lastConnection);
              // Trigger reconnection event
              window.dispatchEvent(new CustomEvent('webrtc-recovery-attempt', {
                detail: connectionData
              }));
            } catch (parseError) {
              console.warn('Failed to parse stored connection data:', parseError);
              localStorage.removeItem('last_webrtc_connection');
            }
          }
          
          return true;
        } catch (recoveryError) {
          console.error('WebRTC recovery failed:', recoveryError);
          return false;
        }
      },
      maxRetries: 3
    });

    // Local storage corruption recovery
    this.recoveryStrategies.push({
      name: 'storage_recovery',
      condition: (error) => 
        error.message.includes('localStorage') ||
        error.message.includes('QuotaExceededError') ||
        error.message.includes('storage'),
      execute: async (error, context) => {
        try {
          console.log('Attempting storage recovery...');
          
          // Clear corrupted data
          const criticalKeys = ['userRegistration', 'performance_metrics', 'pending_operations'];
          criticalKeys.forEach(key => {
            try {
              const data = localStorage.getItem(key);
              if (data) JSON.parse(data); // Test if valid JSON
            } catch {
              localStorage.removeItem(key);
              console.log(`Removed corrupted storage key: ${key}`);
            }
          });
          
          // Clear old data if quota exceeded
          if (error.message.includes('QuotaExceededError')) {
            this.clearOldStorageData();
          }
          
          return true;
        } catch (recoveryError) {
          console.error('Storage recovery failed:', recoveryError);
          return false;
        }
      },
      maxRetries: 1
    });

    // Network request recovery
    this.recoveryStrategies.push({
      name: 'network_recovery',
      condition: (error) => 
        error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('offline'),
      execute: async (error, context) => {
        try {
          console.log('Attempting network recovery...');
          
          // Check network status
          if (!navigator.onLine) {
            console.log('Device is offline, waiting for connection...');
            await this.waitForNetworkConnection();
          }
          
          // Test connectivity
          const testResponse = await fetch('/health', { 
            method: 'HEAD',
            cache: 'no-cache'
          });
          
          if (!testResponse.ok) {
            throw new Error('Health check failed');
          }
          
          // Trigger network recovery event
          window.dispatchEvent(new CustomEvent('network-recovery-complete'));
          
          return true;
        } catch (recoveryError) {
          console.error('Network recovery failed:', recoveryError);
          return false;
        }
      },
      maxRetries: 5
    });

    // React component recovery
    this.recoveryStrategies.push({
      name: 'component_recovery',
      condition: (error, context) => 
        error.message.includes('React') ||
        error.message.includes('component') ||
        context.component !== 'unknown',
      execute: async (error, context) => {
        try {
          console.log(`Attempting component recovery for: ${context.component}`);
          
          // Clear component-specific cache
          if (context.component) {
            sessionStorage.removeItem(`${context.component}_state`);
            sessionStorage.removeItem(`${context.component}_cache`);
          }
          
          // Force component remount
          const event = new CustomEvent('force-component-remount', {
            detail: { component: context.component }
          });
          window.dispatchEvent(event);
          
          return true;
        } catch (recoveryError) {
          console.error('Component recovery failed:', recoveryError);
          return false;
        }
      },
      maxRetries: 2
    });
  }

  private setupGlobalErrorHandlers(): void {
    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(
        new Error(event.reason?.toString() || 'Unhandled promise rejection'),
        {
          component: 'global',
          operation: 'promise_rejection',
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          url: window.location.href
        }
      );
    });

    // JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError(
        new Error(event.message),
        {
          component: 'global',
          operation: 'javascript_error',
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          url: window.location.href
        }
      );
    });
  }

  async handleError(error: Error, context: ErrorContext): Promise<boolean> {
    if (this.isRecovering) {
      console.log('Recovery already in progress, queuing error...');
      return false;
    }

    const errorKey = `${context.component}_${context.operation}`;
    const errorCount = this.errorHistory.get(errorKey) || 0;

    // Prevent infinite recovery loops
    if (errorCount > 10) {
      console.error('Too many recovery attempts for:', errorKey);
      return false;
    }

    this.errorHistory.set(errorKey, errorCount + 1);

    // Find applicable recovery strategy
    const strategy = this.recoveryStrategies.find(s => s.condition(error, context));
    
    if (!strategy) {
      console.log('No recovery strategy found for error:', error.message);
      return false;
    }

    if (errorCount >= strategy.maxRetries) {
      console.error(`Max retries exceeded for strategy: ${strategy.name}`);
      return false;
    }

    try {
      this.isRecovering = true;
      console.log(`Executing recovery strategy: ${strategy.name}`);
      
      const success = await strategy.execute(error, context);
      
      if (success) {
        console.log(`Recovery successful: ${strategy.name}`);
        // Reset error count on successful recovery
        this.errorHistory.set(errorKey, 0);
      }
      
      return success;
    } catch (recoveryError) {
      console.error('Recovery strategy failed:', recoveryError);
      return false;
    } finally {
      this.isRecovering = false;
    }
  }

  // Manual recovery trigger
  async triggerRecovery(component: string, operation: string): Promise<boolean> {
    const context: ErrorContext = {
      component,
      operation,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    return this.handleError(new Error(`Manual recovery: ${operation}`), context);
  }

  // Utility methods
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async waitForNetworkConnection(timeout = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Network connection timeout'));
      }, timeout);

      const checkConnection = () => {
        if (navigator.onLine) {
          clearTimeout(timeoutId);
          resolve();
        } else {
          setTimeout(checkConnection, 1000);
        }
      };

      checkConnection();
    });
  }

  private clearOldStorageData(): void {
    try {
      const keys = Object.keys(localStorage);
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

      keys.forEach(key => {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            const parsed = JSON.parse(data);
            if (parsed.timestamp && now - parsed.timestamp > maxAge) {
              localStorage.removeItem(key);
              console.log(`Removed old storage key: ${key}`);
            }
          }
        } catch {
          // If we can't parse it, it might be corrupted
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Failed to clear old storage data:', error);
    }
  }

  // Get recovery statistics
  getRecoveryStats(): { strategy: string; attempts: number }[] {
    return Array.from(this.errorHistory.entries()).map(([key, attempts]) => ({
      strategy: key,
      attempts
    }));
  }

  // Reset recovery history
  resetRecoveryHistory(): void {
    this.errorHistory.clear();
  }
}

// Initialize service
export const errorRecoveryService = ErrorRecoveryService.getInstance();

// Make it globally available for emergency recovery
window.errorRecoveryService = errorRecoveryService;
