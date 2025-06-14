
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ConnectionStatusCardProps {
  connectionLost: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  detailedReconnectionStatus: Map<string, any>;
  onForceReconnect: () => void;
}

export const ConnectionStatusCard = ({
  connectionLost,
  isReconnecting,
  reconnectAttempts,
  detailedReconnectionStatus,
  onForceReconnect
}: ConnectionStatusCardProps) => {
  if (connectionLost) {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-orange-900">Connection Lost</h4>
              <p className="text-sm text-orange-700 mt-1">
                Network connection was lost after {reconnectAttempts} reconnection attempts. 
                This can happen when both devices change IP addresses simultaneously.
              </p>
              <Button 
                onClick={onForceReconnect} 
                variant="outline" 
                size="sm" 
                className="mt-2 border-orange-500 text-orange-600"
              >
                Try Reconnecting
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isReconnecting) {
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <div>
              <p className="text-sm text-blue-700">
                Reconnecting to peers... Attempt {reconnectAttempts} of 5
              </p>
              {detailedReconnectionStatus.size > 0 && (
                <div className="mt-2 text-xs text-blue-600">
                  {Array.from(detailedReconnectionStatus.entries()).map(([peerId, status]) => (
                    status.isReconnecting && (
                      <div key={peerId}>
                        {peerId.slice(-4)}: {status.attempt}/{status.maxAttempts} attempts
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
};
