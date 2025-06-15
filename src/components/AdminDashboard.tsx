
import { useState } from "react";
import { OrganizationManager } from "./admin/OrganizationManager";
import { QRGenerator } from "./admin/QRGenerator";
import { MemberTracker } from "./admin/MemberTracker";
import { BillingManager } from "./admin/BillingManager";
import { webRTCService } from "@/services/WebRTCService";
import { toast } from "sonner";
import { JoinRequest } from "./admin/JoinRequests";
import { AdminDashboardHeader } from "./admin/dashboard/AdminDashboardHeader";
import { AdminDashboardNavigation } from "./admin/dashboard/AdminDashboardNavigation";
import { AdminOverviewSection } from "./admin/dashboard/AdminOverviewSection";
import { useAdminDashboardEvents } from "@/hooks/useAdminDashboardEvents";

interface AdminDashboardProps {
  onBack: () => void;
}

type ActiveSection = 'overview' | 'organizations' | 'qr' | 'tracking' | 'billing';

export const AdminDashboard = ({ onBack }: AdminDashboardProps) => {
  const [activeSection, setActiveSection] = useState<ActiveSection>('overview');
  const [organizations] = useState([
    { id: '1', name: 'Sales Team', memberCount: 12, active: 8 },
    { id: '2', name: 'Field Operations', memberCount: 25, active: 20 },
    { id: '3', name: 'Delivery Crew', memberCount: 8, active: 6 }
  ]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);

  // Handle new join requests
  const handleNewJoinRequest = (request: JoinRequest) => {
    setJoinRequests(prev => {
      // Avoid duplicates
      const exists = prev.some(req => req.qrData.inviteCode === request.qrData.inviteCode);
      if (exists) return prev;
      return [...prev, request];
    });
  };

  // Use the custom hook for event handling
  useAdminDashboardEvents({ onJoinRequest: handleNewJoinRequest });

  const handleApproval = (request: JoinRequest, approved: boolean) => {
    console.log('AdminDashboard: Processing approval:', { request, approved });
    
    // Send response back to user
    const response = {
      type: 'join_response',
      status: approved ? 'approved' : 'denied',
      organizationId: request.qrData.organizationId,
      organizationName: request.qrData.organizationName
    };
    
    console.log('AdminDashboard: Sending response to peer:', request.peerId, response);
    webRTCService.sendToPeer(request.peerId, response);

    // Remove invite code to make it one-time use
    const pendingInvites = JSON.parse(localStorage.getItem('pendingInvites') || '[]');
    const updatedInvites = pendingInvites.filter((i: any) => i.inviteCode !== request.qrData.inviteCode);
    localStorage.setItem('pendingInvites', JSON.stringify(updatedInvites));

    // Remove request from UI
    setJoinRequests(prev => prev.filter(r => r.qrData.inviteCode !== request.qrData.inviteCode));
    
    if (approved) {
      toast.success(`${request.userData.name} has been approved to join ${request.qrData.organizationName}.`);
    } else {
      toast.error(`${request.userData.name} has been denied access to ${request.qrData.organizationName}.`);
    }
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'organizations':
        return <OrganizationManager organizations={organizations} />;
      case 'qr':
        return <QRGenerator organizations={organizations} />;
      case 'tracking':
        return <MemberTracker organizations={organizations} />;
      case 'billing':
        return <BillingManager organizations={organizations} />;
      default:
        return (
          <AdminOverviewSection 
            organizations={organizations}
            joinRequests={joinRequests}
            onApproval={handleApproval}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminDashboardHeader onBack={onBack} />
      
      <AdminDashboardNavigation 
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        joinRequestsCount={joinRequests.length}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </div>
    </div>
  );
};
