
import { Card, CardContent } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { OrganizationSelector } from "../OrganizationSelector";
import { SetupConnectionCard } from "../SetupConnectionCard";
import { MapSection } from "../MapSection";
import { MembersList } from "../MembersList";
import { PeerConnection } from "@/services/WebRTCService";

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

interface MemberTrackerContentProps {
  organizations: Organization[];
  selectedOrg: string;
  selectedMember: string;
  members: Member[];
  webRTCStatus: 'disconnected' | 'connecting' | 'connected';
  connectedPeers: PeerConnection[];
  isReconnecting: boolean;
  storedClientCount: number;
  onOrgChange: (orgId: string) => void;
  onMemberChange: (memberId: string) => void;
  onMemberSelect: (memberId: string) => void;
  onStartServer: () => void;
  getReconnectionStatusForMember: (memberId: string) => { isReconnecting: boolean; attempt: number; maxAttempts: number };
}

export const MemberTrackerContent = ({
  organizations,
  selectedOrg,
  selectedMember,
  members,
  webRTCStatus,
  connectedPeers,
  isReconnecting,
  storedClientCount,
  onOrgChange,
  onMemberChange,
  onMemberSelect,
  onStartServer,
  getReconnectionStatusForMember
}: MemberTrackerContentProps) => {
  return (
    <>
      <OrganizationSelector
        organizations={organizations}
        members={members}
        selectedOrg={selectedOrg}
        selectedMember={selectedMember}
        onOrgChange={onOrgChange}
        onMemberChange={onMemberChange}
      />

      {selectedOrg && webRTCStatus === 'disconnected' && !isReconnecting && storedClientCount === 0 && (
        <SetupConnectionCard onStartServer={onStartServer} />
      )}

      {selectedOrg && webRTCStatus === 'connected' && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <MapSection
              members={members}
              connectedPeers={connectedPeers}
              selectedMember={selectedMember}
              webRTCStatus={webRTCStatus}
              onMemberSelect={onMemberSelect}
            />
          </div>

          <div>
            <MembersList
              members={members}
              selectedMember={selectedMember}
              webRTCStatus={webRTCStatus}
              onMemberSelect={onMemberSelect}
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
    </>
  );
};
