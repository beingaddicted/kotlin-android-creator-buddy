
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Users, Clock, RefreshCw } from "lucide-react";
import { MapView } from "./MapView";

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

  // Mock member data - in real app, this would come from WebRTC connections
  const mockMembers: Member[] = [
    { 
      id: '1', 
      name: 'John Doe', 
      status: 'active', 
      lastSeen: '2 mins ago', 
      latitude: 40.7128, 
      longitude: -74.0060 
    },
    { 
      id: '2', 
      name: 'Jane Smith', 
      status: 'active', 
      lastSeen: '5 mins ago', 
      latitude: 40.7589, 
      longitude: -73.9851 
    },
    { 
      id: '3', 
      name: 'Mike Johnson', 
      status: 'offline', 
      lastSeen: '1 hour ago', 
      latitude: 40.7505, 
      longitude: -73.9934 
    },
  ];

  useEffect(() => {
    if (selectedOrg) {
      setMembers(mockMembers);
    } else {
      setMembers([]);
    }
  }, [selectedOrg]);

  const refreshLocations = async () => {
    setIsRefreshing(true);
    
    // Simulate API call delay
    setTimeout(() => {
      console.log('Refreshing member locations...');
      // In real app, this would trigger WebRTC location requests
      setIsRefreshing(false);
    }, 1000);
  };

  const handleMemberSelect = (memberId: string) => {
    setSelectedMember(memberId);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Live Member Tracking</h2>
          <p className="text-gray-600">Monitor real-time locations of organization members</p>
        </div>
        <Button 
          onClick={refreshLocations} 
          disabled={!selectedOrg || isRefreshing}
          variant="outline"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

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

      {selectedOrg && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Map Area */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <MapPin className="w-5 h-5 mr-2" />
                    Live Location Map
                  </div>
                  <Badge variant={members.filter(m => m.status === 'active').length > 0 ? 'default' : 'secondary'}>
                    {members.filter(m => m.status === 'active').length} Active
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MapView 
                  members={members}
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
                      <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                        {member.status}
                      </Badge>
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <Clock className="w-3 h-3 mr-1" />
                      {member.lastSeen}
                    </div>
                    {member.status === 'active' && (
                      <div className="text-xs text-gray-400 mt-1">
                        {member.latitude.toFixed(4)}, {member.longitude.toFixed(4)}
                      </div>
                    )}
                  </div>
                ))}

                {members.length === 0 && (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No members found</p>
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
