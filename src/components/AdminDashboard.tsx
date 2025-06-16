
import { useState, useEffect } from "react";
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

interface Organization {
  id: string;
  name: string;
  memberCount: number;
  active: number;
}

export const AdminDashboard = ({ onBack }: AdminDashboardProps) => {
  const [activeSection, setActiveSection] = useState<ActiveSection>('overview');
  const [organizations, setOrganizations] = useState<Organization[]>([
    { id: '1', name: 'Sales Team', memberCount: 12, active: 8 },
    { id: '2', name: 'Field Operations', memberCount: 25, active: 20 },
    { id: '3', name: 'Delivery Crew', memberCount: 8, active: 6 }
  ]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);

  // Load organizations and join requests on mount
  useEffect(() => {
    console.log('AdminDashboard: Loading stored data...');
    
    const storedOrgs = localStorage.getItem('adminOrganizations');
    if (storedOrgs) {
      try {
        const parsedOrgs = JSON.parse(storedOrgs);
        console.log('AdminDashboard: Loaded organizations:', parsedOrgs);
        setOrganizations(parsedOrgs);
      } catch (error) {
        console.warn('Failed to parse stored organizations:', error);
      }
    }

    const storedRequests = localStorage.getItem('adminJoinRequests');
    if (storedRequests) {
      try {
        const parsedRequests = JSON.parse(storedRequests);
        console.log('AdminDashboard: Loaded join requests:', parsedRequests);
        setJoinRequests(parsedRequests);
      } catch (error) {
        console.warn('Failed to parse stored join requests:', error);
      }
    }

    // Also check for pending user requests
    const userRequests = localStorage.getItem('pendingJoinRequests');
    if (userRequests) {
      try {
        const parsedUserRequests = JSON.parse(userRequests);
        console.log('AdminDashboard: Found user pending requests:', parsedUserRequests);
        
        // Convert user requests to admin join requests format
        const convertedRequests = parsedUserRequests.map((req: any) => ({
          peerId: req.userId,
          userData: {
            name: req.userData.name,
            age: req.userData.age,
            phone: req.userData.phone,
            email: req.userData.email,
          },
          qrData: {
            organizationId: req.organizationId,
            organizationName: req.organizationName,
            inviteCode: req.inviteCode,
            adminId: req.adminId
          }
        }));
        
        setJoinRequests(prev => {
          const combined = [...prev, ...convertedRequests];
          // Remove duplicates based on invite code
          const unique = combined.filter((req, index, self) => 
            index === self.findIndex(r => r.qrData.inviteCode === req.qrData.inviteCode)
          );
          console.log('AdminDashboard: Combined unique requests:', unique);
          return unique;
        });
      } catch (error) {
        console.warn('Failed to parse user pending requests:', error);
      }
    }
  }, []);

  // Save join requests whenever they change
  useEffect(() => {
    if (joinRequests.length > 0) {
      console.log('AdminDashboard: Saving join requests:', joinRequests);
      localStorage.setItem('adminJoinRequests', JSON.stringify(joinRequests));
    }
  }, [joinRequests]);

  // Handle new join requests
  const handleNewJoinRequest = (request: JoinRequest) => {
    console.log('AdminDashboard: Handling new join request:', request);
    setJoinRequests(prev => {
      // Avoid duplicates
      const exists = prev.some(req => req.qrData.inviteCode === request.qrData.inviteCode);
      if (exists) {
        console.log('AdminDashboard: Request already exists, skipping');
        return prev;
      }
      const updated = [...prev, request];
      console.log('AdminDashboard: Updated join requests:', updated);
      return updated;
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

    // Remove from user's pending requests as well
    const userRequests = JSON.parse(localStorage.getItem('pendingJoinRequests') || '[]');
    const updatedUserRequests = userRequests.filter((req: any) => req.inviteCode !== request.qrData.inviteCode);
    localStorage.setItem('pendingJoinRequests', JSON.stringify(updatedUserRequests));

    // Remove request from UI
    setJoinRequests(prev => {
      const updated = prev.filter(r => r.qrData.inviteCode !== request.qrData.inviteCode);
      console.log('AdminDashboard: Removed request, updated list:', updated);
      return updated;
    });
    
    if (approved) {
      toast.success(`${request.userData.name} has been approved to join ${request.qrData.organizationName}.`);
    } else {
      toast.error(`${request.userData.name} has been denied access to ${request.qrData.organizationName}.`);
    }
  };

  const handleOrganizationsChange = (newOrganizations: Organization[]) => {
    console.log('AdminDashboard: Organizations changed:', newOrganizations);
    setOrganizations(newOrganizations);
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'organizations':
        return <OrganizationManager organizations={organizations} onOrganizationsChange={handleOrganizationsChange} />;
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

  console.log('AdminDashboard: Current join requests count:', joinRequests.length);

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
