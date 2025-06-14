import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, QrCode, Users, Building2, MapPin, Check, X, UserPlus } from "lucide-react";
import { OrganizationManager } from "./admin/OrganizationManager";
import { QRGenerator } from "./admin/QRGenerator";
import { MemberTracker } from "./admin/MemberTracker";
import { webRTCService } from "@/services/WebRTCService";
import { toast } from "sonner";

interface AdminDashboardProps {
  onBack: () => void;
}

interface JoinRequest {
  peerId: string;
  userData: any;
  qrData: any;
}

export const AdminDashboard = ({ onBack }: AdminDashboardProps) => {
  const [activeSection, setActiveSection] = useState<'overview' | 'organizations' | 'qr' | 'tracking'>('overview');
  const [organizations] = useState([
    { id: '1', name: 'Sales Team', memberCount: 12, active: 8 },
    { id: '2', name: 'Field Operations', memberCount: 25, active: 20 },
    { id: '3', name: 'Delivery Crew', memberCount: 8, active: 6 }
  ]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);

  useEffect(() => {
    // Load pending invites from local storage to re-populate UI on refresh
    const pendingInvites = JSON.parse(localStorage.getItem('pendingInvites') || '[]');
    // This is just for display logic, real requests come over WebRTC
    
    const handleJoinRequest = (event: any) => {
      const { peerId, data } = event.detail;
      if (data.type === 'join_request') {
        const { payload } = data;
        
        // Validate invite code
        const pendingInvites = JSON.parse(localStorage.getItem('pendingInvites') || '[]');
        const inviteIndex = pendingInvites.findIndex((i: any) => i.inviteCode === payload.qrData.inviteCode);

        if (inviteIndex > -1) {
          toast.info(`New join request from ${payload.userData.name} for ${payload.qrData.organizationName}`);
          setJoinRequests(prev => [...prev, { peerId, ...payload }]);
        } else {
          console.warn("Received join request with invalid or used invite code:", payload.qrData.inviteCode);
        }
      }
    };

    window.addEventListener('webrtc-location-updated', handleJoinRequest);

    return () => {
      window.removeEventListener('webrtc-location-updated', handleJoinRequest);
    };
  }, []);

  const handleApproval = (request: JoinRequest, approved: boolean) => {
    // Send response back to user
    const response = {
      type: 'join_response',
      status: approved ? 'approved' : 'denied'
    };
    if (webRTCService.serverManager?.connectionManager) {
      webRTCService.serverManager.connectionManager.sendToPeer(request.peerId, response);
    }

    // Remove invite code to make it one-time use
    const pendingInvites = JSON.parse(localStorage.getItem('pendingInvites') || '[]');
    const updatedInvites = pendingInvites.filter((i: any) => i.inviteCode !== request.qrData.inviteCode);
    localStorage.setItem('pendingInvites', JSON.stringify(updatedInvites));

    // Remove request from UI
    setJoinRequests(prev => prev.filter(r => r.qrData.inviteCode !== request.qrData.inviteCode));
    
    if (approved) {
      toast.success(`${request.userData.name} has been approved.`);
      // Here you would typically add the user to your member list
    } else {
      toast.error(`${request.userData.name} has been denied.`);
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
      default:
        return (
          <div className="space-y-6">
            {joinRequests.length > 0 && (
              <Card className="border-blue-500">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <UserPlus className="w-5 h-5 mr-2 text-blue-500" />
                    Pending Join Requests
                    <Badge variant="destructive" className="ml-2">{joinRequests.length}</Badge>
                  </CardTitle>
                  <CardDescription>
                    New users want to join your organizations. Approve or deny their requests.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {joinRequests.map(req => (
                    <div key={req.qrData.inviteCode} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-semibold">{req.userData.name} <span className="font-normal text-gray-600">(Age: {req.userData.age})</span></p>
                        <p className="text-sm text-gray-500">Wants to join: <strong>{req.qrData.organizationName}</strong></p>
                      </div>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => handleApproval(req, false)}>
                          <X className="w-4 h-4 mr-1" /> Deny
                        </Button>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApproval(req, true)}>
                          <Check className="w-4 h-4 mr-1" /> Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              { id: 'tracking', label: 'Live Tracking', icon: MapPin }
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
