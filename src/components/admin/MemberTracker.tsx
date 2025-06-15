import { useState, useEffect } from "react";
import { webRTCService, PeerConnection } from "@/services/WebRTCService";
import { MemberTrackerHeader } from "./member-tracker/MemberTrackerHeader";
import { MemberTrackerActions } from "./member-tracker/MemberTrackerActions";
import { MemberTrackerNotifications } from "./member-tracker/MemberTrackerNotifications";
import { MemberTrackerContent } from "./member-tracker/MemberTrackerContent";
import { WebRTCQRGenerator } from "./WebRTCQRGenerator";

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

  useEffect(() => {
    if (selectedOrg && !showQRGenerator) {
      checkWebRTCStatus();
      checkAutoReconnectionCapability();
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

  const refreshConnections = async () => {
    setIsRefreshing(true);
    webRTCService.requestLocationFromAllClients();
    
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
        <MemberTrackerHeader
          webRTCStatus={webRTCStatus}
          isReconnecting={isReconnecting}
          reconnectAttempts={reconnectAttempts}
          storedClientCount={storedClientCount}
        />
        <MemberTrackerActions
          selectedOrg={selectedOrg}
          webRTCStatus={webRTCStatus}
          isReconnecting={isReconnecting}
          connectionLost={connectionLost}
          storedClientCount={storedClientCount}
          isRefreshing={isRefreshing}
          onStartServer={() => setShowQRGenerator(true)}
          onForceReconnect={forceReconnect}
          onRefreshConnections={refreshConnections}
        />
      </div>

      <MemberTrackerNotifications
        autoReconnectionStarted={autoReconnectionStarted}
        storedClientCount={storedClientCount}
        connectionLost={connectionLost}
        isReconnecting={isReconnecting}
        reconnectAttempts={reconnectAttempts}
        detailedReconnectionStatus={detailedReconnectionStatus}
        onForceReconnect={forceReconnect}
      />

      <MemberTrackerContent
        organizations={organizations}
        selectedOrg={selectedOrg}
        selectedMember={selectedMember}
        members={members}
        webRTCStatus={webRTCStatus}
        connectedPeers={connectedPeers}
        isReconnecting={isReconnecting}
        storedClientCount={storedClientCount}
        onOrgChange={setSelectedOrg}
        onMemberChange={setSelectedMember}
        onMemberSelect={setSelectedMember}
        onStartServer={() => setShowQRGenerator(true)}
        getReconnectionStatusForMember={getReconnectionStatusForMember}
      />
    </div>
  );
};
