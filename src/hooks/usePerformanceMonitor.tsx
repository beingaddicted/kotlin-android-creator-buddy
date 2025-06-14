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
    slowRenderThreshold: 100,
    memoryWarningThreshold: 50 * 1024 * 1024, // 50MB
    errorRateThreshold: 0.1 // 10%
  }
) => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [performanceData, setPerformanceData] = useState<PerformanceMetrics | null>(null);
  const startTimeRef = useRef<number>(performance.now());
  const operationMetricsRef = useRef<OperationMetric[]>([]);
  const errorCountRef = useRef<number>(0);
  const renderCountRef = useRef<number>(0);

  // Enhanced memory usage detection
  const getMemoryUsage = useCallback((): number => {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      return memInfo.usedJSHeapSize || 0;
    }
    return 0;
  }, []);

  // Calculate cache hit rate based on recent operations
  const calculateCacheHitRate = useCallback((): number => {
    const recentOps = operationMetricsRef.current.slice(-100); // Last 100 operations
    if (recentOps.length === 0) return 1;
    
    const successfulOps = recentOps.filter(op => op.success).length;
    return successfulOps / recentOps.length;
  }, []);

  // Enhanced metrics calculation
  useEffect(() => {
    if (!isMonitoring) return;

    const endTime = performance.now();
    const renderTime = endTime - startTimeRef.current;
    renderCountRef.current++;

    const metrics: PerformanceMetrics = {
      renderTime,
      componentName: 'PerformanceMonitor',
      timestamp: Date.now(),
      memoryUsage: getMemoryUsage(),
      cacheHitRate: calculateCacheHitRate(),
      errorCount: errorCountRef.current,
      operationMetrics: [...operationMetricsRef.current.slice(-10)] // Last 10 operations
    };

    // Performance warnings
    if (renderTime > thresholds.slowRenderThreshold) {
      console.warn(`Slow render detected: ${renderTime.toFixed(2)}ms (threshold: ${thresholds.slowRenderThreshold}ms)`);
      
      // Broadcast performance warning
      const channel = new BroadcastChannel('performance-alerts');
      channel.postMessage({
        type: 'slow-render',
        renderTime,
        threshold: thresholds.slowRenderThreshold,
        timestamp: Date.now()
      });
      channel.close();
    }

    // Memory usage warning
    const memoryUsage = getMemoryUsage();
    if (memoryUsage > thresholds.memoryWarningThreshold) {
      console.warn(`High memory usage detected: ${(memoryUsage / 1024 / 1024).toFixed(2)}MB`);
    }

    // Error rate warning
    const errorRate = errorCountRef.current / renderCountRef.current;
    if (errorRate > thresholds.errorRateThreshold) {
      console.warn(`High error rate detected: ${(errorRate * 100).toFixed(2)}%`);
    }

    if (onMetricsUpdate) {
      onMetricsUpdate(metrics);
    }

    setPerformanceData(metrics);

    // Store metrics for analysis with size limit
    if (typeof window !== 'undefined') {
      try {
        const existingMetrics = JSON.parse(localStorage.getItem('performance_metrics') || '[]');
        existingMetrics.push(metrics);
        
        // Keep only last 200 entries to prevent storage bloat
        if (existingMetrics.length > 200) {
          existingMetrics.splice(0, existingMetrics.length - 200);
        }
        
        localStorage.setItem('performance_metrics', JSON.stringify(existingMetrics));
      } catch (error) {
        console.warn('Failed to store performance metrics:', error);
        errorCountRef.current++;
      }
    }
  }, [isMonitoring, onMetricsUpdate, getMemoryUsage, calculateCacheHitRate, thresholds]);

  // Enhanced operation measurement with error handling
  const measureOperation = useCallback((operationName: string, operation: () => void | Promise<void>) => {
    const start = performance.now();
    let success = true;
    
    try {
      const result = operation();
      
      // Handle both sync and async operations
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
            console.log(`${operationName} completed in ${(end - start).toFixed(2)}ms`);
            
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
            errorCountRef.current++;
            console.error(`${operationName} failed after ${(end - start).toFixed(2)}ms:`, error);
            
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
        console.log(`${operationName} completed in ${(end - start).toFixed(2)}ms`);
      }
    } catch (error) {
      success = false;
      errorCountRef.current++;
      const end = performance.now();
      
      const metric: OperationMetric = {
        name: operationName,
        duration: end - start,
        timestamp: Date.now(),
        success: false
      };
      
      operationMetricsRef.current.push(metric);
      console.error(`${operationName} failed after ${(end - start).toFixed(2)}ms:`, error);
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
    console.log('Performance monitoring started');
  }, []);

  const stopMonitor = useCallback(() => {
    setIsMonitoring(false);
    console.log('Performance monitoring stopped');
  }, []);

  const resetMetrics = useCallback(() => {
    operationMetricsRef.current = [];
    errorCountRef.current = 0;
    renderCountRef.current = 0;
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
