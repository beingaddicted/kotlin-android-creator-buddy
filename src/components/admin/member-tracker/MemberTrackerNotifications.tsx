
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import { ConnectionStatusCard } from "../ConnectionStatusCard";

interface MemberTrackerNotificationsProps {
  autoReconnectionStarted: boolean;
  storedClientCount: number;
  connectionLost: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  detailedReconnectionStatus: Map<string, any>;
  onForceReconnect: () => void;
}

export const MemberTrackerNotifications = ({
  autoReconnectionStarted,
  storedClientCount,
  connectionLost,
  isReconnecting,
  reconnectAttempts,
  detailedReconnectionStatus,
  onForceReconnect
}: MemberTrackerNotificationsProps) => {
  return (
    <>
      {autoReconnectionStarted && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-3">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
              <span className="text-sm text-blue-700 font-medium">
                Auto-reconnection initiated to {storedClientCount} previous clients
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <ConnectionStatusCard
        connectionLost={connectionLost}
        isReconnecting={isReconnecting}
        reconnectAttempts={reconnectAttempts}
        detailedReconnectionStatus={detailedReconnectionStatus}
        onForceReconnect={onForceReconnect}
      />
    </>
  );
};
