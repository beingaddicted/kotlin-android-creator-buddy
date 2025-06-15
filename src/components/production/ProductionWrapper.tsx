
import React, { useEffect, useState, useCallback, useMemo } from 'react';
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

  // Debounced toast notifications to prevent spam
  const showToast = useCallback(
    debounce((message: string, type: 'success' | 'error' | 'warning') => {
      if (type === 'success') toast.success(message);
      else if (type === 'error') toast.error(message);
      else toast.warning(message);
    }, 2000),
    []
  );

  // Memoize health status update handler
  const handleHealthChange = useCallback((status: any) => {
    setHealthStatus(status.overall);
    
    if (status.overall === 'critical' && !showHealthWarning) {
      setShowHealthWarning(true);
      showToast('Application health critical - performance may be affected', 'error');
    } else if (status.overall === 'warning' && !showHealthWarning) {
      showToast('Application performance warning detected', 'warning');
    }
  }, [showHealthWarning, showToast]);

  // Throttled user action handler
  const handleUserAction = useCallback(
    throttle((action: string, context: any = {}) => {
      measureOperation(`user_action_${action}`, () => {
        analytics.trackUserAction(action, context);
        healthMonitor.recordOperation(true);
      });
    }, 1000),
    [measureOperation]
  );

  useEffect(() => {
    // Initialize analytics with reduced frequency
    analytics.initialize(user?.id);

    // Start health monitoring with longer intervals
    healthMonitor.startMonitoring();
    healthMonitor.onHealthChange(handleHealthChange);

    // Start performance monitoring only if not already monitoring
    if (!isMonitoring) {
      startMonitor();
    }

    // Track app initialization with minimal data
    analytics.trackEvent('app_initialized', {
      userId: user?.id,
      isOnline,
      timestamp: Date.now()
    });

    // Throttled error handlers
    const handleError = throttle((event: ErrorEvent) => {
      analytics.trackEvent('javascript_error', {
        message: event.message,
        filename: event.filename,
        timestamp: Date.now()
      });
      healthMonitor.recordOperation(false);
    }, 5000);

    const handleUnhandledRejection = throttle((event: PromiseRejectionEvent) => {
      analytics.trackEvent('unhandled_promise_rejection', {
        reason: event.reason?.toString(),
        timestamp: Date.now()
      });
      healthMonitor.recordOperation(false);
    }, 5000);

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // WebRTC event listeners with throttling
    const webrtcListeners = [
      ['webrtc-connection-attempt', throttle((event: CustomEvent) => {
        const { success, peerId, duration } = event.detail;
        analytics.trackConnectionAttempt(peerId, success, duration);
        healthMonitor.recordConnectionAttempt(success);
      }, 2000)],
      
      ['webrtc-signaling', throttle((event: CustomEvent) => {
        const { type, peerId } = event.detail;
        analytics.trackSignalingEvent(type, peerId);
      }, 1000)],
      
      ['webrtc-location-update', throttle(() => {
        analytics.trackLocationShare(true);
      }, 5000)],
      
      ['webrtc-performance-warning', throttle((event: CustomEvent) => {
        analytics.trackEvent('performance_warning', event.detail);
      }, 10000)]
    ];

    webrtcListeners.forEach(([event, handler]) => {
      window.addEventListener(event as string, handler as EventListener);
    });

    return () => {
      healthMonitor.stopMonitoring();
      analytics.endSession();
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      webrtcListeners.forEach(([event, handler]) => {
        window.removeEventListener(event as string, handler as EventListener);
      });
    };
  }, [user?.id, isOnline, isMonitoring, startMonitor, handleHealthChange]);

  // Network status effect with reduced frequency
  useEffect(() => {
    if (wasOffline && isOnline) {
      const offlineTime = localStorage.getItem('offline_timestamp');
      const offlineDuration = offlineTime ? Date.now() - parseInt(offlineTime) : 0;
      
      analytics.trackEvent('network_reconnected', { offlineDuration });
      showToast('Network connection restored', 'success');
      localStorage.removeItem('offline_timestamp');
    } else if (!isOnline) {
      localStorage.setItem('offline_timestamp', Date.now().toString());
      analytics.trackEvent('network_disconnected', {});
    }
  }, [isOnline, wasOffline, showToast]);

  // Optimized click handler with throttling
  useEffect(() => {
    const handleClick = throttle((event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'BUTTON' || target.closest('button')) {
        const buttonText = target.textContent || target.closest('button')?.textContent || 'unknown';
        handleUserAction('button_click', { buttonText });
      }
    }, 500);

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [handleUserAction]);

  // Memoize status indicators to prevent unnecessary re-renders
  const statusIndicators = useMemo(() => (
    <div className="fixed bottom-4 right-4 space-y-2 z-30">
      <div className={`p-2 rounded-full shadow-lg transition-colors duration-300 ${
        isOnline ? 'bg-green-500' : 'bg-red-500'
      }`}>
        {isOnline ? 
          <Wifi className="w-4 h-4 text-white" /> : 
          <WifiOff className="w-4 h-4 text-white" />
        }
      </div>

      <div className={`p-2 rounded-full shadow-lg transition-colors duration-300 ${
        healthStatus === 'healthy' ? 'bg-green-500' :
        healthStatus === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
      }`}>
        <Activity className="w-4 h-4 text-white" />
      </div>
    </div>
  ), [isOnline, healthStatus]);

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

        {/* Health Warning */}
        {showHealthWarning && healthStatus === 'critical' && (
          <div className="fixed top-0 left-0 right-0 z-40 bg-yellow-600 text-white p-2 text-center text-sm animate-fade-in">
            <AlertTriangle className="inline w-4 h-4 mr-2" />
            Application performance issues detected - consider refreshing the page
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

// Utility functions for throttling and debouncing
function throttle<T extends (...args: any[]) => any>(func: T, delay: number): T {
  let inThrottle: boolean;
  return ((...args: any[]) => {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, delay);
    }
  }) as T;
}

function debounce<T extends (...args: any[]) => any>(func: T, delay: number): T {
  let debounceTimer: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => func.apply(this, args), delay);
  }) as T;
}

ProductionWrapper.displayName = 'ProductionWrapper';
