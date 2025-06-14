
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, QrCode, MapPin, Play, Square } from "lucide-react";
import { QRScannerComponent } from "./user/QRScanner";
import { UserRegistration } from "./user/UserRegistration";
import { QRData } from "@/services/QRService";
import { locationService } from "@/services/LocationService";

interface UserInterfaceProps {
  onBack: () => void;
}

type UserState = 'initial' | 'scanning' | 'registering' | 'registered' | 'tracking';

export const UserInterface = ({ onBack }: UserInterfaceProps) => {
  const [state, setState] = useState<UserState>('initial');
  const [qrData, setQrData] = useState<QRData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [registrationData, setRegistrationData] = useState<any>(null);

  useEffect(() => {
    // Check if user is already registered
    const stored = localStorage.getItem('userRegistration');
    if (stored) {
      const data = JSON.parse(stored);
      setRegistrationData(data);
      setState('registered');
    }

    // Check if location tracking is active
    setIsTracking(locationService.isCurrentlyTracking());
  }, []);

  const handleQRScanned = (scannedQRData: QRData) => {
    setQrData(scannedQRData);
    setState('registering');
  };

  const handleRegistrationComplete = (userData: any) => {
    setState('registered');
    // Reload registration data
    const stored = localStorage.getItem('userRegistration');
    if (stored) {
      setRegistrationData(JSON.parse(stored));
    }
  };

  const startLocationTracking = async () => {
    try {
      const userId = localStorage.getItem('userId');
      const organizationId = registrationData?.organizationId;
      
      if (!userId || !organizationId) {
        alert('Registration data not found');
        return;
      }

      await locationService.startTracking(userId, organizationId);
      setIsTracking(true);
      setState('tracking');
    } catch (error) {
      console.error('Failed to start location tracking:', error);
      alert('Failed to start location tracking. Please check permissions.');
    }
  };

  const stopLocationTracking = async () => {
    await locationService.stopTracking();
    setIsTracking(false);
    setState('registered');
  };

  const renderContent = () => {
    switch (state) {
      case 'scanning':
        return (
          <QRScannerComponent
            onQRScanned={handleQRScanned}
            onClose={() => setState('initial')}
          />
        );

      case 'registering':
        return qrData ? (
          <UserRegistration
            qrData={qrData}
            onRegistrationComplete={handleRegistrationComplete}
            onBack={() => setState('initial')}
          />
        ) : null;

      case 'registered':
      case 'tracking':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-green-600" />
                  {isTracking ? 'Location Sharing Active' : 'Ready to Share Location'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {registrationData && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-blue-900">{registrationData.organizationName}</h3>
                      <p className="text-sm text-blue-700">Registered as: {registrationData.name}</p>
                    </div>
                  )}

                  {isTracking ? (
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-green-800 font-semibold">✓ Location tracking active</p>
                          <p className="text-sm text-green-700">Your location is being shared with the admin</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={stopLocationTracking}
                          className="text-red-600 border-red-300 hover:bg-red-50"
                        >
                          <Square className="w-4 h-4 mr-1" />
                          Stop
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <p className="text-sm text-yellow-800 mb-3">Location sharing is not active</p>
                      <Button onClick={startLocationTracking} className="w-full">
                        <Play className="w-4 h-4 mr-2" />
                        Start Location Sharing
                      </Button>
                    </div>
                  )}

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-900 mb-2">Background Tracking</h4>
                    <p className="text-sm text-gray-600">
                      This app will continue tracking your location even when minimized. 
                      If tracking stops, you'll receive a notification to reopen the app.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <QrCode className="w-8 h-8 text-green-600" />
                </div>
                <CardTitle>Scan QR Code</CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <p className="text-gray-600">Scan the QR code provided by your admin to join an organization</p>
                <Button className="w-full" onClick={() => setState('scanning')}>
                  <QrCode className="w-4 h-4 mr-2" />
                  Open QR Scanner
                </Button>
              </CardContent>
            </Card>

            <div className="text-center">
              <p className="text-sm text-gray-500">
                Don't have a QR code? Contact your organization admin.
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Member Portal</h1>
              <p className="text-sm text-gray-500">
                {state === 'tracking' ? 'Location sharing active' : 'Join organization tracking'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto px-4 py-8">
        {renderContent()}
      </div>
    </div>
  );
};
