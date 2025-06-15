
import { useState, useEffect, useCallback, useRef } from "react";
import { webRTCService, PeerConnection } from "@/services/WebRTCService";
import { MemberTrackerHeader } from "./member-tracker/MemberTrackerHeader";
import { MemberTrackerActions } from "./member-tracker/MemberTrackerActions";
import { MemberTrackerNotifications } from "./member-tracker/MemberTrackerNotifications";
import { MemberTrackerContent } from "./member-tracker/MemberTrackerContent";
import { WebRTCQRGenerator } from "./WebRTCQRGenerator";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

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
  const [error, setError] = useState<string | null>(null);

  // Refs for cleanup and state management
  const isMountedRef = useRef(true);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());

  // Safe timeout function
  const safeSetTimeout = useCallback((callback: () => void, delay: number) => {
    const timeout = setTimeout(() => {
      if (isMountedRef.current) {
        callback();
      }
      timeoutsRef.current.delete(timeout);
    }, delay);
    timeoutsRef.current.add(timeout);
    return timeout;
  }, []);

  // Enhanced organization selection with validation
  const handleOrgChange = useCallback((orgId: string) => {
    try {
      // Validate organization exists
      const org = organizations.find(o => o.id === orgId);
      if (orgId && !org) {
        setError(`Organization with ID ${orgId} not found`);
        return;
      }

      setSelectedOrg(orgId);
      setSelectedMember("");
      setError(null);
      
      // Clear previous state when changing organizations
      if (orgId !== selectedOrg) {
        setMembers([]);
        setConnectedPeers([]);
        setConnectionLost(false);
        setIsReconnecting(false);
        setReconnectAttempts(0);
        setAutoReconnectionStarted(false);
      }
    } catch (error) {
      console.error('Error changing organization:', error);
      setError('Failed to change organization');
    }
  }, [organizations, selectedOrg]);

  // WebRTC status monitoring with enhanced error handling
  useEffect(() => {
    if (selectedOrg && !showQRGenerator) {
      try {
        checkWebRTCStatus();
        checkAutoReconnectionCapability();
      } catch (error) {
        console.error('Error checking WebRTC status:', error);
        setError('Failed to check connection status');
      }
    } else if (!selectedOrg) {
      cleanupWebRTC();
    }
  }, [selectedOrg, showQRGenerator]);

  // Event listeners with comprehensive error handling
  useEffect(() => {
    const handleConnectionLost = (event: CustomEvent) => {
      try {
        console.log('Connection lost event received:', event.detail);
        if (isMountedRef.current) {
          setConnectionLost(true);
          setWebRTCStatus('disconnected');
          toast.error('Connection to server lost');
        }
      } catch (error) {
        console.error('Error handling connection lost:', error);
      }
    };

    const handleAutoReconnectionStarted = (event: CustomEvent) => {
      try {
        console.log('Auto-reconnection started:', event.detail);
        if (isMountedRef.current) {
          setAutoReconnectionStarted(true);
          setStoredClientCount(event.detail?.reconnectedClients || 0);
          
          // Auto-hide notification after 10 seconds
          safeSetTimeout(() => {
            setAutoReconnectionStarted(false);
          }, 10000);
        }
      } catch (error) {
        console.error('Error handling auto-reconnection:', error);
      }
    };

    // Add event listeners with error boundary
    try {
      window.addEventListener('webrtc-connection-lost', handleConnectionLost as EventListener);
      window.addEventListener('webrtc-auto-reconnection-started', handleAutoReconnectionStarted as EventListener);
    } catch (error) {
      console.error('Failed to add event listeners:', error);
    }

    // Status monitoring interval with error handling
    if (selectedOrg) {
      statusIntervalRef.current = setInterval(() => {
        if (!isMountedRef.current) return;
        
        try {
          if (webRTCService) {
            const status = webRTCService.getConnectionStatus?.() || 'disconnected';
            const reconnecting = webRTCService.isCurrentlyReconnecting?.() || false;
            const attempts = webRTCService.getReconnectAttempts?.() || 0;
            const detailedStatus = webRTCService.getDetailedReconnectionStatus?.() || new Map();
            
            setWebRTCStatus(status);
            setIsReconnecting(reconnecting);
            setReconnectAttempts(attempts);
            setDetailedReconnectionStatus(detailedStatus);
            
            if (status === 'connected') {
              setConnectionLost(false);
              setError(null);
            }
          }
        } catch (error) {
          console.error('Status monitoring error:', error);
        }
      }, 2000);
    }

    return () => {
      try {
        window.removeEventListener('webrtc-connection-lost', handleConnectionLost as EventListener);
        window.removeEventListener('webrtc-auto-reconnection-started', handleAutoReconnectionStarted as EventListener);
        
        if (statusIntervalRef.current) {
          clearInterval(statusIntervalRef.current);
          statusIntervalRef.current = null;
        }
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    };
  }, [selectedOrg, safeSetTimeout]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      timeoutsRef.current.clear();
    };
  }, []);

  const checkWebRTCStatus = useCallback(() => {
    try {
      if (!webRTCService) {
        setError('WebRTC service not available');
        return;
      }

      const status = webRTCService.getConnectionStatus?.() || 'disconnected';
      setWebRTCStatus(status);
      
      if (status === 'connected') {
        setupWebRTCListeners();
      }
    } catch (error) {
      console.error('Error checking WebRTC status:', error);
      setError('Failed to check connection status');
    }
  }, []);

  const checkAutoReconnectionCapability = useCallback(() => {
    try {
      if (!webRTCService) return;

      const canAutoReconnect = webRTCService.canAutoReconnect?.() || false;
      const clientCount = webRTCService.getStoredClientCount?.() || 0;
      
      if (canAutoReconnect && clientCount > 0) {
        setStoredClientCount(clientCount);
        console.log(`Found ${clientCount} stored clients for potential auto-reconnection`);
      }
    } catch (error) {
      console.error('Error checking auto-reconnection capability:', error);
    }
  }, []);

  const setupWebRTCListeners = useCallback(() => {
    try {
      if (!webRTCService) return;

      // Location update listener with validation
      if (typeof webRTCService.onLocationUpdate === 'function') {
        webRTCService.onLocationUpdate((userId, locationData) => {
          try {
            if (!userId || !locationData) {
              console.warn('Invalid location update data:', { userId, locationData });
              return;
            }
            console.log('Received location from user:', userId, locationData);
            updateMemberLocation(userId, locationData);
          } catch (error) {
            console.error('Error handling location update:', error);
          }
        });
      }

      // Peer status update listener with validation
      if (typeof webRTCService.onPeerStatusUpdate === 'function') {
        webRTCService.onPeerStatusUpdate((peers) => {
          try {
            if (!Array.isArray(peers)) {
              console.warn('Invalid peers data:', peers);
              return;
            }
            console.log('Peer status updated:', peers);
            setConnectedPeers(peers);
            updateMembersFromPeers(peers);
          } catch (error) {
            console.error('Error handling peer status update:', error);
          }
        });
      }
    } catch (error) {
      console.error('Error setting up WebRTC listeners:', error);
      setError('Failed to setup connection listeners');
    }
  }, []);

  const cleanupWebRTC = useCallback(() => {
    try {
      if (webRTCService && typeof webRTCService.disconnect === 'function') {
        webRTCService.disconnect();
      }
      setWebRTCStatus('disconnected');
      setConnectedPeers([]);
      setMembers([]);
      setConnectionLost(false);
      setIsReconnecting(false);
      setReconnectAttempts(0);
      setAutoReconnectionStarted(false);
      setStoredClientCount(0);
      setError(null);
    } catch (error) {
      console.error('Error during WebRTC cleanup:', error);
    }
  }, []);

  const handleConnectionEstablished = useCallback((organizationId: string) => {
    try {
      console.log('WebRTC server established for org:', organizationId);
      setShowQRGenerator(false);
      setWebRTCStatus('connected');
      setConnectionLost(false);
      setError(null);
      setupWebRTCListeners();
      toast.success('Server connection established');
    } catch (error) {
      console.error('Error handling connection established:', error);
      setError('Failed to establish connection');
    }
  }, [setupWebRTCListeners]);

  const refreshConnections = useCallback(async () => {
    if (isRefreshing) return; // Prevent multiple simultaneous refreshes
    
    try {
      setIsRefreshing(true);
      setError(null);
      
      if (webRTCService && typeof webRTCService.requestLocationFromAllClients === 'function') {
        webRTCService.requestLocationFromAllClients();
      }
      
      safeSetTimeout(() => {
        try {
          console.log('Refreshing WebRTC connections...');
          if (webRTCService && typeof webRTCService.getConnectedPeers === 'function') {
            const currentPeers = webRTCService.getConnectedPeers();
            setConnectedPeers(currentPeers);
          }
        } catch (error) {
          console.error('Error during connection refresh:', error);
          setError('Failed to refresh connections');
        } finally {
          setIsRefreshing(false);
        }
      }, 1000);
    } catch (error) {
      console.error('Error refreshing connections:', error);
      setError('Failed to refresh connections');
      setIsRefreshing(false);
    }
  }, [isRefreshing, safeSetTimeout]);

  const forceReconnect = useCallback(async () => {
    try {
      console.log('Forcing reconnection...');
      setConnectionLost(false);
      setError(null);
      
      if (webRTCService && typeof webRTCService.forceReconnect === 'function') {
        await webRTCService.forceReconnect();
        toast.success('Reconnection initiated');
      } else {
        throw new Error('Force reconnect not available');
      }
    } catch (error) {
      console.error('Error forcing reconnection:', error);
      setError('Failed to force reconnection');
      toast.error('Failed to reconnect');
    }
  }, []);

  const updateMemberLocation = useCallback((userId: string, locationData: any) => {
    try {
      if (!userId || !locationData || typeof locationData !== 'object') {
        console.warn('Invalid location data:', { userId, locationData });
        return;
      }

      const { latitude, longitude } = locationData;
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        console.warn('Invalid coordinates:', { latitude, longitude });
        return;
      }

      setMembers(currentMembers => {
        const memberIndex = currentMembers.findIndex(m => m.id === userId);
        const updatedMember: Member = {
          id: userId,
          name: `User ${userId.slice(-4)}`,
          status: 'active',
          lastSeen: 'Just now',
          latitude,
          longitude
        };

        if (memberIndex >= 0) {
          const newMembers = [...currentMembers];
          newMembers[memberIndex] = updatedMember;
          return newMembers;
        } else {
          return [...currentMembers, updatedMember];
        }
      });
    } catch (error) {
      console.error('Error updating member location:', error);
    }
  }, []);

  const updateMembersFromPeers = useCallback((peers: PeerConnection[]) => {
    try {
      if (!Array.isArray(peers)) {
        console.warn('Invalid peers array:', peers);
        return;
      }

      const peerMembers: Member[] = peers.map(peer => {
        if (!peer || typeof peer !== 'object') {
          console.warn('Invalid peer object:', peer);
          return null;
        }

        return {
          id: peer.id || 'unknown',
          name: peer.name || `User ${(peer.id || 'unknown').slice(-4)}`,
          status: peer.status === 'connected' ? 'active' : 'offline',
          lastSeen: peer.status === 'connected' ? 'Connected' : formatTimestamp(peer.lastSeen || Date.now()),
          latitude: 0,
          longitude: 0
        };
      }).filter(Boolean) as Member[];

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
    } catch (error) {
      console.error('Error updating members from peers:', error);
    }
  }, []);

  const formatTimestamp = useCallback((timestamp: number): string => {
    try {
      if (typeof timestamp !== 'number' || timestamp <= 0) {
        return 'Unknown';
      }

      const now = Date.now();
      const diff = now - timestamp;
      
      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)} mins ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
      return new Date(timestamp).toLocaleDateString();
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'Unknown';
    }
  }, []);

  const getReconnectionStatusForMember = useCallback((memberId: string) => {
    try {
      return detailedReconnectionStatus.get(memberId) || { 
        isReconnecting: false, 
        attempt: 0, 
        maxAttempts: 5 
      };
    } catch (error) {
      console.error('Error getting reconnection status:', error);
      return { isReconnecting: false, attempt: 0, maxAttempts: 5 };
    }
  }, [detailedReconnectionStatus]);

  // Show QR generator if requested
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
      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
            <button 
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        </div>
      )}

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
        onOrgChange={handleOrgChange}
        onMemberChange={setSelectedMember}
        onMemberSelect={setSelectedMember}
        onStartServer={() => setShowQRGenerator(true)}
        getReconnectionStatusForMember={getReconnectionStatusForMember}
      />
    </div>
  );
};
