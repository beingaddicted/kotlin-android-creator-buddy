
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { webRTCService } from "@/services/WebRTCService";
import { 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  CheckCircle, 
  Activity,
  Download,
  RefreshCw,
  Monitor
} from "lucide-react";

interface ConnectionHealth {
  status: 'excellent' | 'good' | 'poor' | 'critical';
  rtt: number;
  packetLoss: number;
  bitrate: number;
  jitter: number;
  lastUpdated: number;
}

interface DegradationLevel {
  level: 'full' | 'limited' | 'minimal' | 'offline';
  features: Record<string, boolean>;
  limitations: string[];
}

export const ConnectionDiagnostics = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [health, setHealth] = useState<ConnectionHealth | null>(null);
  const [degradation, setDegradation] = useState<DegradationLevel | null>(null);
  const [browserInfo, setBrowserInfo] = useState<any>(null);
  const [errorHistory, setErrorHistory] = useState<any[]>([]);
  const [diagnosticReport, setDiagnosticReport] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      loadDiagnosticData();
      
      const healthListener = (event: CustomEvent) => {
        setHealth(event.detail);
      };
      
      const degradationListener = (event: CustomEvent) => {
        setDegradation(event.detail);
      };

      window.addEventListener('webrtc-health-update', healthListener as EventListener);
      window.addEventListener('webrtc-degradation-change', degradationListener as EventListener);

      return () => {
        window.removeEventListener('webrtc-health-update', healthListener as EventListener);
        window.removeEventListener('webrtc-degradation-change', degradationListener as EventListener);
      };
    }
  }, [isOpen]);

  const loadDiagnosticData = () => {
    setBrowserInfo(webRTCService.getBrowserCompatibility());
    setDegradation(webRTCService.getDegradationLevel());
    setErrorHistory(webRTCService.getErrorHistory());
    setDiagnosticReport(webRTCService.generateDiagnosticReport());
  };

  const downloadReport = () => {
    const blob = new Blob([diagnosticReport], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webrtc-diagnostics-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'good':
        return <Wifi className="w-4 h-4 text-blue-500" />;
      case 'poor':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'critical':
        return <WifiOff className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'poor': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  if (!isOpen) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2"
      >
        <Monitor className="w-4 h-4" />
        Diagnostics
      </Button>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Monitor className="w-5 h-5" />
          Connection Diagnostics
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadDiagnosticData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={downloadReport}>
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
            ×
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="health">Health</TabsTrigger>
            <TabsTrigger value="browser">Browser</TabsTrigger>
            <TabsTrigger value="errors">Errors</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Connection Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    {health ? getHealthStatusIcon(health.status) : <Activity className="w-4 h-4" />}
                    <span className={health ? getStatusColor(health.status) : 'text-gray-600'}>
                      {health ? health.status.charAt(0).toUpperCase() + health.status.slice(1) : 'Unknown'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Service Level</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant={degradation?.level === 'full' ? 'default' : 'secondary'}>
                    {degradation?.level || 'Unknown'}
                  </Badge>
                </CardContent>
              </Card>
            </div>

            {degradation && degradation.limitations.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Current Limitations:</p>
                    <ul className="list-disc list-inside text-sm">
                      {degradation.limitations.map((limitation, index) => (
                        <li key={index}>{limitation}</li>
                      ))}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="health" className="space-y-4">
            {health ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Round Trip Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{health.rtt.toFixed(1)}ms</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Packet Loss</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{health.packetLoss.toFixed(2)}%</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Bitrate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {(health.bitrate / 1000000).toFixed(1)}Mbps
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Jitter</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{health.jitter.toFixed(1)}ms</div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  Health monitoring data is not available. Connection may not be established.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="browser" className="space-y-4">
            {browserInfo && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Browser Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p><strong>Browser:</strong> {browserInfo.name} {browserInfo.version}</p>
                      <div>
                        <strong>Capabilities:</strong>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                          {Object.entries(browserInfo.capabilities).map(([key, value]) => (
                            <div key={key} className="flex items-center gap-2">
                              {value ? 
                                <CheckCircle className="w-3 h-3 text-green-500" /> : 
                                <WifiOff className="w-3 h-3 text-red-500" />
                              }
                              <span className="text-sm">{key}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {browserInfo.limitations.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <p className="font-medium">Browser Limitations:</p>
                        <ul className="list-disc list-inside text-sm">
                          {browserInfo.limitations.map((limitation: string, index: number) => (
                            <li key={index}>{limitation}</li>
                          ))}
                        </ul>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {browserInfo.recommendations.length > 0 && (
                  <Alert>
                    <AlertDescription>
                      <div className="space-y-1">
                        <p className="font-medium">Recommendations:</p>
                        <ul className="list-disc list-inside text-sm">
                          {browserInfo.recommendations.map((recommendation: string, index: number) => (
                            <li key={index}>{recommendation}</li>
                          ))}
                        </ul>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="errors" className="space-y-4">
            {errorHistory.length > 0 ? (
              <div className="space-y-2">
                {errorHistory.slice(-10).map((error, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{error.code}</h4>
                          <p className="text-sm text-gray-600">{error.message}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(error.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <Badge variant="outline">{error.context.connectionState}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  No errors recorded. Connection is stable.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
