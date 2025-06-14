
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Settings, Trash2 } from "lucide-react";

interface Organization {
  id: string;
  name: string;
  memberCount: number;
  active: number;
}

interface OrganizationManagerProps {
  organizations: Organization[];
}

export const OrganizationManager = ({ organizations: initialOrgs }: OrganizationManagerProps) => {
  const [organizations, setOrganizations] = useState(initialOrgs);
  const [newOrgName, setNewOrgName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const addOrganization = () => {
    if (newOrgName.trim()) {
      const newOrg: Organization = {
        id: Date.now().toString(),
        name: newOrgName.trim(),
        memberCount: 0,
        active: 0
      };
      setOrganizations([...organizations, newOrg]);
      setNewOrgName("");
      setShowAddForm(false);
    }
  };

  const deleteOrganization = (id: string) => {
    setOrganizations(organizations.filter(org => org.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Organizations</h2>
        <Button onClick={() => setShowAddForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Organization
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Organization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Organization name"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addOrganization()}
            />
            <div className="flex space-x-2">
              <Button onClick={addOrganization}>Create</Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {organizations.map((org) => (
          <Card key={org.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{org.name}</h3>
                    <div className="flex items-center space-x-4 mt-1">
                      <span className="text-sm text-gray-500">{org.memberCount} members</span>
                      <Badge variant={org.active > 0 ? "default" : "secondary"}>
                        {org.active} active
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm">
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => deleteOrganization(org.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {organizations.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No organizations</h3>
            <p className="text-gray-500 mb-4">Create your first organization to start tracking members.</p>
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Organization
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
