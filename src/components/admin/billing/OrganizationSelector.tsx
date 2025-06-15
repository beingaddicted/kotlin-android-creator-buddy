
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Organization {
  id: string;
  name: string;
  memberCount: number;
  active: number;
}

interface OrganizationSelectorProps {
  organizations: Organization[];
  selectedOrg: string;
  onOrgChange: (orgId: string) => void;
}

export const OrganizationSelector = ({ organizations, selectedOrg, onOrgChange }: OrganizationSelectorProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Organization</CardTitle>
      </CardHeader>
      <CardContent>
        <select
          value={selectedOrg}
          onChange={(e) => onOrgChange(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
        >
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name} ({org.memberCount} members)
            </option>
          ))}
        </select>
      </CardContent>
    </Card>
  );
};
