import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Users, Clock, RefreshCw, Wifi, WifiOff, QrCode, AlertCircle } from "lucide-react";
import { MapView } from "./MapView";
import { WebRTCQRGenerator } from "./WebRTCQRGenerator";
import { webRTCService, PeerConnection } from "@/services/WebRTCService";

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

  useEffect(() => {
    if (selectedOrg && !showQRGenerator) {
      checkWebRTCStatus();
    } else if (!selectedOrg) {
      cleanupWebRTC();
    }
  }, [selectedOrg, showQRGenerator]);

  useEffect(() => {
    // Listen for connection lost events
    const handleConnectionLost = (event: CustomEvent) => {
      console.log('Connection lost event received:', event.detail);
      setConnectionLost(true);
      setWebRTCStatus('disconnected');
    };

    window.addEventListener('webrtc-connection-lost', handleConnectionLost as EventListener);

    // Periodic status check
    const statusInterval = setInterval(() => {
      if (selectedOrg) {
        const status = webRTCService.getConnectionStatus();
        const reconnecting = webRTCService.isCurrentlyReconnecting();
        const attempts = webRTCService.getReconnectAttempts();
        
        setWebRTCStatus(status);
        setIsReconnecting(reconnecting);
        setReconnectAttempts(attempts);
        
        if (status === 'connected') {
          setConnectionLost(false);
        }
      }
    }, 2000);

    return () => {
      window.removeEventListener('webrtc-connection-lost', handleConnectionLost as EventListener);
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

  const setupWebRTCListeners = () => {
    // Setup location update listener
    webRTCService.onLocationUpdate((userId, locationData) => {
      console.log('Received location from user:', userId, locationData);
      updateMemberLocation(userId, locationData);
    });

    // Setup peer status listener
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
    
    // Request fresh location data from all connected clients
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
          </div>
        </div>
        <div className="flex space-x-2">
          {selectedOrg && webRTCStatus === 'disconnected' && !isReconnecting && (
            <Button onClick={() => setShowQRGenerator(true)}>
              <QrCode className="w-4 h-4 mr-2" />
              Start Server
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

      {/* Connection Status Alert */}
      {connectionLost && (
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
                  onClick={forceReconnect} 
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
      )}

      {/* Reconnecting Status */}
      {isReconnecting && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <p className="text-sm text-blue-700">
                Reconnecting to peers... Attempt {reconnectAttempts} of 5
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Select Organization
          </label>
          <Select value={selectedOrg} onValueChange={setSelectedOrg}>
            <SelectTrigger>
              <SelectValue placeholder="Choose organization" />
            </SelectTrigger>
            <SelectContent>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Focus on Member
          </label>
          <Select value={selectedMember} onValueChange={setSelectedMember}>
            <SelectTrigger>
              <SelectValue placeholder="Select member to focus" />
            </SelectTrigger>
            <SelectContent>
              {members.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedOrg && webRTCStatus === 'disconnected' && !isReconnecting && (
        <Card>
          <CardContent className="text-center py-12">
            <QrCode className="w-12 h-12 text-blue-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Setup P2P Connection</h3>
            <p className="text-gray-500 mb-4">Generate connection QR codes to establish direct peer-to-peer communication with members.</p>
            <Button onClick={() => setShowQRGenerator(true)}>
              <QrCode className="w-4 h-4 mr-2" />
              Generate Connection QR
            </Button>
          </CardContent>
        </Card>
      )}

      {selectedOrg && webRTCStatus === 'connected' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Map Area */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <MapPin className="w-5 h-5 mr-2" />
                    Live Location Map (WebRTC P2P)
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={webRTCStatus === 'connected' ? 'default' : 'secondary'}>
                      {connectedPeers.length} Connected
                    </Badge>
                    <Badge variant={members.filter(m => m.status === 'active' && m.latitude !== 0).length > 0 ? 'default' : 'secondary'}>
                      {members.filter(m => m.status === 'active' && m.latitude !== 0).length} Tracking
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MapView 
                  members={members.filter(m => m.latitude !== 0 && m.longitude !== 0)}
                  selectedMember={selectedMember}
                  onMemberSelect={handleMemberSelect}
                />
              </CardContent>
            </Card>
          </div>

          {/* Member List */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Members ({members.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {members.map((member) => (
                  <div 
                    key={member.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedMember === member.id ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                    onClick={() => handleMemberSelect(member.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">{member.name}</span>
                      <div className="flex items-center space-x-1">
                        <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                          {member.status}
                        </Badge>
                        {member.latitude !== 0 && (
                          <Badge variant="outline" className="text-xs">
                            GPS
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <Clock className="w-3 h-3 mr-1" />
                      {member.lastSeen}
                    </div>
                    {member.status === 'active' && member.latitude !== 0 && (
                      <div className="text-xs text-gray-400 mt-1">
                        {member.latitude.toFixed(4)}, {member.longitude.toFixed(4)}
                      </div>
                    )}
                  </div>
                ))}

                {members.length === 0 && webRTCStatus === 'connected' && (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">Waiting for members to connect...</p>
                    <p className="text-xs text-gray-400 mt-1">Members need to scan connection QR and start tracking</p>
                  </div>
                )}
              </CardContent>
            </Card>
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
