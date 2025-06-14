import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';

export const PerformanceDashboard = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const { isMonitoring, startMonitor, stopMonitor } = usePerformanceMonitor(setMetrics);

  useEffect(() => {
    const channel = new BroadcastChannel('performance-metrics');

    channel.onmessage = (e) => {
      // Ensure data is stringified to prevent type errors
      setLogs(prev => [...prev, JSON.stringify(e.data)]);
    };

    return () => {
      channel.close();
    };
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Performance Dashboard</h1>

      <div className="mb-4">
        <Button onClick={isMonitoring ? stopMonitor : startMonitor}>
          {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
        </Button>
      </div>

      <Card className="mb-4">
        <CardContent>
          <h2 className="text-lg font-semibold mb-2">Metrics</h2>
          <pre>{JSON.stringify(metrics, null, 2)}</pre>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold mb-2">Logs</h2>
          <ul className="list-disc list-inside">
            {logs.map((log, index) => (
              <li key={index}>{log}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};
