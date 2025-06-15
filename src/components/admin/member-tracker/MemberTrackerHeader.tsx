
import { Wifi, WifiOff, MapPin } from "lucide-react";

interface MemberTrackerHeaderProps {
  webRTCStatus: 'disconnected' | 'connecting' | 'connected';
  isReconnecting: boolean;
  reconnectAttempts: number;
  storedClientCount: number;
}

export const MemberTrackerHeader = ({ 
  webRTCStatus, 
  isReconnecting, 
  reconnectAttempts, 
  storedClientCount 
}: MemberTrackerHeaderProps) => {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Live Member Tracking</h2>
      <div className="flex items-center space-x-4">
        <p className="text-gray-600">Monitor real-time locations via WebRTC P2P server</p>
        <div className="flex items-center space-x-1">
          {webRTCStatus === 'connected' ? (
            <Wifi className="w-4 h-4 text-green-600" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-600" />
          )}
          <span className={`text-sm font-medium ${
            webRTCStatus === 'connected' ? 'text-green-600' : 'text-red-600'
          }`}>
            {webRTCStatus === 'connected' ? 'Server Active' : 
             isReconnecting ? `Reconnecting (${reconnectAttempts}/5)` : 'Server Offline'}
          </span>
        </div>
        {storedClientCount > 0 && webRTCStatus === 'disconnected' && (
          <div className="flex items-center space-x-1">
            <MapPin className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-blue-600">
              {storedClientCount} stored clients
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
