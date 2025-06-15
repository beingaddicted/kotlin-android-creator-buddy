
import React, { useEffect, useState } from 'react';
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

export const ProductionWrapper: React.FC<ProductionWrapperProps> = ({ children }) => {
  const { user } = useSupabaseAuth();
  const { isOnline, wasOffline } = useNetworkStatus();
  const { isMonitoring, startMonitor, measureOperation } = usePerformanceMonitor();
  const [healthStatus, setHealthStatus] = useState<'healthy' | 'warning' | 'critical'>('healthy');
  const [showHealthWarning, setShowHealthWarning] = useState(false);

  useEffect(() => {
    // Initialize analytics
    analytics.initialize(user?.id);

    // Start health monitoring
    healthMonitor.startMonitoring();
    healthMonitor.onHealthChange((status) => {
      setHealthStatus(status.overall);
      
      if (status.overall === 'critical') {
        setShowHealthWarning(true);
        toast.error('Application health critical - performance may be affected');
      } else if (status.overall === 'warning' && !showHealthWarning) {
        toast.warning('Application performance warning detected');
      }
    });

    // Start performance monitoring
    if (!isMonitoring) {
      startMonitor();
    }

    // Track app initialization
    analytics.trackEvent('app_initialized', {
      userId: user?.id,
      isOnline,
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`
    });

    // Set up global error handlers
    window.addEventListener('error', (event) => {
      analytics.trackEvent('javascript_error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
      
      healthMonitor.recordOperation(false);
    });

    window.addEventListener('unhandledrejection', (event) => {
      analytics.trackEvent('unhandled_promise_rejection', {
        reason: event.reason?.toString(),
        stack: event.reason?.stack
      });
      
      healthMonitor.recordOperation(false);
    });

    // Monitor WebRTC specific events
    window.addEventListener('webrtc-connection-attempt', (event: any) => {
      const { success, peerId, duration } = event.detail;
      analytics.trackConnectionAttempt(peerId, success, duration);
      healthMonitor.recordConnectionAttempt(success);
    });

    window.addEventListener('webrtc-signaling', (event: any) => {
      const { type, peerId } = event.detail;
      analytics.trackSignalingEvent(type, peerId);
    });

    window.addEventListener('webrtc-location-update', (event: any) => {
      analytics.trackLocationShare(true);
    });

    // Monitor performance issues
    window.addEventListener('webrtc-performance-warning', (event: any) => {
      analytics.trackEvent('performance_warning', event.detail);
    });

    // Clean up on unmount
    return () => {
      healthMonitor.stopMonitoring();
      analytics.endSession();
    };
  }, [user?.id, isOnline, isMonitoring, startMonitor, showHealthWarning]);

  useEffect(() => {
    if (wasOffline && isOnline) {
      analytics.trackEvent('network_reconnected', {
        offlineDuration: Date.now() - (localStorage.getItem('offline_timestamp') ? 
          parseInt(localStorage.getItem('offline_timestamp')!) : Date.now())
      });
      
      toast.success('Network connection restored');
      localStorage.removeItem('offline_timestamp');
    } else if (!isOnline) {
      localStorage.setItem('offline_timestamp', Date.now().toString());
      analytics.trackEvent('network_disconnected', {});
    }
  }, [isOnline, wasOffline]);

  // Track user interactions
  const handleUserAction = (action: string, context: any = {}) => {
    measureOperation(`user_action_${action}`, () => {
      analytics.trackUserAction(action, context);
      healthMonitor.recordOperation(true);
    });
  };

  // Global click handler for user interaction tracking
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'BUTTON' || target.closest('button')) {
        const buttonText = target.textContent || target.closest('button')?.textContent || 'unknown';
        handleUserAction('button_click', { buttonText });
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <ProductionErrorBoundary>
      <div className="min-h-screen bg-background">
        {/* Network Status Indicator */}
        {!isOnline && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white p-2 text-center text-sm">
            <WifiOff className="inline w-4 h-4 mr-2" />
            No internet connection - some features may be limited
          </div>
        )}

        {/* Health Warning */}
        {showHealthWarning && healthStatus === 'critical' && (
          <div className="fixed top-0 left-0 right-0 z-40 bg-yellow-600 text-white p-2 text-center text-sm">
            <AlertTriangle className="inline w-4 h-4 mr-2" />
            Application performance issues detected - consider refreshing the page
            <button 
              onClick={() => setShowHealthWarning(false)}
              className="ml-4 underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Production Status Indicators */}
        <div className="fixed bottom-4 right-4 space-y-2 z-30">
          {/* Network Status */}
          <div className={`p-2 rounded-full shadow-lg ${
            isOnline ? 'bg-green-500' : 'bg-red-500'
          }`}>
            {isOnline ? 
              <Wifi className="w-4 h-4 text-white" /> : 
              <WifiOff className="w-4 h-4 text-white" />
            }
          </div>

          {/* Health Status */}
          <div className={`p-2 rounded-full shadow-lg ${
            healthStatus === 'healthy' ? 'bg-green-500' :
            healthStatus === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
          }`}>
            <Activity className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Main Application */}
        {children}
      </div>
    </ProductionErrorBoundary>
  );
};
