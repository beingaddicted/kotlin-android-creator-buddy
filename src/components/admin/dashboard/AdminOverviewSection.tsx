
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, MapPin, CreditCard } from "lucide-react";
import { JoinRequests, JoinRequest } from "../JoinRequests";
import { useEffect } from "react";

interface Organization {
  id: string;
  name: string;
  memberCount: number;
  active: number;
}

interface AdminOverviewSectionProps {
  organizations: Organization[];
  joinRequests: JoinRequest[];
  onApproval: (request: JoinRequest, approved: boolean) => void;
}

export const AdminOverviewSection = ({ 
  organizations, 
  joinRequests, 
  onApproval 
}: AdminOverviewSectionProps) => {
  const totalMembers = organizations.reduce((sum, org) => sum + org.memberCount, 0);
  const totalActive = organizations.reduce((sum, org) => sum + org.active, 0);
  const monthlyCost = ((totalMembers * 10) / 100).toFixed(2);

  useEffect(() => {
    const handleCancelJoinRequest = (event: CustomEvent) => {
      const { userId, organizationId, inviteCode } = event.detail;
      
      console.log('Admin received join request cancellation:', { userId, organizationId, inviteCode });
      
      // Dispatch an event for the parent component to handle removal from joinRequests
      const cancelEvent = new CustomEvent('admin-handle-cancel-request', {
        detail: { userId, organizationId, inviteCode }
      });
      window.dispatchEvent(cancelEvent);
    };

    const handleAdminCancelRequest = (event: CustomEvent) => {
      const { userId, organizationId, inviteCode } = event.detail;
      
      console.log('Admin handling cancel request:', { userId, organizationId, inviteCode });
      
      // Find and remove the cancelled request by invite code
      const requestToRemove = joinRequests.find(req => 
        req.qrData.inviteCode === inviteCode || 
        (req.qrData.organizationId === organizationId && req.peerId === userId)
      );
      
      if (requestToRemove) {
        // Call onApproval with a special "cancelled" status to remove it
        onApproval(requestToRemove, false);
        console.log('Removed cancelled join request from admin dashboard');
      }
    };

    // Listen for join request cancellations
    window.addEventListener('webrtc-cancel-join-request', handleCancelJoinRequest as EventListener);
    window.addEventListener('admin-handle-cancel-request', handleAdminCancelRequest as EventListener);

    return () => {
      window.removeEventListener('webrtc-cancel-join-request', handleCancelJoinRequest as EventListener);
      window.removeEventListener('admin-handle-cancel-request', handleAdminCancelRequest as EventListener);
    };
  }, [joinRequests, onApproval]);

  return (
    <div className="space-y-6">
      <JoinRequests joinRequests={joinRequests} onApproval={onApproval} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{organizations.length}</div>
            <p className="text-xs text-muted-foreground">Active tracking groups</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMembers}</div>
            <p className="text-xs text-muted-foreground">Registered users</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Now</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalActive}</div>
            <p className="text-xs text-muted-foreground">Currently trackable</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Cost</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">${monthlyCost}</div>
            <p className="text-xs text-muted-foreground">$0.10 per member</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
