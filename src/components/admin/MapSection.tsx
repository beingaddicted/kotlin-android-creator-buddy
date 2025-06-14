
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import { MapView } from "./MapView";
import { PeerConnection } from "@/services/WebRTCService";

interface Member {
  id: string;
  name: string;
  status: 'active' | 'offline';
  lastSeen: string;
  latitude: number;
  longitude: number;
}

interface MapSectionProps {
  members: Member[];
  connectedPeers: PeerConnection[];
  selectedMember: string;
  webRTCStatus: 'disconnected' | 'connecting' | 'connected';
  onMemberSelect: (memberId: string) => void;
}

export const MapSection = ({
  members,
  connectedPeers,
  selectedMember,
  webRTCStatus,
  onMemberSelect
}: MapSectionProps) => {
  return (
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
          onMemberSelect={onMemberSelect}
        />
      </CardContent>
    </Card>
  );
};
