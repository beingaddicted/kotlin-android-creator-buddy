import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, QrCode, MapPin, Play, Square, User, Clock, Navigation, Hourglass, XCircle } from "lucide-react";
import { QRScannerComponent } from "./user/QRScanner";
import { UserRegistration } from "./user/UserRegistration";
import { QRData } from "@/services/QRService";
import { locationService, LocationData } from "@/services/LocationService";
import { webRTCService } from "@/services/WebRTCService";

interface UserInterfaceProps {
  onBack: () => void;
}

type UserState = 'initial' | 'scanning' | 'registering' | 'pending_approval' | 'join_denied' | 'registered' | 'tracking';

export const UserInterface = ({ onBack }: UserInterfaceProps) => {
  const [state, setState] = useState<UserState>('initial');
  const [qrData, setQrData] = useState<QRData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [registrationData, setRegistrationData] = useState<any>(null);
  const [locationHistory, setLocationHistory] = useState<LocationData[]>([]);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);

  useEffect(() => {
    // Check if user is already registered
    const stored = localStorage.getItem('userRegistration');
    if (stored) {
      const data = JSON.parse(stored);
      if (data.isApproved) {
        setRegistrationData(data);
        setState('registered');
      } else if (data.isPending) {
        setRegistrationData(data);
        setState('pending_approval');
      }
    }

    const handleAdminResponse = (event: any) => {
      const messageData = event.detail.data;
      if (messageData.type === 'join_response') {
        const regData = JSON.parse(localStorage.getItem('userRegistration') || '{}');
        if (messageData.status === 'approved') {
          regData.isApproved = true;
          regData.isPending = false;
          localStorage.setItem('userRegistration', JSON.stringify(regData));
          setRegistrationData(regData);
          setState('registered');
        } else {
          localStorage.removeItem('userRegistration');
          localStorage.removeItem('userId');
          setState('join_denied');
        }
      }
    };

    window.addEventListener('webrtc-location-updated', handleAdminResponse);

    // Check if location tracking is active
    setIsTracking(locationService.isCurrentlyTracking());
    
    // Load location history
    setLocationHistory(locationService.getStoredLocations());
    
    // Get current location
    loadCurrentLocation();
  }, []);

  const loadCurrentLocation = async () => {
    const location = await locationService.getCurrentLocation();
    setCurrentLocation(location);
  };

  const handleQRScanned = (scannedQRData: QRData) => {
    setQrData(scannedQRData);
    setState('registering');
  };

  const handleJoinRequest = (regData: any, qrData: QRData) => {
    const payload = {
      type: 'join_request',
      payload: {
        userData: regData,
        qrData: qrData,
      }
    };
    webRTCService.sendLocationUpdate(payload);
    
    const pendingRegData = { ...regData, isPending: true };
    localStorage.setItem('userRegistration', JSON.stringify(pendingRegData));
    setRegistrationData(pendingRegData);
    setState('pending_approval');
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
      
      // Update location history periodically
      const interval = setInterval(() => {
        setLocationHistory(locationService.getStoredLocations());
        loadCurrentLocation();
      }, 30000); // Update every 30 seconds

      // Store interval ID for cleanup
      localStorage.setItem('locationUpdateInterval', interval.toString());
    } catch (error) {
      console.error('Failed to start location tracking:', error);
      alert('Failed to start location tracking. Please check permissions.');
    }
  };

  const stopLocationTracking = async () => {
    await locationService.stopTracking();
    await locationService.notifyLocationServiceStopped();
    setIsTracking(false);
    setState('registered');
    
    // Clear location update interval
    const intervalId = localStorage.getItem('locationUpdateInterval');
    if (intervalId) {
      clearInterval(parseInt(intervalId));
      localStorage.removeItem('locationUpdateInterval');
    }
  };

  const clearUserData = () => {
    localStorage.removeItem('userRegistration');
    localStorage.removeItem('userId');
    localStorage.removeItem('locationHistory');
    setRegistrationData(null);
    setLocationHistory([]);
    setState('initial');
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
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
            onJoinRequest={handleJoinRequest}
            onBack={() => setState('initial')}
          />
        ) : null;
      
      case 'pending_approval':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Hourglass className="w-5 h-5 mr-2 text-yellow-500" />
                Request Sent
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-gray-600">
                Your request to join "{registrationData?.organizationName}" has been sent.
              </p>
              <p className="font-semibold">Waiting for admin approval...</p>
              <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
                You can close this window. You will be automatically joined once the admin approves your request.
              </div>
            </CardContent>
          </Card>
        );

      case 'join_denied':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <XCircle className="w-5 h-5 mr-2 text-red-500" />
                Request Denied
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-gray-600">
                Your request to join the organization was denied by the administrator.
              </p>
              <Button onClick={() => setState('initial')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </CardContent>
          </Card>
        );

      case 'registered':
      case 'tracking':
        return (
          <div className="space-y-6">
            {/* Main Status Card */}
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
                      <h3 className="font-semibold text-blue-900 flex items-center">
                        <User className="w-4 h-4 mr-2" />
                        {registrationData.organizationName}
                      </h3>
                      <p className="text-sm text-blue-700">Registered as: {registrationData.name}</p>
                      <p className="text-sm text-blue-600">Member since: {formatTimestamp(registrationData.registeredAt)}</p>
                    </div>
                  )}

                  {isTracking ? (
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-green-800 font-semibold flex items-center">
                            <Navigation className="w-4 h-4 mr-1" />
                            Location tracking active
                          </p>
                          <p className="text-sm text-green-700">Your location is being shared with the admin</p>
                          {currentLocation && (
                            <p className="text-xs text-green-600 mt-1">
                              Last update: {formatTimestamp(currentLocation.timestamp)}
                            </p>
                          )}
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
                      <p className="text-sm text-yellow-800 mb-3 flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        Location sharing is not active
                      </p>
                      <Button onClick={startLocationTracking} className="w-full">
                        <Play className="w-4 h-4 mr-2" />
                        Start Location Sharing
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Current Location Card */}
            {currentLocation && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Navigation className="w-5 h-5 mr-2" />
                    Current Location
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Latitude:</span>
                      <span className="font-mono">{currentLocation.latitude.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Longitude:</span>
                      <span className="font-mono">{currentLocation.longitude.toFixed(6)}</span>
                    </div>
                    {currentLocation.accuracy && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Accuracy:</span>
                        <span>{Math.round(currentLocation.accuracy)}m</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last Updated:</span>
                      <span>{formatTimestamp(currentLocation.timestamp)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Location History Card */}
            {locationHistory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Clock className="w-5 h-5 mr-2" />
                    Recent Locations ({locationHistory.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {locationHistory.slice(-5).reverse().map((location) => (
                      <div key={location.id} className="bg-gray-50 p-3 rounded text-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-mono text-xs">
                              {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                            </p>
                            {location.accuracy && (
                              <p className="text-gray-500 text-xs">±{Math.round(location.accuracy)}m</p>
                            )}
                          </div>
                          <span className="text-gray-500 text-xs">
                            {formatTimestamp(location.timestamp)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Info and Actions Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-900 mb-2">Background Tracking</h4>
                    <p className="text-sm text-gray-600">
                      This app will continue tracking your location even when minimized. 
                      If tracking stops, you'll receive a notification to reopen the app.
                    </p>
                  </div>
                  
                  <div className="pt-2 border-t">
                    <Button 
                      variant="outline" 
                      onClick={clearUserData}
                      className="w-full text-red-600 border-red-300 hover:bg-red-50"
                    >
                      Leave Organization
                    </Button>
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
                <CardTitle>Join Organization</CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <p className="text-gray-600">
                  Scan the QR code provided by your organization admin to join and start sharing your location
                </p>
                <Button className="w-full" onClick={() => setState('scanning')}>
                  <QrCode className="w-4 h-4 mr-2" />
                  Scan QR Code
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-3">
                  <h3 className="font-semibold text-gray-900">How it works</h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>1. Scan the QR code from your admin</p>
                    <p>2. Register with your details</p>
                    <p>3. Start sharing your location</p>
                    <p>4. Your admin can track your location in real-time</p>
                  </div>
                </div>
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
                {state === 'tracking' ? 'Location sharing active' : 
                 state === 'registered' ? 'Ready to share location' :
                 'Join organization tracking'}
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
