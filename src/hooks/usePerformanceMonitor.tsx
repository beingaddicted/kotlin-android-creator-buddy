import { useEffect, useCallback, useState, useRef } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  componentName: string;
  timestamp: number;
  memoryUsage?: number;
  cacheHitRate?: number;
  errorCount: number;
  operationMetrics: OperationMetric[];
}

interface OperationMetric {
  name: string;
  duration: number;
  timestamp: number;
  success: boolean;
}

interface PerformanceThresholds {
  slowRenderThreshold: number;
  memoryWarningThreshold: number;
  errorRateThreshold: number;
}

export const usePerformanceMonitor = (
  onMetricsUpdate?: (metrics: PerformanceMetrics) => void,
  thresholds: PerformanceThresholds = {
    slowRenderThreshold: 5000, // Increased to 5 seconds
    memoryWarningThreshold: 200 * 1024 * 1024, // Increased to 200MB
    errorRateThreshold: 0.3 // Increased to 30%
  }
) => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [performanceData, setPerformanceData] = useState<PerformanceMetrics | null>(null);
  const startTimeRef = useRef<number>(performance.now());
  const operationMetricsRef = useRef<OperationMetric[]>([]);
  const errorCountRef = useRef<number>(0);
  const renderCountRef = useRef<number>(0);
  const lastWarningTimeRef = useRef<number>(0);
  const metricsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Throttle memory usage detection to reduce overhead significantly
  const getMemoryUsage = useCallback((): number => {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      return memInfo.usedJSHeapSize || 0;
    }
    return 0;
  }, []);

  const calculateCacheHitRate = useCallback((): number => {
    const recentOps = operationMetricsRef.current.slice(-20); // Reduced from 50 to 20
    if (recentOps.length === 0) return 1;
    
    const successfulOps = recentOps.filter(op => op.success).length;
    return successfulOps / recentOps.length;
  }, []);

  // Much more throttled metrics calculation
  useEffect(() => {
    if (!isMonitoring) {
      if (metricsTimerRef.current) {
        clearTimeout(metricsTimerRef.current);
        metricsTimerRef.current = null;
      }
      return;
    }

    const updateMetrics = () => {
      const endTime = performance.now();
      const renderTime = endTime - startTimeRef.current;
      renderCountRef.current++;

      // Only calculate metrics every 20th render or if render time is very significant
      if (renderTime > 100 || renderCountRef.current % 20 === 0) {
        const metrics: PerformanceMetrics = {
          renderTime,
          componentName: 'PerformanceMonitor',
          timestamp: Date.now(),
          memoryUsage: renderCountRef.current % 10 === 0 ? getMemoryUsage() : undefined, // Check memory even less frequently
          cacheHitRate: calculateCacheHitRate(),
          errorCount: errorCountRef.current,
          operationMetrics: [...operationMetricsRef.current.slice(-3)] // Reduced from 5 to 3
        };

        // Much more throttled performance warnings - once per 2 minutes
        const now = Date.now();
        const timeSinceLastWarning = now - lastWarningTimeRef.current;
        
        if (renderTime > thresholds.slowRenderThreshold && timeSinceLastWarning > 120000) {
          console.warn(`Slow render detected: ${renderTime.toFixed(2)}ms (threshold: ${thresholds.slowRenderThreshold}ms)`);
          lastWarningTimeRef.current = now;
        }

        // Memory usage warning with heavy throttling
        const memoryUsage = metrics.memoryUsage;
        if (memoryUsage && memoryUsage > thresholds.memoryWarningThreshold && timeSinceLastWarning > 120000) {
          console.warn(`High memory usage detected: ${(memoryUsage / 1024 / 1024).toFixed(2)}MB`);
          lastWarningTimeRef.current = now;
        }

        if (onMetricsUpdate) {
          onMetricsUpdate(metrics);
        }

        setPerformanceData(metrics);

        // Store metrics much less frequently
        if (typeof window !== 'undefined' && renderCountRef.current % 50 === 0) {
          try {
            const existingMetrics = JSON.parse(localStorage.getItem('performance_metrics') || '[]');
            existingMetrics.push(metrics);
            
            // Keep only last 20 entries instead of 50
            if (existingMetrics.length > 20) {
              existingMetrics.splice(0, existingMetrics.length - 20);
            }
            
            localStorage.setItem('performance_metrics', JSON.stringify(existingMetrics));
          } catch (error) {
            console.warn('Failed to store performance metrics:', error);
            errorCountRef.current++;
          }
        }
      }

      // Update start time for next measurement
      startTimeRef.current = performance.now();
      
      // Schedule next update with longer delay
      metricsTimerRef.current = setTimeout(updateMetrics, 100); // Increased from 16ms to 100ms
    };

    updateMetrics();

    return () => {
      if (metricsTimerRef.current) {
        clearTimeout(metricsTimerRef.current);
        metricsTimerRef.current = null;
      }
    };
  }, [isMonitoring, onMetricsUpdate, getMemoryUsage, calculateCacheHitRate, thresholds]);

  // Enhanced operation measurement with error handling
  const measureOperation = useCallback((operationName: string, operation: () => void | Promise<void>) => {
    const start = performance.now();
    
    try {
      const result = operation();
      
      if (result instanceof Promise) {
        return result
          .then(() => {
            const end = performance.now();
            const metric: OperationMetric = {
              name: operationName,
              duration: end - start,
              timestamp: Date.now(),
              success: true
            };
            
            operationMetricsRef.current.push(metric);
            // Keep metrics array very small
            if (operationMetricsRef.current.length > 10) {
              operationMetricsRef.current = operationMetricsRef.current.slice(-5);
            }
            
            return result;
          })
          .catch((error) => {
            const end = performance.now();
            const metric: OperationMetric = {
              name: operationName,
              duration: end - start,
              timestamp: Date.now(),
              success: false
            };
            
            operationMetricsRef.current.push(metric);
            if (operationMetricsRef.current.length > 10) {
              operationMetricsRef.current = operationMetricsRef.current.slice(-5);
            }
            errorCountRef.current++;
            
            throw error;
          });
      } else {
        const end = performance.now();
        const metric: OperationMetric = {
          name: operationName,
          duration: end - start,
          timestamp: Date.now(),
          success: true
        };
        
        operationMetricsRef.current.push(metric);
        if (operationMetricsRef.current.length > 10) {
          operationMetricsRef.current = operationMetricsRef.current.slice(-5);
        }
      }
    } catch (error) {
      errorCountRef.current++;
      const end = performance.now();
      
      const metric: OperationMetric = {
        name: operationName,
        duration: end - start,
        timestamp: Date.now(),
        success: false
      };
      
      operationMetricsRef.current.push(metric);
      if (operationMetricsRef.current.length > 10) {
        operationMetricsRef.current = operationMetricsRef.current.slice(-5);
      }
      throw error;
    }
  }, []);

  // Simplified batch operation measurement
  const measureBatchOperations = useCallback(async (operations: Array<{ name: string; operation: () => void | Promise<void> }>) => {
    const results = [];
    
    for (const op of operations) {
      try {
        const result = await measureOperation(op.name, op.operation);
        results.push({ name: op.name, success: true, result });
      } catch (error) {
        results.push({ name: op.name, success: false, error });
      }
    }
    
    return results;
  }, [measureOperation]);

  const startMonitor = useCallback(() => {
    setIsMonitoring(true);
    startTimeRef.current = performance.now();
    lastWarningTimeRef.current = 0;
    console.log('Performance monitoring started with optimized settings');
  }, []);

  const stopMonitor = useCallback(() => {
    setIsMonitoring(false);
    if (metricsTimerRef.current) {
      clearTimeout(metricsTimerRef.current);
      metricsTimerRef.current = null;
    }
    console.log('Performance monitoring stopped');
  }, []);

  const resetMetrics = useCallback(() => {
    operationMetricsRef.current = [];
    errorCountRef.current = 0;
    renderCountRef.current = 0;
    lastWarningTimeRef.current = 0;
    setPerformanceData(null);
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('performance_metrics');
    }
    
    console.log('Performance metrics reset');
  }, []);

  const getStoredMetrics = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        return JSON.parse(localStorage.getItem('performance_metrics') || '[]');
      } catch (error) {
        console.warn('Failed to retrieve stored metrics:', error);
        return [];
      }
    }
    return [];
  }, []);

  return { 
    measureOperation,
    measureBatchOperations,
    isMonitoring, 
    startMonitor, 
    stopMonitor,
    resetMetrics,
    getStoredMetrics,
    performanceData,
    errorCount: errorCountRef.current,
    renderCount: renderCountRef.current
  };
};
