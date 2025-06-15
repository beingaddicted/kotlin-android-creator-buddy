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
    slowRenderThreshold: 1000, // Increased from 100ms to 1000ms
    memoryWarningThreshold: 100 * 1024 * 1024, // Increased to 100MB
    errorRateThreshold: 0.2 // Increased to 20%
  }
) => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [performanceData, setPerformanceData] = useState<PerformanceMetrics | null>(null);
  const startTimeRef = useRef<number>(performance.now());
  const operationMetricsRef = useRef<OperationMetric[]>([]);
  const errorCountRef = useRef<number>(0);
  const renderCountRef = useRef<number>(0);
  const lastWarningTimeRef = useRef<number>(0);

  // Throttle memory usage detection to reduce overhead
  const getMemoryUsage = useCallback((): number => {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      return memInfo.usedJSHeapSize || 0;
    }
    return 0;
  }, []);

  const calculateCacheHitRate = useCallback((): number => {
    const recentOps = operationMetricsRef.current.slice(-50); // Reduced from 100 to 50
    if (recentOps.length === 0) return 1;
    
    const successfulOps = recentOps.filter(op => op.success).length;
    return successfulOps / recentOps.length;
  }, []);

  // Throttled metrics calculation with reduced frequency
  useEffect(() => {
    if (!isMonitoring) return;

    const metricsTimer = setTimeout(() => {
      const endTime = performance.now();
      const renderTime = endTime - startTimeRef.current;
      renderCountRef.current++;

      // Only calculate metrics if render time is significant or every 10th render
      if (renderTime > 50 || renderCountRef.current % 10 === 0) {
        const metrics: PerformanceMetrics = {
          renderTime,
          componentName: 'PerformanceMonitor',
          timestamp: Date.now(),
          memoryUsage: renderCountRef.current % 5 === 0 ? getMemoryUsage() : undefined, // Check memory less frequently
          cacheHitRate: calculateCacheHitRate(),
          errorCount: errorCountRef.current,
          operationMetrics: [...operationMetricsRef.current.slice(-5)] // Reduced from 10 to 5
        };

        // Throttle performance warnings to once per 30 seconds
        const now = Date.now();
        const timeSinceLastWarning = now - lastWarningTimeRef.current;
        
        if (renderTime > thresholds.slowRenderThreshold && timeSinceLastWarning > 30000) {
          console.warn(`Slow render detected: ${renderTime.toFixed(2)}ms (threshold: ${thresholds.slowRenderThreshold}ms)`);
          lastWarningTimeRef.current = now;
        }

        // Memory usage warning with throttling
        const memoryUsage = metrics.memoryUsage;
        if (memoryUsage && memoryUsage > thresholds.memoryWarningThreshold && timeSinceLastWarning > 30000) {
          console.warn(`High memory usage detected: ${(memoryUsage / 1024 / 1024).toFixed(2)}MB`);
          lastWarningTimeRef.current = now;
        }

        if (onMetricsUpdate) {
          onMetricsUpdate(metrics);
        }

        setPerformanceData(metrics);

        // Store metrics with size limit and reduced frequency
        if (typeof window !== 'undefined' && renderCountRef.current % 20 === 0) { // Store less frequently
          try {
            const existingMetrics = JSON.parse(localStorage.getItem('performance_metrics') || '[]');
            existingMetrics.push(metrics);
            
            // Keep only last 50 entries instead of 200
            if (existingMetrics.length > 50) {
              existingMetrics.splice(0, existingMetrics.length - 50);
            }
            
            localStorage.setItem('performance_metrics', JSON.stringify(existingMetrics));
          } catch (error) {
            console.warn('Failed to store performance metrics:', error);
            errorCountRef.current++;
          }
        }
      }
    }, 16); // Small delay to avoid blocking main thread

    return () => clearTimeout(metricsTimer);
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
            // Keep metrics array small
            if (operationMetricsRef.current.length > 20) {
              operationMetricsRef.current = operationMetricsRef.current.slice(-10);
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
            if (operationMetricsRef.current.length > 20) {
              operationMetricsRef.current = operationMetricsRef.current.slice(-10);
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
        if (operationMetricsRef.current.length > 20) {
          operationMetricsRef.current = operationMetricsRef.current.slice(-10);
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
      if (operationMetricsRef.current.length > 20) {
        operationMetricsRef.current = operationMetricsRef.current.slice(-10);
      }
      throw error;
    }
  }, []);

  // Batch operation measurement for multiple operations
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
    lastWarningTimeRef.current = 0; // Reset warning throttle
    console.log('Performance monitoring started with optimized settings');
  }, []);

  const stopMonitor = useCallback(() => {
    setIsMonitoring(false);
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
