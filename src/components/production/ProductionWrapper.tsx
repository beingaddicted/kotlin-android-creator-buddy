
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { ProductionErrorBoundary } from './ProductionErrorBoundary';
import { analytics } from '@/services/production/AnalyticsService';
import { healthMonitor } from '@/services/production/HealthMonitor';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Wifi, WifiOff, Activity } from 'lucide-react';
import { toast } from 'sonner';

interface ProductionWrapperProps {
  children: React.ReactNode;
}

export const ProductionWrapper = React.memo<ProductionWrapperProps>(({ children }) => {
  const { user } = useSupabaseAuth();
  const { isOnline, wasOffline } = useNetworkStatus();
  const { isMonitoring, startMonitor, measureOperation } = usePerformanceMonitor();
  const [healthStatus, setHealthStatus] = useState<'healthy' | 'warning' | 'critical'>('healthy');
  const [showHealthWarning, setShowHealthWarning] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Refs to track mounted state and prevent memory leaks
  const isMountedRef = useRef(true);
  const timeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const intervalsRef = useRef<Set<NodeJS.Timeout>>(new Set());

  // Safe timeout/interval functions that check if component is still mounted
  const safeSetTimeout = useCallback((callback: () => void, delay: number) => {
    const timeout = setTimeout(() => {
      if (isMountedRef.current) {
        callback();
      }
      timeoutsRef.current.delete(timeout);
    }, delay);
    timeoutsRef.current.add(timeout);
    return timeout;
  }, []);

  const safeSetInterval = useCallback((callback: () => void, delay: number) => {
    const interval = setInterval(() => {
      if (isMountedRef.current) {
        callback();
      }
    }, delay);
    intervalsRef.current.add(interval);
    return interval;
  }, []);

  // Enhanced debouncing with error handling
  const showToast = useCallback(
    debounce((message: string, type: 'success' | 'error' | 'warning') => {
      if (!isMountedRef.current) return;
      
      try {
        if (type === 'success') toast.success(message);
        else if (type === 'error') toast.error(message);
        else toast.warning(message);
      } catch (error) {
        console.error('Toast error:', error);
      }
    }, 5000),
    []
  );

  // Enhanced health status handler with validation
  const handleHealthChange = useCallback((status: any) => {
    if (!isMountedRef.current || !status || typeof status !== 'object') return;

    try {
      const validStatuses = ['healthy', 'warning', 'critical'];
      const newStatus = validStatuses.includes(status.overall) ? status.overall : 'healthy';
      
      setHealthStatus(newStatus);
      
      if (newStatus === 'critical' && !showHealthWarning) {
        setShowHealthWarning(true);
        showToast('Application health critical - performance may be affected', 'error');
      }
    } catch (error) {
      console.error('Health change handler error:', error);
    }
  }, [showHealthWarning, showToast]);

  // Enhanced user action handler with error boundaries
  const handleUserAction = useCallback(
    throttle((action: string, context: any = {}) => {
      if (!isMountedRef.current) return;
      
      try {
        measureOperation(`user_action_${action}`, () => {
          if (analytics && typeof analytics.trackUserAction === 'function') {
            analytics.trackUserAction(action, context);
          }
          if (healthMonitor && typeof healthMonitor.recordOperation === 'function') {
            healthMonitor.recordOperation(true);
          }
        });
      } catch (error) {
        console.error('User action tracking error:', error);
        if (healthMonitor && typeof healthMonitor.recordOperation === 'function') {
          healthMonitor.recordOperation(false);
        }
      }
    }, 3000),
    [measureOperation]
  );

  // Main initialization effect with comprehensive error handling
  useEffect(() => {
    if (isInitialized) return;

    const initializeApp = async () => {
      try {
        // Initialize analytics with error handling
        if (analytics && typeof analytics.initialize === 'function') {
          await analytics.initialize(user?.id);
        }

        // Start health monitoring with error handling
        if (healthMonitor) {
          if (typeof healthMonitor.startMonitoring === 'function') {
            healthMonitor.startMonitoring();
          }
          if (typeof healthMonitor.onHealthChange === 'function') {
            healthMonitor.onHealthChange(handleHealthChange);
          }
        }

        // Start performance monitoring with error handling
        if (!isMonitoring && startMonitor) {
          try {
            startMonitor();
          } catch (error) {
            console.error('Failed to start performance monitoring:', error);
          }
        }

        // Track app initialization with error handling
        if (analytics && typeof analytics.trackEvent === 'function') {
          analytics.trackEvent('app_initialized', {
            userId: user?.id,
            isOnline,
            timestamp: Date.now()
          });
        }

        setIsInitialized(true);
      } catch (error) {
        console.error('App initialization error:', error);
        // Still mark as initialized to prevent retry loops
        setIsInitialized(true);
      }
    };

    initializeApp();
  }, [user?.id, isOnline, isMonitoring, startMonitor, handleHealthChange, isInitialized]);

  // Error handlers with enhanced validation
  useEffect(() => {
    if (!isInitialized) return;

    const handleError = throttle((event: ErrorEvent) => {
      if (!isMountedRef.current) return;
      
      try {
        if (analytics && typeof analytics.trackEvent === 'function') {
          analytics.trackEvent('javascript_error', {
            message: event.message || 'Unknown error',
            filename: event.filename || 'Unknown file',
            timestamp: Date.now()
          });
        }
        if (healthMonitor && typeof healthMonitor.recordOperation === 'function') {
          healthMonitor.recordOperation(false);
        }
      } catch (error) {
        console.error('Error handler failed:', error);
      }
    }, 10000);

    const handleUnhandledRejection = throttle((event: PromiseRejectionEvent) => {
      if (!isMountedRef.current) return;
      
      try {
        if (analytics && typeof analytics.trackEvent === 'function') {
          analytics.trackEvent('unhandled_promise_rejection', {
            reason: event.reason?.toString() || 'Unknown rejection',
            timestamp: Date.now()
          });
        }
        if (healthMonitor && typeof healthMonitor.recordOperation === 'function') {
          healthMonitor.recordOperation(false);
        }
      } catch (error) {
        console.error('Unhandled rejection handler failed:', error);
      }
    }, 10000);

    // WebRTC event handlers with validation
    const webrtcConnectionHandler = throttle((event: CustomEvent) => {
      if (!isMountedRef.current || !event.detail) return;
      
      try {
        const { success, peerId, duration } = event.detail;
        if (analytics && typeof analytics.trackConnectionAttempt === 'function') {
          analytics.trackConnectionAttempt(peerId, success, duration);
        }
        if (healthMonitor && typeof healthMonitor.recordConnectionAttempt === 'function') {
          healthMonitor.recordConnectionAttempt(success);
        }
      } catch (error) {
        console.error('WebRTC connection handler error:', error);
      }
    }, 5000);
    
    const webrtcSignalingHandler = throttle((event: CustomEvent) => {
      if (!isMountedRef.current || !event.detail) return;
      
      try {
        const { type, peerId } = event.detail;
        if (analytics && typeof analytics.trackSignalingEvent === 'function') {
          analytics.trackSignalingEvent(type, peerId);
        }
      } catch (error) {
        console.error('WebRTC signaling handler error:', error);
      }
    }, 3000);
    
    const webrtcLocationHandler = throttle(() => {
      if (!isMountedRef.current) return;
      
      try {
        if (analytics && typeof analytics.trackLocationShare === 'function') {
          analytics.trackLocationShare(true);
        }
      } catch (error) {
        console.error('WebRTC location handler error:', error);
      }
    }, 10000);
    
    const webrtcPerformanceHandler = throttle((event: CustomEvent) => {
      if (!isMountedRef.current || !event.detail) return;
      
      try {
        if (analytics && typeof analytics.trackEvent === 'function') {
          analytics.trackEvent('performance_warning', event.detail);
        }
      } catch (error) {
        console.error('WebRTC performance handler error:', error);
      }
    }, 30000);

    // Add event listeners
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('webrtc-connection-attempt', webrtcConnectionHandler);
    window.addEventListener('webrtc-signaling', webrtcSignalingHandler);
    window.addEventListener('webrtc-location-update', webrtcLocationHandler);
    window.addEventListener('webrtc-performance-warning', webrtcPerformanceHandler);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('webrtc-connection-attempt', webrtcConnectionHandler);
      window.removeEventListener('webrtc-signaling', webrtcSignalingHandler);
      window.removeEventListener('webrtc-location-update', webrtcLocationHandler);
      window.removeEventListener('webrtc-performance-warning', webrtcPerformanceHandler);
    };
  }, [isInitialized]);

  // Network status effect with enhanced error handling
  useEffect(() => {
    if (!isInitialized) return;

    try {
      if (wasOffline && isOnline) {
        const offlineTime = localStorage.getItem('offline_timestamp');
        const offlineDuration = offlineTime ? Date.now() - parseInt(offlineTime) : 0;
        
        if (analytics && typeof analytics.trackEvent === 'function') {
          analytics.trackEvent('network_reconnected', { offlineDuration });
        }
        showToast('Network connection restored', 'success');
        localStorage.removeItem('offline_timestamp');
      } else if (!isOnline) {
        localStorage.setItem('offline_timestamp', Date.now().toString());
        if (analytics && typeof analytics.trackEvent === 'function') {
          analytics.trackEvent('network_disconnected', {});
        }
      }
    } catch (error) {
      console.error('Network status effect error:', error);
    }
  }, [isOnline, wasOffline, showToast, isInitialized]);

  // Click handler with enhanced validation
  useEffect(() => {
    if (!isInitialized) return;

    const handleClick = throttle((event: MouseEvent) => {
      if (!isMountedRef.current || !event.target) return;
      
      try {
        const target = event.target as HTMLElement;
        if (target.tagName === 'BUTTON' || target.closest('button')) {
          const buttonText = target.textContent || target.closest('button')?.textContent || 'unknown';
          handleUserAction('button_click', { buttonText });
        }
      } catch (error) {
        console.error('Click handler error:', error);
      }
    }, 2000);

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [handleUserAction, isInitialized]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      
      // Clear all timeouts and intervals
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      intervalsRef.current.forEach(interval => clearInterval(interval));
      
      // Stop monitoring services
      try {
        if (healthMonitor && typeof healthMonitor.stopMonitoring === 'function') {
          healthMonitor.stopMonitoring();
        }
        if (analytics && typeof analytics.endSession === 'function') {
          analytics.endSession();
        }
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    };
  }, []);

  // Memoized status indicators with error boundaries
  const statusIndicators = useMemo(() => {
    try {
      return (
        <div className="fixed bottom-4 right-4 space-y-2 z-30">
          <div className={`p-2 rounded-full shadow-lg transition-colors duration-300 ${
            isOnline ? 'bg-green-500' : 'bg-red-500'
          }`}>
            {isOnline ? 
              <Wifi className="w-4 h-4 text-white" /> : 
              <WifiOff className="w-4 h-4 text-white" />
            }
          </div>

          {healthStatus !== 'healthy' && (
            <div className={`p-2 rounded-full shadow-lg transition-colors duration-300 ${
              healthStatus === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
            }`}>
              <Activity className="w-4 h-4 text-white" />
            </div>
          )}
        </div>
      );
    } catch (error) {
      console.error('Status indicators render error:', error);
      return null;
    }
  }, [isOnline, healthStatus]);

  // Loading state while initializing
  if (!isInitialized) {
    return (
      <ProductionErrorBoundary>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </ProductionErrorBoundary>
    );
  }

  return (
    <ProductionErrorBoundary>
      <div className="min-h-screen bg-background">
        {/* Network Status Indicator */}
        {!isOnline && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white p-2 text-center text-sm animate-fade-in">
            <WifiOff className="inline w-4 h-4 mr-2" />
            No internet connection - some features may be limited
          </div>
        )}

        {/* Health warning for critical issues only */}
        {showHealthWarning && healthStatus === 'critical' && (
          <div className="fixed top-0 left-0 right-0 z-40 bg-red-600 text-white p-2 text-center text-sm animate-fade-in">
            <AlertTriangle className="inline w-4 h-4 mr-2" />
            Critical performance issues detected - consider refreshing the page
            <button 
              onClick={() => setShowHealthWarning(false)}
              className="ml-4 underline hover:no-underline focus:outline-none"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Production Status Indicators */}
        {statusIndicators}

        {/* Main Application */}
        {children}
      </div>
    </ProductionErrorBoundary>
  );
});

// Enhanced utility functions with validation
function throttle<T extends (...args: any[]) => any>(func: T, delay: number): T {
  if (typeof func !== 'function') {
    throw new Error('throttle: first argument must be a function');
  }
  if (typeof delay !== 'number' || delay < 0) {
    throw new Error('throttle: delay must be a positive number');
  }
  
  let inThrottle: boolean;
  return ((...args: any[]) => {
    if (!inThrottle) {
      try {
        func.apply(this, args);
      } catch (error) {
        console.error('Throttled function error:', error);
      }
      inThrottle = true;
      setTimeout(() => inThrottle = false, delay);
    }
  }) as T;
}

function debounce<T extends (...args: any[]) => any>(func: T, delay: number): T {
  if (typeof func !== 'function') {
    throw new Error('debounce: first argument must be a function');
  }
  if (typeof delay !== 'number' || delay < 0) {
    throw new Error('debounce: delay must be a positive number');
  }
  
  let debounceTimer: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      try {
        func.apply(this, args);
      } catch (error) {
        console.error('Debounced function error:', error);
      }
    }, delay);
  }) as T;
}

ProductionWrapper.displayName = 'ProductionWrapper';
