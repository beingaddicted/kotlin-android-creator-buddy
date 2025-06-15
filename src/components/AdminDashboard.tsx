import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, QrCode, Users, Building2, MapPin, Check, X, UserPlus, CreditCard } from "lucide-react";
import { OrganizationManager } from "./admin/OrganizationManager";
import { QRGenerator } from "./admin/QRGenerator";
import { MemberTracker } from "./admin/MemberTracker";
import { BillingManager } from "./billing/BillingManager";
import { webRTCService } from "@/services/WebRTCService";
import { toast } from "sonner";
import { JoinRequests, JoinRequest } from "./admin/JoinRequests";

interface AdminDashboardProps {
  onBack: () => void;
}

export const AdminDashboard = ({ onBack }: AdminDashboardProps) => {
  const [activeSection, setActiveSection] = useState<'overview' | 'organizations' | 'qr' | 'tracking' | 'billing'>('overview');
  const [organizations] = useState([
    { id: '1', name: 'Sales Team', memberCount: 12, active: 8 },
    { id: '2', name: 'Field Operations', memberCount: 25, active: 20 },
    { id: '3', name: 'Delivery Crew', memberCount: 8, active: 6 }
  ]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);

  useEffect(() => {
    console.log('AdminDashboard: Setting up join request listeners');

    // Listen for incoming WebRTC messages
    const handleWebRTCMessage = (event: any) => {
      console.log('AdminDashboard: Received WebRTC message:', event.detail);
      const { message, fromPeerId } = event.detail;
      
      if (message.type === 'join_request') {
        console.log('AdminDashboard: Processing join request from:', fromPeerId);
        const { userData, qrData } = message.data;
        
        // Validate invite code exists in pending invites
        const pendingInvites = JSON.parse(localStorage.getItem('pendingInvites') || '[]');
        const inviteExists = pendingInvites.some((invite: any) => invite.inviteCode === qrData.inviteCode);
        
        if (inviteExists) {
          const newRequest: JoinRequest = {
            peerId: fromPeerId,
            userData,
            qrData
          };
          
          console.log('AdminDashboard: Adding join request:', newRequest);
          setJoinRequests(prev => {
            // Avoid duplicates
            const exists = prev.some(req => req.qrData.inviteCode === qrData.inviteCode);
            if (exists) return prev;
            return [...prev, newRequest];
          });
          
          toast.info(`New join request from ${userData.name} for ${qrData.organizationName}`);
        } else {
          console.warn('AdminDashboard: Invalid invite code:', qrData.inviteCode);
          // Send rejection back to user
          webRTCService.sendToPeer(fromPeerId, {
            type: 'join_response',
            status: 'denied',
            reason: 'Invalid or expired invite code'
          });
        }
      }
    };

    // Listen for location updates that might contain join requests
    const handleLocationUpdate = (event: any) => {
      console.log('AdminDashboard: Location update event:', event.detail);
      const { peerId, data } = event.detail;
      
      // Check if this is actually a join request disguised as location update
      if (data && data.type === 'join_request') {
        console.log('AdminDashboard: Found join request in location update');
        handleWebRTCMessage({ detail: { message: data, fromPeerId: peerId } });
      }
    };

    // Listen for direct join request events
    const handleJoinRequestEvent = (event: any) => {
      console.log('AdminDashboard: Direct join request event:', event.detail);
      const { peerId, userData, qrData } = event.detail;
      
      if (userData && qrData) {
        handleWebRTCMessage({ 
          detail: { 
            message: { type: 'join_request', data: { userData, qrData } }, 
            fromPeerId: peerId 
          } 
        });
      }
    };

    // Add multiple event listeners to catch join requests
    window.addEventListener('webrtc-message-received', handleWebRTCMessage);
    window.addEventListener('webrtc-location-updated', handleLocationUpdate);
    window.addEventListener('webrtc-join-request', handleJoinRequestEvent);

    // Check for any existing pending requests on component mount
    const checkExistingRequests = () => {
      const pendingInvites = JSON.parse(localStorage.getItem('pendingInvites') || '[]');
      console.log('AdminDashboard: Checking existing pending invites:', pendingInvites);
    };

    checkExistingRequests();

    return () => {
      window.removeEventListener('webrtc-message-received', handleWebRTCMessage);
      window.removeEventListener('webrtc-location-updated', handleLocationUpdate);
      window.removeEventListener('webrtc-join-request', handleJoinRequestEvent);
    };
  }, []);

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
      // Here you would typically add the user to your member list
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
          <div className="space-y-6">
            <JoinRequests joinRequests={joinRequests} onApproval={handleApproval} />

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
                  <div className="text-2xl font-bold">
                    {organizations.reduce((sum, org) => sum + org.memberCount, 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">Registered users</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Now</CardTitle>
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {organizations.reduce((sum, org) => sum + org.active, 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">Currently trackable</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Monthly Cost</CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    ${((organizations.reduce((sum, org) => sum + org.memberCount, 0) * 10) / 100).toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground">$0.10 per member</p>
                </CardContent>
              </Card>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-sm text-gray-500">Manage your location tracking system</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              System Online
            </Badge>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: Building2 },
              { id: 'organizations', label: 'Organizations', icon: Building2 },
              { id: 'qr', label: 'QR Generator', icon: QrCode },
              { id: 'tracking', label: 'Live Tracking', icon: MapPin },
              { id: 'billing', label: 'Billing', icon: CreditCard }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id as any)}
                className={`relative flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeSection === item.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
                {item.id === 'overview' && joinRequests.length > 0 && (
                  <Badge variant="destructive" className="absolute -top-1 -right-2 px-1.5 py-0.5 text-xs">
                    {joinRequests.length}
                  </Badge>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </div>
    </div>
  );
};
