
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminDashboard } from "@/components/AdminDashboard";
import { UserInterface } from "@/components/UserInterface";
import { Shield, Users } from "lucide-react";

const Index = () => {
  const [mode, setMode] = useState<'select' | 'admin' | 'user'>('select');

  if (mode === 'admin') {
    return <AdminDashboard onBack={() => setMode('select')} />;
  }

  if (mode === 'user') {
    return <UserInterface onBack={() => setMode('select')} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">LocationSync</h1>
          <p className="text-gray-600">Decentralized Location Tracking</p>
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
