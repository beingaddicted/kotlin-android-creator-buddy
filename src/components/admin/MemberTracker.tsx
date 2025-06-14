
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Clock } from "lucide-react";

interface Organization {
  id: string;
  name: string;
  memberCount: number;
  active: number;
}

interface MemberTrackerProps {
  organizations: Organization[];
}

export const MemberTracker = ({ organizations }: MemberTrackerProps) => {
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [selectedMember, setSelectedMember] = useState<string>("");

  // Mock member data
  const members = [
    { id: '1', name: 'John Doe', status: 'active', lastSeen: '2 mins ago', lat: 40.7128, lng: -74.0060 },
    { id: '2', name: 'Jane Smith', status: 'active', lastSeen: '5 mins ago', lat: 40.7589, lng: -73.9851 },
    { id: '3', name: 'Mike Johnson', status: 'offline', lastSeen: '1 hour ago', lat: 40.7505, lng: -73.9934 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Live Member Tracking</h2>
        <p className="text-gray-600">Monitor real-time locations of organization members</p>
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
                <CardTitle className="flex items-center">
                  <MapPin className="w-5 h-5 mr-2" />
                  Live Location Map
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full h-96 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-2">Interactive Map View</p>
                    <p className="text-sm text-gray-400">
                      {selectedMember ? 
                        `Focused on ${members.find(m => m.id === selectedMember)?.name}` :
                        `Showing all ${members.filter(m => m.status === 'active').length} active members`
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Member List */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Active Members
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {members.map((member) => (
                  <div 
                    key={member.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedMember === member.id ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                    onClick={() => setSelectedMember(member.id)}
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
                  </div>
                ))}
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
