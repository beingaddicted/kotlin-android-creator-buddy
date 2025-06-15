
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { Activity, AlertTriangle, CheckCircle, Zap, BarChart3, RefreshCw } from 'lucide-react';

interface PerformanceAlert {
  type: 'slow-render' | 'memory-warning' | 'error-spike';
  message: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high';
}

export const PerformanceDashboard = React.memo(() => {
  const [metrics, setMetrics] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [realTimeMetrics, setRealTimeMetrics] = useState<any>(null);
  
  const { 
    isMonitoring, 
    startMonitor, 
    stopMonitor, 
    resetMetrics, 
    getStoredMetrics,
    performanceData,
    errorCount,
    renderCount
  } = usePerformanceMonitor(setMetrics);

  // Throttled update handlers to prevent excessive re-renders
  const throttledSetLogs = useCallback(
    throttle((newLog: string) => {
      setLogs(prev => [...prev.slice(-24), newLog]); // Reduced from 49 to 24
    }, 1000),
    []
  );

  const throttledSetAlerts = useCallback(
    throttle((alert: PerformanceAlert) => {
      setAlerts(prev => [...prev.slice(-9), alert]); // Reduced from 19 to 9
    }, 2000),
    []
  );

  useEffect(() => {
    const channel = new BroadcastChannel('performance-metrics');
    const alertChannel = new BroadcastChannel('performance-alerts');

    channel.onmessage = (e) => {
      throttledSetLogs(JSON.stringify(e.data, null, 2));
      setRealTimeMetrics(e.data);
    };

    alertChannel.onmessage = (e) => {
      const alert: PerformanceAlert = {
        type: e.data.type,
        message: `${e.data.type}: ${e.data.renderTime?.toFixed(2)}ms (threshold: ${e.data.threshold}ms)`,
        timestamp: e.data.timestamp,
        severity: e.data.renderTime > 10000 ? 'high' : e.data.renderTime > 5000 ? 'medium' : 'low'
      };
      
      throttledSetAlerts(alert);
    };

    // Load historical data only once
    const storedMetrics = getStoredMetrics();
    if (storedMetrics.length > 0) {
      setRealTimeMetrics(storedMetrics[storedMetrics.length - 1]);
    }

    return () => {
      channel.close();
      alertChannel.close();
    };
  }, [getStoredMetrics, throttledSetLogs, throttledSetAlerts]);

  // Memoize expensive calculations
  const averageRenderTime = useMemo(() => {
    const stored = getStoredMetrics();
    if (stored.length === 0) return 0;
    
    const sum = stored.reduce((acc: number, metric: any) => acc + metric.renderTime, 0);
    return sum / stored.length;
  }, [getStoredMetrics, realTimeMetrics]); // Only recalculate when metrics change

  const performanceStatus = useMemo(() => {
    const avgRender = averageRenderTime;
    const errorRate = renderCount > 0 ? errorCount / renderCount : 0;
    
    if (avgRender < 100 && errorRate < 0.05) return { status: 'excellent', color: 'text-green-600' };
    if (avgRender < 500 && errorRate < 0.1) return { status: 'good', color: 'text-blue-600' };
    if (avgRender < 2000 && errorRate < 0.2) return { status: 'fair', color: 'text-yellow-600' };
    return { status: 'poor', color: 'text-red-600' };
  }, [averageRenderTime, renderCount, errorCount]);

  const formatMemoryUsage = useCallback((bytes: number) => {
    if (bytes === 0) return 'N/A';
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  }, []);

  // Memoize the overview cards to prevent unnecessary re-renders
  const overviewCards = useMemo(() => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Average Render Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{averageRenderTime.toFixed(2)}ms</div>
          <p className="text-xs text-muted-foreground">
            Last: {realTimeMetrics?.renderTime?.toFixed(2) || 'N/A'}ms
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatMemoryUsage(realTimeMetrics?.memoryUsage || 0)}
          </div>
          <p className="text-xs text-muted-foreground">
            JS Heap Size
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {renderCount > 0 ? ((errorCount / renderCount) * 100).toFixed(2) : '0.00'}%
          </div>
          <p className="text-xs text-muted-foreground">
            {errorCount} errors in {renderCount} renders
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {((realTimeMetrics?.cacheHitRate || 1) * 100).toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">
            Operation success rate
          </p>
        </CardContent>
      </Card>
    </div>
  ), [averageRenderTime, realTimeMetrics, renderCount, errorCount, formatMemoryUsage]);

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Performance Dashboard</h1>
          <div className="flex items-center space-x-4">
            <Badge variant={isMonitoring ? "default" : "secondary"} className="flex items-center space-x-1">
              <Activity className="w-3 h-3" />
              <span>{isMonitoring ? 'Monitoring Active' : 'Monitoring Inactive'}</span>
            </Badge>
            <div className={`flex items-center space-x-1 ${performanceStatus.color}`}>
              {performanceStatus.status === 'excellent' ? <CheckCircle className="w-4 h-4" /> : 
               performanceStatus.status === 'poor' ? <AlertTriangle className="w-4 h-4" /> : 
               <Zap className="w-4 h-4" />}
              <span className="text-sm font-medium">Status: {performanceStatus.status}</span>
            </div>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <Button 
            onClick={isMonitoring ? stopMonitor : startMonitor}
            variant={isMonitoring ? "destructive" : "default"}
          >
            {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
          </Button>
          <Button onClick={resetMetrics} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {/* Only show alert if there are recent alerts */}
      {alerts.length > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {alerts.length} performance alert(s) detected. Latest: {alerts[alerts.length - 1]?.message}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Detailed Metrics</TabsTrigger>
          <TabsTrigger value="logs">Real-time Logs</TabsTrigger>
          <TabsTrigger value="alerts">Alerts History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {overviewCards}
        </TabsContent>

        <TabsContent value="metrics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Current Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-sm bg-gray-50 p-4 rounded-lg overflow-auto max-h-96">
                {JSON.stringify(metrics || realTimeMetrics, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Real-time Performance Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {logs.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No logs available. Start monitoring to see real-time data.</p>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="text-sm bg-gray-50 p-2 rounded border-l-4 border-blue-500">
                      <pre className="whitespace-pre-wrap">{log}</pre>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>Performance Alerts History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alerts.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No alerts recorded.</p>
                ) : (
                  alerts.map((alert, index) => (
                    <div key={index} className={`p-3 rounded-lg border-l-4 ${
                      alert.severity === 'high' ? 'border-red-500 bg-red-50' :
                      alert.severity === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                      'border-blue-500 bg-blue-50'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{alert.message}</span>
                        <Badge variant={
                          alert.severity === 'high' ? 'destructive' :
                          alert.severity === 'medium' ? 'default' : 'secondary'
                        }>
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
});

// Optimized throttle function
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

PerformanceDashboard.displayName = 'PerformanceDashboard';
