import { useEffect, useCallback } from 'react';
import { usePerformanceMonitor } from './usePerformanceMonitor';
import { analytics } from '@/services/production/AnalyticsService';
import { healthMonitor } from '@/services/production/HealthMonitor';
import { configService } from '@/services/production/ConfigurationService';

export const useProductionPerformanceMonitor = () => {
  const { 
    measureOperation, 
    measureBatchOperations,
    isMonitoring, 
    startMonitor, 
    stopMonitor,
    performanceData,
    errorCount,
    renderCount
  } = usePerformanceMonitor(
    (metrics) => {
      // Send metrics to analytics with throttling
      if (configService.isFeatureEnabled('analytics') && renderCount % 10 === 0) { // Reduced frequency
        analytics.trackPerformance('render_time', metrics.renderTime);
        if (metrics.memoryUsage) {
          analytics.trackPerformance('memory_usage', metrics.memoryUsage);
        }
        analytics.trackPerformance('cache_hit_rate', metrics.cacheHitRate || 1);
      }

      // Update health monitor less frequently
      if (renderCount % 5 === 0) {
        healthMonitor.recordOperation(metrics.errorCount === 0);
      }

      // Check for performance warnings with higher thresholds
      const renderThreshold = configService.getThreshold('performanceWarning') || 1000; // Default 1000ms
      if (metrics.renderTime > renderThreshold) {
        const timeSinceLastWarning = Date.now() - (window as any).lastPerfWarning || 0;
        
        // Throttle warnings to once per minute
        if (timeSinceLastWarning > 60000) {
          console.warn(`Slow render detected: ${metrics.renderTime}ms`);
          (window as any).lastPerfWarning = Date.now();
          
          // Emit performance warning with throttling
          window.dispatchEvent(new CustomEvent('webrtc-performance-warning', {
            detail: {
              type: 'slow_render',
              renderTime: metrics.renderTime,
              threshold: renderThreshold,
              componentName: metrics.componentName
            }
          }));
        }
      }
    },
    {
      slowRenderThreshold: configService.getThreshold('performanceWarning') || 1000,
      memoryWarningThreshold: configService.getThreshold('memoryWarning') || 100 * 1024 * 1024,
      errorRateThreshold: configService.getThreshold('errorRateWarning') || 0.2
    }
  );

  // Enhanced operation measurement with production features
  const measureProductionOperation = useCallback((operationName: string, operation: () => void | Promise<void>) => {
    return measureOperation(operationName, () => {
      try {
        const result = operation();
        
        // Track successful operation
        if (configService.isFeatureEnabled('analytics')) {
          analytics.trackEvent('operation_success', {
            operationName,
            category: 'performance'
          });
        }
        
        healthMonitor.recordOperation(true);
        return result;
      } catch (error) {
        // Track failed operation
        if (configService.isFeatureEnabled('analytics')) {
          analytics.trackEvent('operation_failure', {
            operationName,
            error: (error as Error).message,
            category: 'performance'
          });
        }
        
        healthMonitor.recordOperation(false);
        throw error;
      }
    });
  }, [measureOperation]);

  // WebRTC specific performance measurements
  const measureWebRTCOperation = useCallback((operationType: string, operation: () => void | Promise<void>) => {
    return measureProductionOperation(`webrtc_${operationType}`, operation);
  }, [measureProductionOperation]);

  const measureConnectionOperation = useCallback((peerId: string, operation: () => void | Promise<void>) => {
    const startTime = performance.now();
    
    return measureProductionOperation(`connection_${peerId}`, async () => {
      try {
        const result = await operation();
        const duration = performance.now() - startTime;
        
        // Track connection success
        analytics.trackConnectionAttempt(peerId, true, duration);
        healthMonitor.recordConnectionAttempt(true);
        
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        
        // Track connection failure
        analytics.trackConnectionAttempt(peerId, false, duration);
        healthMonitor.recordConnectionAttempt(false);
        
        throw error;
      }
    });
  }, [measureProductionOperation]);

  // Start monitoring when production features are enabled
  useEffect(() => {
    if (configService.isFeatureEnabled('performanceMonitoring') && !isMonitoring) {
      startMonitor();
    } else if (!configService.isFeatureEnabled('performanceMonitoring') && isMonitoring) {
      stopMonitor();
    }
  }, [configService, isMonitoring, startMonitor, stopMonitor]);

  // Monitor configuration changes
  useEffect(() => {
    const handleConfigUpdate = () => {
      console.log('Performance monitoring configuration updated');
    };

    window.addEventListener('config-updated', handleConfigUpdate);
    return () => window.removeEventListener('config-updated', handleConfigUpdate);
  }, []);

  return {
    measureOperation: measureProductionOperation,
    measureBatchOperations,
    measureWebRTCOperation,
    measureConnectionOperation,
    isMonitoring,
    startMonitor,
    stopMonitor,
    performanceData,
    errorCount,
    renderCount,
    isProductionReady: configService.isProduction()
  };
};
