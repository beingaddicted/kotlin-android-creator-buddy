
import { useEffect, useCallback, useState } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  componentName: string;
  timestamp: number;
}

export const usePerformanceMonitor = (onMetricsUpdate?: (metrics: PerformanceMetrics) => void) => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const startTime = performance.now();

  useEffect(() => {
    if (!isMonitoring) return;

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    const metrics: PerformanceMetrics = {
      renderTime,
      componentName: 'PerformanceDashboard',
      timestamp: Date.now(),
    };

    if (renderTime > 100) {
      console.warn(`Slow render detected: ${renderTime.toFixed(2)}ms`);
    }

    if (onMetricsUpdate) {
      onMetricsUpdate(metrics);
    }

    // Store metrics for analysis
    if (typeof window !== 'undefined') {
      const existingMetrics = JSON.parse(localStorage.getItem('performance_metrics') || '[]');
      existingMetrics.push(metrics);
      
      if (existingMetrics.length > 100) {
        existingMetrics.splice(0, existingMetrics.length - 100);
      }
      
      localStorage.setItem('performance_metrics', JSON.stringify(existingMetrics));
    }
  }, [isMonitoring, onMetricsUpdate, startTime]);

  const measureOperation = useCallback((operationName: string, operation: () => void) => {
    const start = performance.now();
    operation();
    const end = performance.now();
    console.log(`${operationName} took ${(end - start).toFixed(2)}ms`);
  }, []);

  const startMonitor = useCallback(() => {
    setIsMonitoring(true);
  }, []);

  const stopMonitor = useCallback(() => {
    setIsMonitoring(false);
  }, []);

  return { 
    measureOperation, 
    isMonitoring, 
    startMonitor, 
    stopMonitor 
  };
};
