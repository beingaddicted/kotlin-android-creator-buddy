
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
      // Send metrics to analytics with heavy throttling - only every 50th render
      if (configService.isFeatureEnabled('analytics') && renderCount % 50 === 0) {
        analytics.trackPerformance('render_time', metrics.renderTime);
        if (metrics.memoryUsage) {
          analytics.trackPerformance('memory_usage', metrics.memoryUsage);
        }
        analytics.trackPerformance('cache_hit_rate', metrics.cacheHitRate || 1);
      }

      // Update health monitor much less frequently - every 20th render
      if (renderCount % 20 === 0) {
        healthMonitor.recordOperation(metrics.errorCount === 0);
      }

      // Check for performance warnings with much higher thresholds
      const renderThreshold = configService.getThreshold('performanceWarning') || 5000; // Default 5000ms
      if (metrics.renderTime > renderThreshold) {
        const timeSinceLastWarning = Date.now() - (window as any).lastPerfWarning || 0;
        
        // Throttle warnings to once per 5 minutes
        if (timeSinceLastWarning > 300000) {
          console.warn(`Slow render detected: ${metrics.renderTime}ms`);
          (window as any).lastPerfWarning = Date.now();
          
          // Emit performance warning with heavy throttling
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
      slowRenderThreshold: configService.getThreshold('performanceWarning') || 5000, // Increased
      memoryWarningThreshold: configService.getThreshold('memoryWarning') || 200 * 1024 * 1024, // Increased
      errorRateThreshold: configService.getThreshold('errorRateWarning') || 0.3 // Increased
    }
  );

  // Enhanced operation measurement with production features
  const measureProductionOperation = useCallback((operationName: string, operation: () => void | Promise<void>) => {
    return measureOperation(operationName, () => {
      try {
        const result = operation();
        
        // Track successful operation less frequently
        if (configService.isFeatureEnabled('analytics') && Math.random() < 0.1) { // Only 10% of operations
          analytics.trackEvent('operation_success', {
            operationName,
            category: 'performance'
          });
        }
        
        healthMonitor.recordOperation(true);
        return result;
      } catch (error) {
        // Track failed operation (always track failures)
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

  // Monitor configuration changes with throttling
  useEffect(() => {
    let configUpdateTimer: NodeJS.Timeout;
    
    const handleConfigUpdate = () => {
      // Debounce config updates
      clearTimeout(configUpdateTimer);
      configUpdateTimer = setTimeout(() => {
        console.log('Performance monitoring configuration updated');
      }, 1000);
    };

    window.addEventListener('config-updated', handleConfigUpdate);
    return () => {
      window.removeEventListener('config-updated', handleConfigUpdate);
      clearTimeout(configUpdateTimer);
    };
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
