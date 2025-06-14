
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

interface OrganizationSelectorProps {
  organizations: Organization[];
  members: Member[];
  selectedOrg: string;
  selectedMember: string;
  onOrgChange: (value: string) => void;
  onMemberChange: (value: string) => void;
}

export const OrganizationSelector = ({
  organizations,
  members,
  selectedOrg,
  selectedMember,
  onOrgChange,
  onMemberChange
}: OrganizationSelectorProps) => {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">
          Select Organization
        </label>
        <Select value={selectedOrg} onValueChange={onOrgChange}>
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
        <Select value={selectedMember} onValueChange={onMemberChange}>
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
  );
};
