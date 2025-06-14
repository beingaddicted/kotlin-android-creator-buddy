
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, TrendingUp, Clock } from 'lucide-react';

interface PerformanceMetrics {
  renderTime: number;
  componentName: string;
  timestamp: number;
}

export const PerformanceDashboard = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [slowComponents, setSlowComponents] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('performance_metrics');
    if (stored) {
      const parsedMetrics = JSON.parse(stored);
      setMetrics(parsedMetrics);

      // Identify slow components
      const slow = parsedMetrics
        .filter((m: PerformanceMetrics) => m.renderTime > 100)
        .map((m: PerformanceMetrics) => m.componentName);
      
      setSlowComponents([...new Set(slow)]);
    }
  }, []);

  const averageRenderTime = metrics.length > 0 
    ? metrics.reduce((sum, m) => sum + m.renderTime, 0) / metrics.length 
    : 0;

  const slowestRender = metrics.length > 0 
    ? Math.max(...metrics.map(m => m.renderTime)) 
    : 0;

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-2xl font-bold">Performance Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Render Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageRenderTime.toFixed(2)}ms</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Slowest Render</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{slowestRender.toFixed(2)}ms</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Metrics</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.length}</div>
          </CardContent>
        </Card>
      </div>

      {slowComponents.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Slow components detected: {slowComponents.join(', ')}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
