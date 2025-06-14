import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, RefreshCw, Wifi, WifiOff, QrCode } from "lucide-react";
import { WebRTCQRGenerator } from "./WebRTCQRGenerator";
import { webRTCService, PeerConnection } from "@/services/WebRTCService";
import { ConnectionStatusCard } from "./ConnectionStatusCard";
import { OrganizationSelector } from "./OrganizationSelector";
import { SetupConnectionCard } from "./SetupConnectionCard";
import { MembersList } from "./MembersList";
import { MapSection } from "./MapSection";

interface Organization {
  id: string;
  name: string;
  memberCount: number;
  active: number;
}

interface Member {
  id: string;
  name: string;
  status: 'active' | 'offline';
  lastSeen: string;
  latitude: number;
  longitude: number;
}

interface MemberTrackerProps {
  organizations: Organization[];
}

export const MemberTracker = ({ organizations }: MemberTrackerProps) => {
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [webRTCStatus, setWebRTCStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [connectedPeers, setConnectedPeers] = useState<PeerConnection[]>([]);
  const [showQRGenerator, setShowQRGenerator] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [connectionLost, setConnectionLost] = useState(false);
  const [detailedReconnectionStatus, setDetailedReconnectionStatus] = useState<Map<string, any>>(new Map());
  const [autoReconnectionStarted, setAutoReconnectionStarted] = useState(false);
  const [storedClientCount, setStoredClientCount] = useState(0);
  const [enhancedSignalingStatus, setEnhancedSignalingStatus] = useState<{
    available: boolean;
    connected: boolean;
  }>({ available: false, connected: false });

  useEffect(() => {
    if (selectedOrg && !showQRGenerator) {
      checkWebRTCStatus();
      checkAutoReconnectionCapability();
      checkEnhancedSignaling();
    } else if (!selectedOrg) {
      cleanupWebRTC();
    }
  }, [selectedOrg, showQRGenerator]);

  useEffect(() => {
    const handleConnectionLost = (event: CustomEvent) => {
      console.log('Connection lost event received:', event.detail);
      setConnectionLost(true);
      setWebRTCStatus('disconnected');
    };

    const handleAutoReconnectionStarted = (event: CustomEvent) => {
      console.log('Auto-reconnection started:', event.detail);
      setAutoReconnectionStarted(true);
      setStoredClientCount(event.detail.reconnectedClients || 0);
      
      // Clear the notification after 10 seconds
      setTimeout(() => {
        setAutoReconnectionStarted(false);
      }, 10000);
    };

    window.addEventListener('webrtc-connection-lost', handleConnectionLost as EventListener);
    window.addEventListener('webrtc-auto-reconnection-started', handleAutoReconnectionStarted as EventListener);

    const statusInterval = setInterval(() => {
      if (selectedOrg) {
        const status = webRTCService.getConnectionStatus();
        const reconnecting = webRTCService.isCurrentlyReconnecting();
        const attempts = webRTCService.getReconnectAttempts();
        const detailedStatus = webRTCService.getDetailedReconnectionStatus();
        
        setWebRTCStatus(status);
        setIsReconnecting(reconnecting);
        setReconnectAttempts(attempts);
        setDetailedReconnectionStatus(detailedStatus);
        
        if (status === 'connected') {
          setConnectionLost(false);
        }
      }
    }, 2000);

    return () => {
      window.removeEventListener('webrtc-connection-lost', handleConnectionLost as EventListener);
      window.removeEventListener('webrtc-auto-reconnection-started', handleAutoReconnectionStarted as EventListener);
      clearInterval(statusInterval);
    };
  }, [selectedOrg]);

  const checkWebRTCStatus = () => {
    const status = webRTCService.getConnectionStatus();
    setWebRTCStatus(status);
    
    if (status === 'connected') {
      setupWebRTCListeners();
    }
  };

  const checkAutoReconnectionCapability = () => {
    const canAutoReconnect = webRTCService.canAutoReconnect();
    const clientCount = webRTCService.getStoredClientCount();
    
    if (canAutoReconnect && clientCount > 0) {
      setStoredClientCount(clientCount);
      console.log(`Found ${clientCount} stored clients for potential auto-reconnection`);
    }
  };

  const checkEnhancedSignaling = () => {
    const status = webRTCService.getEnhancedReconnectionStatus();
    setEnhancedSignalingStatus(status);
  };

  const setupWebRTCListeners = () => {
    webRTCService.onLocationUpdate((userId, locationData) => {
      console.log('Received location from user:', userId, locationData);
      updateMemberLocation(userId, locationData);
    });

    webRTCService.onPeerStatusUpdate((peers) => {
      console.log('Peer status updated:', peers);
      setConnectedPeers(peers);
      updateMembersFromPeers(peers);
    });
  };

  const cleanupWebRTC = () => {
    webRTCService.disconnect();
    setWebRTCStatus('disconnected');
    setConnectedPeers([]);
    setMembers([]);
    setConnectionLost(false);
    setIsReconnecting(false);
    setReconnectAttempts(0);
    setAutoReconnectionStarted(false);
    setStoredClientCount(0);
  };

  const handleConnectionEstablished = (organizationId: string) => {
    console.log('WebRTC server established for org:', organizationId);
    setShowQRGenerator(false);
    setWebRTCStatus('connected');
    setConnectionLost(false);
    setupWebRTCListeners();
  };

  const requestLocationFromMember = (memberId: string) => {
    webRTCService.requestLocationFromClient(memberId);
  };

  const requestLocationFromAllMembers = () => {
    webRTCService.requestLocationFromAllClients();
  };

  const refreshConnections = async () => {
    setIsRefreshing(true);
    requestLocationFromAllMembers();
    
    setTimeout(() => {
      console.log('Refreshing WebRTC connections...');
      const currentPeers = webRTCService.getConnectedPeers();
      setConnectedPeers(currentPeers);
      setIsRefreshing(false);
    }, 1000);
  };

  const forceReconnect = async () => {
    console.log('Forcing reconnection...');
    setConnectionLost(false);
    await webRTCService.forceReconnect();
  };

  const updateMemberLocation = (userId: string, locationData: any) => {
    setMembers(currentMembers => {
      const memberIndex = currentMembers.findIndex(m => m.id === userId);
      const updatedMember: Member = {
        id: userId,
        name: `User ${userId.slice(-4)}`,
        status: 'active',
        lastSeen: 'Just now',
        latitude: locationData.latitude,
        longitude: locationData.longitude
      };

      if (memberIndex >= 0) {
        const newMembers = [...currentMembers];
        newMembers[memberIndex] = updatedMember;
        return newMembers;
      } else {
        return [...currentMembers, updatedMember];
      }
    });
  };

  const updateMembersFromPeers = (peers: PeerConnection[]) => {
    const peerMembers: Member[] = peers.map(peer => ({
      id: peer.id,
      name: peer.name,
      status: peer.status === 'connected' ? 'active' : 'offline',
      lastSeen: peer.status === 'connected' ? 'Connected' : formatTimestamp(peer.lastSeen),
      latitude: 0,
      longitude: 0
    }));

    setMembers(currentMembers => {
      const merged = [...peerMembers];
      
      currentMembers.forEach(currentMember => {
        const peerIndex = merged.findIndex(p => p.id === currentMember.id);
        if (peerIndex >= 0) {
          merged[peerIndex] = {
            ...merged[peerIndex],
            latitude: currentMember.latitude,
            longitude: currentMember.longitude
          };
        }
      });

      return merged;
    });
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} mins ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const handleMemberSelect = (memberId: string) => {
    setSelectedMember(memberId);
  };

  const getReconnectionStatusForMember = (memberId: string) => {
    return detailedReconnectionStatus.get(memberId) || { isReconnecting: false, attempt: 0, maxAttempts: 5 };
  };

  if (showQRGenerator) {
    return (
      <WebRTCQRGenerator 
        organizations={organizations}
        onConnectionEstablished={handleConnectionEstablished}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
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
            {enhancedSignalingStatus.available && (
              <div className="flex items-center space-x-1">
                <div className={`w-2 h-2 rounded-full ${
                  enhancedSignalingStatus.connected ? 'bg-blue-500' : 'bg-gray-400'
                }`} />
                <span className={`text-xs ${
                  enhancedSignalingStatus.connected ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  Enhanced Signaling {enhancedSignalingStatus.connected ? 'Active' : 'Offline'}
                </span>
              </div>
            )}
            {storedClientCount > 0 && webRTCStatus === 'disconnected' && (
              <div className="flex items-center space-x-1">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-blue-600">
                  {storedClientCount} stored clients
                  {enhancedSignalingStatus.connected ? ' (Enhanced)' : ''}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex space-x-2">
          {selectedOrg && webRTCStatus === 'disconnected' && !isReconnecting && (
            <Button onClick={() => setShowQRGenerator(true)}>
              <QrCode className="w-4 h-4 mr-2" />
              {storedClientCount > 0 ? 'Start Server (Auto-Reconnect)' : 'Start Server'}
            </Button>
          )}
          {connectionLost && (
            <Button onClick={forceReconnect} variant="outline" className="border-orange-500 text-orange-600">
              <RefreshCw className="w-4 h-4 mr-2" />
              Force Reconnect
            </Button>
          )}
          <Button 
            onClick={refreshConnections} 
            disabled={!selectedOrg || isRefreshing || webRTCStatus !== 'connected'}
            variant="outline"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Request Locations
          </Button>
        </div>
      </div>

      {enhancedSignalingStatus.available && enhancedSignalingStatus.connected && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-3">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-sm text-blue-700 font-medium">
                Enhanced reconnection available - clients can reconnect even after extended downtime
              </span>
            </div>
          </CardContent>
        </Card>
      )}

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
        onForceReconnect={forceReconnect}
      />

      <OrganizationSelector
        organizations={organizations}
        members={members}
        selectedOrg={selectedOrg}
        selectedMember={selectedMember}
        onOrgChange={setSelectedOrg}
        onMemberChange={setSelectedMember}
      />

      {selectedOrg && webRTCStatus === 'disconnected' && !isReconnecting && storedClientCount === 0 && (
        <SetupConnectionCard onStartServer={() => setShowQRGenerator(true)} />
      )}

      {selectedOrg && webRTCStatus === 'connected' && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <MapSection
              members={members}
              connectedPeers={connectedPeers}
              selectedMember={selectedMember}
              webRTCStatus={webRTCStatus}
              onMemberSelect={handleMemberSelect}
            />
          </div>

          <div>
            <MembersList
              members={members}
              selectedMember={selectedMember}
              webRTCStatus={webRTCStatus}
              onMemberSelect={handleMemberSelect}
              getReconnectionStatusForMember={getReconnectionStatusForMember}
            />
          </div>
        </div>
      )}

      {!selectedOrg && organizations.length > 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select an organization</h3>
            <p className="text-gray-500">Choose an organization to view member locations on the map.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
