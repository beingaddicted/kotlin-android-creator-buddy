
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, Eye, RefreshCw, Download } from 'lucide-react';
import { EnhancedSecurityManager } from '@/services/security/EnhancedSecurityManager';

export const SecurityMonitor = () => {
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [criticalEvents, setCriticalEvents] = useState<any[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    const securityManager = (window as any).securityManager as EnhancedSecurityManager;
    if (!securityManager) return;

    const handleSecurityEvent = (event: CustomEvent) => {
      const eventData = event.detail;
      setSecurityEvents(prev => [eventData, ...prev.slice(0, 49)]); // Keep last 50 events
      
      if (eventData.severity === 'critical' || eventData.severity === 'high') {
        setCriticalEvents(prev => [eventData, ...prev.slice(0, 9)]); // Keep last 10 critical events
      }
    };

    window.addEventListener('security-event', handleSecurityEvent as EventListener);
    setIsMonitoring(true);

    // Load existing events
    setSecurityEvents(securityManager.getSecurityEvents().slice(0, 50));
    setCriticalEvents(securityManager.getCriticalEvents().slice(0, 10));

    return () => {
      window.removeEventListener('security-event', handleSecurityEvent as EventListener);
      setIsMonitoring(false);
    };
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const exportSecurityLog = () => {
    const data = JSON.stringify(securityEvents, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-log-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Shield className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-semibold">Security Monitor</h2>
          <Badge variant={isMonitoring ? 'default' : 'secondary'}>
            {isMonitoring ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={exportSecurityLog}
            disabled={securityEvents.length === 0}
          >
            <Download className="w-4 h-4 mr-1" />
            Export Log
          </Button>
        </div>
      </div>

      {/* Critical Events Alert */}
      {criticalEvents.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{criticalEvents.length} critical security event(s) detected.</strong>
            <p className="text-sm mt-1">
              Latest: {criticalEvents[0].event} at {formatTimestamp(criticalEvents[0].timestamp)}
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Security Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{securityEvents.filter(e => e.severity === 'low').length}</div>
            <p className="text-sm text-gray-600">Low Priority</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{securityEvents.filter(e => e.severity === 'medium').length}</div>
            <p className="text-sm text-gray-600">Medium Priority</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">{securityEvents.filter(e => e.severity === 'high').length}</div>
            <p className="text-sm text-gray-600">High Priority</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{securityEvents.filter(e => e.severity === 'critical').length}</div>
            <p className="text-sm text-gray-600">Critical</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Security Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Eye className="w-4 h-4" />
            <span>Recent Security Events</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {securityEvents.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No security events recorded</p>
            ) : (
              securityEvents.map((event, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <Badge variant={getSeverityColor(event.severity) as any}>
                        {event.severity.toUpperCase()}
                      </Badge>
                      <span className="font-medium">{event.event}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {formatTimestamp(event.timestamp)}
                    </p>
                    {Object.keys(event.details).length > 0 && (
                      <pre className="text-xs text-gray-500 mt-1 bg-gray-50 p-2 rounded overflow-x-auto">
                        {JSON.stringify(event.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
