import { useEffect, useState } from "react";
import { getOrganizations, addOrganization, deleteOrganization, Organization as PersistentOrg } from "@/lib/localDb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Settings, Trash2 } from "lucide-react";

interface OrganizationManagerProps {
  organizations: Organization[];
  onOrganizationsChange: (organizations: Organization[]) => void;
}

export const OrganizationManager = ({ organizations: _initialOrgs, onOrganizationsChange }: OrganizationManagerProps) => {
  const [organizations, setOrganizations] = useState<PersistentOrg[]>([]);
  const [newOrgName, setNewOrgName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Load organizations from persistent DB on mount
  useEffect(() => {
    getOrganizations().then(setOrganizations);
  }, []);

  // Notify parent only when organizations are added or deleted
  const addOrg = async () => {
    if (newOrgName.trim()) {
      const newOrg: PersistentOrg = {
        id: Date.now().toString(),
        name: newOrgName.trim(),
        members: []
      };
      await addOrganization(newOrg);
      const updated = await getOrganizations();
      setOrganizations(updated);
      onOrganizationsChange(updated.map(org => ({
        id: org.id,
        name: org.name,
        memberCount: org.members ? org.members.length : 0,
        active: 0
      })));
      setNewOrgName("");
      setShowAddForm(false);
    }
  };

  const deleteOrg = async (id: string) => {
    await deleteOrganization(id);
    const updated = await getOrganizations();
    setOrganizations(updated);
    onOrganizationsChange(updated.map(org => ({
      id: org.id,
      name: org.name,
      memberCount: org.members ? org.members.length : 0,
      active: 0
    })));
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
              onKeyDown={(e) => e.key === 'Enter' && addOrg()}
            />
            <div className="flex space-x-2">
              <Button onClick={addOrg}>Create</Button>
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
                      <span className="text-sm text-gray-500">{org.members?.length || 0} members</span>
                      <Badge variant={org.members && org.members.length > 0 ? "default" : "secondary"}>
                        {org.members?.length || 0} active
                      </Badge>
                    </div>
                    {/* List members with roles */}
                    {org.members && org.members.length > 0 && (
                      <ul className="mt-2 text-xs text-gray-700">
                        {org.members.map(m => (
                          <li key={m.id}>
                            {m.name} (age: {m.age}) - <span className="font-semibold">{m.role}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm">
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => deleteOrg(org.id)}>
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
