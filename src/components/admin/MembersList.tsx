
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Clock } from "lucide-react";

interface Member {
  id: string;
  name: string;
  status: 'active' | 'offline';
  lastSeen: string;
  latitude: number;
  longitude: number;
}

interface MembersListProps {
  members: Member[];
  selectedMember: string;
  webRTCStatus: 'disconnected' | 'connecting' | 'connected';
  onMemberSelect: (memberId: string) => void;
  getReconnectionStatusForMember: (memberId: string) => { isReconnecting: boolean; attempt: number; maxAttempts: number };
}

export const MembersList = ({
  members,
  selectedMember,
  webRTCStatus,
  onMemberSelect,
  getReconnectionStatusForMember
}: MembersListProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Users className="w-5 h-5 mr-2" />
          Members ({members.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {members.map((member) => {
          const reconnectionStatus = getReconnectionStatusForMember(member.id);
          return (
            <div 
              key={member.id}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedMember === member.id ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
              onClick={() => onMemberSelect(member.id)}
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
                  {reconnectionStatus.isReconnecting && (
                    <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                      Reconnecting ({reconnectionStatus.attempt}/{reconnectionStatus.maxAttempts})
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
          );
        })}

        {members.length === 0 && webRTCStatus === 'connected' && (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">Waiting for members to connect...</p>
            <p className="text-xs text-gray-400 mt-1">Members need to scan connection QR and start tracking</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
