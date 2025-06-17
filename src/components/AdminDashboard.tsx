import { useState, useEffect, useRef } from "react";
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
import { getOrganizations, addOrganization, updateOrganization, addMemberToOrganization, Organization as PersistentOrg, Member as PersistentMember } from "@/lib/localDb";

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
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);

  // Load organizations and join requests on mount
  useEffect(() => {
    console.log('AdminDashboard: Loading stored data...');
    
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

  // Remove dummy organizations, load from persistent DB
  useEffect(() => {
    getOrganizations().then((orgs) => {
      setOrganizations(orgs.length ? orgs : []);
    });
  }, []);

  // When admin creates a new org, persist it
  const handleOrganizationsChange = async (newOrganizations: Organization[]) => {
    setOrganizations(newOrganizations);
    // Persist all organizations
    for (const org of newOrganizations) {
      await addOrganization({ ...org, members: [] });
    }
  };

  // Handle new join requests
  const handleNewJoinRequest = (request: JoinRequest) => {
    console.log('AdminDashboard: Handling new join request:', request);
    setJoinRequests(prev => {
      // Defensive: always check for inviteCode presence
      const alreadyExists = prev.some(req => req.qrData.inviteCode === request.qrData.inviteCode);
      if (!alreadyExists) {
        const updated = [...prev, request];
        console.log('AdminDashboard: Added join request. New list:', updated.map(r => r.qrData.inviteCode));
        return updated;
      } else {
        console.log('AdminDashboard: Join request already exists, skipping:', request.qrData.inviteCode);
        return prev;
      }
    });
  };

  // Use the custom hook for event handling (must be unconditional)
  useAdminDashboardEvents({ onJoinRequest: handleNewJoinRequest });

  // When admin approves a join, add member to org in persistent DB
  const handleApproval = async (request: JoinRequest, approved: boolean) => {
    setJoinRequests(prev => {
      const exists = prev.some(r => r.qrData.inviteCode === request.qrData.inviteCode);
      if (!exists) return prev;
      const updated = prev.filter(r => r.qrData.inviteCode !== request.qrData.inviteCode);
      return updated;
    });

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

    if (approved) {
      // Add member to org in persistent DB
      const member: PersistentMember = {
        id: request.peerId,
        name: request.userData.name,
        age: request.userData.age,
        role: 'member',
        connectionInfo: {},
      };
      const org = await getOrganizations().then(orgs => orgs.find(o => o.id === request.qrData.organizationId));
      if (org) {
        await addMemberToOrganization(org.id, member);
      }
      toast.success(`${request.userData.name} has been approved to join ${request.qrData.organizationName}.`);
    } else {
      toast.error(`${request.userData.name} has been denied access to ${request.qrData.organizationName}.`);
    }
  };

  // Load join requests on mount, but filter out any that have already been accepted/denied
  useEffect(() => {
    const storedRequests = localStorage.getItem('adminJoinRequests');
    let requests: JoinRequest[] = [];
    if (storedRequests) {
      try {
        requests = JSON.parse(storedRequests);
      } catch (error) {
        console.warn('Failed to parse stored join requests:', error);
      }
    }
    // Remove requests whose inviteCode is not in pendingInvites
    const pendingInvites = JSON.parse(localStorage.getItem('pendingInvites') || '[]');
    const pendingInviteCodes = new Set(pendingInvites.map((i: { inviteCode: string }) => i.inviteCode));
    const filtered = requests.filter(r => pendingInviteCodes.has(r.qrData.inviteCode));
    setJoinRequests(filtered);
  }, []);

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

  // Add debug log to confirm joinRequests at render time
  console.log('AdminDashboard: Rendering with joinRequests:', joinRequests);

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
