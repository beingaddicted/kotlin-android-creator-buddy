
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, MapPin, Clock, ArrowLeft } from "lucide-react";
import { QRScannerComponent } from "./user/QRScanner";
import { UserRegistration } from "./user/UserRegistration";
import { PendingRequestsManager } from "./user/PendingRequestsManager";
import { QRData } from "@/services/QRService";

interface UserInterfaceProps {
  onBack: () => void;
}

type UserMode = 'menu' | 'scanner' | 'registration' | 'tracking' | 'pending';

export const UserInterface = ({ onBack }: UserInterfaceProps) => {
  const [mode, setMode] = useState<UserMode>('menu');
  const [scannedQRData, setScannedQRData] = useState<QRData | null>(null);

  const handleQRScanned = (qrData: QRData) => {
    console.log('QR Data scanned:', qrData);
    setScannedQRData(qrData);
    setMode('registration');
  };

  const handleRegistrationComplete = () => {
    setMode('menu');
    setScannedQRData(null);
  };

  const handleScannerClose = () => {
    setMode('menu');
    setScannedQRData(null);
  };

  const renderContent = () => {
    switch (mode) {
      case 'scanner':
        return (
          <QRScannerComponent 
            onQRScanned={handleQRScanned}
            onClose={handleScannerClose}
          />
        );
      case 'registration':
        return scannedQRData ? (
          <UserRegistration 
            qrData={scannedQRData}
            onComplete={handleRegistrationComplete}
            onCancel={handleScannerClose}
          />
        ) : null;
      case 'pending':
        return <PendingRequestsManager onBack={() => setMode('menu')} />;
      case 'tracking':
        return (
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-4">
                  <Button variant="ghost" size="sm" onClick={() => setMode('menu')}>
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <CardTitle className="flex items-center">
                    <MapPin className="w-5 h-5 mr-2" />
                    Location Tracking
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <p className="text-green-900 font-medium">Tracking Active</p>
                  <p className="text-green-700 text-sm mt-1">
                    Your location is being shared with connected organizations.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      default:
        return (
          <div className="max-w-md mx-auto space-y-4">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Member Dashboard</h2>
              <p className="text-gray-600">Join organizations and manage your location sharing</p>
            </div>
            
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setMode('scanner')}>
              <CardHeader className="text-center pb-3">
                <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                  <QrCode className="w-6 h-6 text-blue-600" />
                </div>
                <CardTitle className="text-xl">Scan QR Code</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-gray-600 mb-4">Scan a QR code to join a new organization</p>
                <Button className="w-full">Start Scanning</Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setMode('pending')}>
              <CardHeader className="text-center pb-3">
                <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-3">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
                <CardTitle className="text-xl">Pending Requests</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-gray-600 mb-4">View and manage your pending join requests</p>
                <Button variant="outline" className="w-full">View Requests</Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setMode('tracking')}>
              <CardHeader className="text-center pb-3">
                <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                  <MapPin className="w-6 h-6 text-green-600" />
                </div>
                <CardTitle className="text-xl">Location Status</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-gray-600 mb-4">Check your current location sharing status</p>
                <Button variant="outline" className="w-full">View Status</Button>
              </CardContent>
            </Card>

            <div className="pt-4">
              <Button variant="ghost" onClick={onBack} className="w-full">
                Back to Main Menu
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      {renderContent()}
    </div>
  );
};
