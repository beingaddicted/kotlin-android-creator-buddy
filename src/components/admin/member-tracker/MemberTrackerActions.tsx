
import { Button } from "@/components/ui/button";
import { QrCode, RefreshCw } from "lucide-react";

interface MemberTrackerActionsProps {
  selectedOrg: string;
  webRTCStatus: 'disconnected' | 'connecting' | 'connected';
  isReconnecting: boolean;
  connectionLost: boolean;
  storedClientCount: number;
  isRefreshing: boolean;
  onStartServer: () => void;
  onForceReconnect: () => void;
  onRefreshConnections: () => void;
}

export const MemberTrackerActions = ({
  selectedOrg,
  webRTCStatus,
  isReconnecting,
  connectionLost,
  storedClientCount,
  isRefreshing,
  onStartServer,
  onForceReconnect,
  onRefreshConnections
}: MemberTrackerActionsProps) => {
  return (
    <div className="flex space-x-2">
      {selectedOrg && webRTCStatus === 'disconnected' && !isReconnecting && (
        <Button onClick={onStartServer}>
          <QrCode className="w-4 h-4 mr-2" />
          {storedClientCount > 0 ? 'Start Server (Auto-Reconnect)' : 'Start Server'}
        </Button>
      )}
      {connectionLost && (
        <Button onClick={onForceReconnect} variant="outline" className="border-orange-500 text-orange-600">
          <RefreshCw className="w-4 h-4 mr-2" />
          Force Reconnect
        </Button>
      )}
      <Button 
        onClick={onRefreshConnections} 
        disabled={!selectedOrg || isRefreshing || webRTCStatus !== 'connected'}
        variant="outline"
      >
        <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
        Request Locations
      </Button>
    </div>
  );
};
