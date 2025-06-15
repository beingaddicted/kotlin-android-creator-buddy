
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminDashboard } from "@/components/AdminDashboard";
import { UserInterface } from "@/components/UserInterface";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";
import { Shield, Users } from "lucide-react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const [mode, setMode] = useState<'select' | 'admin' | 'user'>('select');
  const { user, loading, signOut } = useSupabaseAuth();
  const navigate = useNavigate();

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, show login prompt
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">LocationSync</h1>
            <p className="text-gray-600 mb-6">Decentralized Location Tracking</p>
            <p className="text-gray-800 mb-6">Please log in to access the application</p>
            
            <Button 
              onClick={() => navigate("/auth")}
              className="w-full"
            >
              Login / Sign Up
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show admin or user interface if selected
  if (mode === 'admin') {
    return <AdminDashboard onBack={() => setMode('select')} />;
  }

  if (mode === 'user') {
    return <UserInterface onBack={() => setMode('select')} />;
  }

  // Show mode selection for authenticated users
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <EmailVerificationBanner />
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">LocationSync</h1>
          <p className="text-gray-600">Decentralized Location Tracking</p>

          <div className="flex flex-col items-center my-3 space-y-2">
            <div className="text-green-700 font-medium">Welcome, {user.email}</div>
            <button
              className="text-blue-800 text-sm underline underline-offset-2"
              onClick={() => signOut()}
            >
              Log out
            </button>
          </div>
        </div>
        
        <div className="space-y-4">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setMode('admin')}>
            <CardHeader className="text-center pb-3">
              <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <CardTitle className="text-xl">Admin Dashboard</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 mb-4">Manage organizations, generate QR codes, and track members</p>
              <Button className="w-full">Access Admin Panel</Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setMode('user')}>
            <CardHeader className="text-center pb-3">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <CardTitle className="text-xl">Member Access</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 mb-4">Scan QR code and join organization tracking</p>
              <Button variant="outline" className="w-full">Join as Member</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
