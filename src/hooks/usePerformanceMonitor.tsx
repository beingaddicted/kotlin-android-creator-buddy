import { useEffect, useCallback } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  componentName: string;
  timestamp: number;
}

export const usePerformanceMonitor = (componentName: string) => {
  const startTime = performance.now();

  useEffect(() => {
    const endTime = performance.now();
    const renderTime = endTime - startTime;

    if (renderTime > 100) { // Log slow renders
      console.warn(`Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`);
    }

    // In production, you might want to send this to analytics
    const metrics: PerformanceMetrics = {
      renderTime,
      componentName,
      timestamp: Date.now(),
    };

    // Store metrics for analysis
    if (typeof window !== 'undefined') {
      const existingMetrics = JSON.parse(localStorage.getItem('performance_metrics') || '[]');
      existingMetrics.push(metrics);
      
      // Keep only last 100 metrics
      if (existingMetrics.length > 100) {
        existingMetrics.splice(0, existingMetrics.length - 100);
      }
      
      localStorage.setItem('performance_metrics', JSON.stringify(existingMetrics));
    }
  });

  const measureOperation = useCallback((operationName: string, operation: () => void) => {
    const start = performance.now();
    operation();
    const end = performance.now();
    console.log(`${operationName} took ${(end - start).toFixed(2)}ms`);
  }, []);

  return { measureOperation };
};
