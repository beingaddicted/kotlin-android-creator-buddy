
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Network, Users, Server, Shield, Eye, EyeOff } from "lucide-react";
import { webRTCService } from "@/services/WebRTCService";

interface AdminDevice {
  deviceId: string;
  deviceName: string;
  lastSeen: number;
  isPrimary: boolean;
  capabilities: string[];
}

interface MeshStatus {
  hasActiveAdmin: boolean;
  temporaryServerId: string | null;
  connectedDevices: any[];
  meshTopology: Map<string, string[]>;
}

export const MeshNetworkStatus = () => {
  const [meshStatus, setMeshStatus] = useState<MeshStatus | null>(null);
  const [adminDevices, setAdminDevices] = useState<AdminDevice[]>([]);
  const [showDeviceIds, setShowDeviceIds] = useState(false);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>("");

  useEffect(() => {
    // Get current device info
    const deviceInfo = webRTCService.getCurrentDeviceInfo();
    setCurrentDeviceId(deviceInfo?.deviceId || "");

    // Get initial status
    updateMeshStatus();
    updateAdminDevices();

    // Listen for updates
    const handleMeshUpdate = () => {
      updateMeshStatus();
    };

    const handleAdminUpdate = (event: CustomEvent) => {
      setAdminDevices(event.detail.admins);
    };

    window.addEventListener('webrtc-mesh-status-update', handleMeshUpdate);
    window.addEventListener('webrtc-admin-status-update', handleAdminUpdate as EventListener);

    // Update every 5 seconds
    const interval = setInterval(() => {
      updateMeshStatus();
      updateAdminDevices();
    }, 5000);

    return () => {
      window.removeEventListener('webrtc-mesh-status-update', handleMeshUpdate);
      window.removeEventListener('webrtc-admin-status-update', handleAdminUpdate as EventListener);
      clearInterval(interval);
    };
  }, []);

  const updateMeshStatus = () => {
    const status = webRTCService.getMeshNetworkStatus();
    setMeshStatus(status);
  };

  const updateAdminDevices = () => {
    const admins = webRTCService.getAllAdmins();
    setAdminDevices(admins);
  };

  const formatDeviceId = (deviceId: string) => {
    if (showDeviceIds) return deviceId;
    return deviceId.slice(-8); // Show last 8 characters
  };

  const formatLastSeen = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 5000) return 'Just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  const isPrimaryAdmin = webRTCService.isPrimaryAdmin();
  const canPerformAdminActions = webRTCService.canPerformAdminActions();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center">
            <Network className="w-5 h-5 mr-2" />
            Mesh Network Status
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeviceIds(!showDeviceIds)}
          >
            {showDeviceIds ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {meshStatus?.connectedDevices.length || 0}
              </div>
              <div className="text-sm text-gray-600">Connected Devices</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {adminDevices.length}
              </div>
              <div className="text-sm text-gray-600">Admin Devices</div>
            </div>
            
            <div className="text-center">
              <div className={`text-2xl font-bold ${meshStatus?.hasActiveAdmin ? 'text-green-600' : 'text-red-600'}`}>
                {meshStatus?.hasActiveAdmin ? 'Active' : 'Offline'}
              </div>
              <div className="text-sm text-gray-600">Admin Status</div>
            </div>
            
            <div className="text-center">
              <div className={`text-2xl font-bold ${meshStatus?.temporaryServerId ? 'text-orange-600' : 'text-gray-400'}`}>
                {meshStatus?.temporaryServerId ? 'Active' : 'None'}
              </div>
              <div className="text-sm text-gray-600">Temp Server</div>
            </div>
          </div>

          {meshStatus?.temporaryServerId && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="flex items-center">
                <Server className="w-4 h-4 text-orange-600 mr-2" />
                <span className="text-sm text-orange-800">
                  Temporary server active: {formatDeviceId(meshStatus.temporaryServerId)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            Admin Devices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {adminDevices.map((admin) => (
              <div
                key={admin.deviceId}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  admin.deviceId === currentDeviceId ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    Date.now() - admin.lastSeen < 10000 ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                  <div>
                    <div className="font-medium">
                      {admin.deviceName || 'Unknown Device'}
                      {admin.deviceId === currentDeviceId && (
                        <span className="text-blue-600 text-sm ml-2">(You)</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      {formatDeviceId(admin.deviceId)}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {admin.isPrimary && (
                    <Badge variant="default" className="bg-blue-600">
                      Primary
                    </Badge>
                  )}
                  <div className="text-sm text-gray-500">
                    {formatLastSeen(admin.lastSeen)}
                  </div>
                </div>
              </div>
            ))}
            
            {adminDevices.length === 0 && (
              <div className="text-center text-gray-500 py-4">
                No admin devices detected
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Connected Devices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {meshStatus?.connectedDevices.map((device) => (
              <div
                key={device.deviceId}
                className="flex items-center justify-between p-3 rounded-lg border bg-gray-50"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    Date.now() - device.lastSeen < 10000 ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                  <div>
                    <div className="font-medium">
                      {device.deviceName || 'Unknown Device'}
                    </div>
                    <div className="text-sm text-gray-600">
                      {formatDeviceId(device.deviceId)}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">
                    {device.deviceType}
                  </Badge>
                  {device.isTemporaryServer && (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                      Temp Server
                    </Badge>
                  )}
                  <div className="text-sm text-gray-500">
                    {formatLastSeen(device.lastSeen)}
                  </div>
                </div>
              </div>
            ))}
            
            {(!meshStatus?.connectedDevices || meshStatus.connectedDevices.length === 0) && (
              <div className="text-center text-gray-500 py-4">
                No devices connected
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isPrimaryAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center">
            <Shield className="w-4 h-4 text-blue-600 mr-2" />
            <span className="text-sm text-blue-800">
              You are the primary admin device
            </span>
          </div>
        </div>
      )}

      {!canPerformAdminActions && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center">
            <Users className="w-4 h-4 text-yellow-600 mr-2" />
            <span className="text-sm text-yellow-800">
              Limited admin privileges - you can view but not control
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
