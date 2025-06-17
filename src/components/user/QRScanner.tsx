import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, Camera, X, Shield, AlertTriangle } from "lucide-react";
import QrScanner from "qr-scanner";
import { qrService, QRData } from "@/services/QRService";
import { webRTCService } from "@/services/WebRTCService";
import { connectToSignalingServer, sendSignalingViaWebSocket } from "@/services/webrtc/SignalingService";
import { appConfig } from "@/config/appConfig";

interface QRScannerProps {
  onQRScanned: (qrData: QRData) => void;
  onClose: () => void;
  onJoinRequestSubmitted?: () => void;
}

interface SecureQRData extends QRData {
  encryptionHeader?: string;
  timestamp?: number;
  adminSignature?: string;
  securityLevel?: 'standard' | 'enhanced';
}

export const QRScannerComponent = ({ onQRScanned, onClose, onJoinRequestSubmitted }: QRScannerProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string>("");
  const [showUserForm, setShowUserForm] = useState(false);
  const [userName, setUserName] = useState("");
  const [userAge, setUserAge] = useState("");
  const [pendingQRData, setPendingQRData] = useState<SecureQRData | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);

  useEffect(() => {
    // Register client with signaling server
    const clientId = localStorage.getItem('clientId') || 'client-' + Date.now();
    localStorage.setItem('clientId', clientId);
    connectToSignalingServer(appConfig.SIGNALING_SERVER_URL, (msg) => {
      console.log('[CLIENT] Received signaling message:', msg);
      if (msg.type === 'join_response') {
        console.log('[CLIENT] Received join response:', msg);
      }
      if (msg.type === 'offer') {
        console.log('[CLIENT] Received offer:', msg);
      }
      if (msg.type === 'answer') {
        console.log('[CLIENT] Received answer:', msg);
      }
      if (msg.type === 'ice-candidate') {
        console.log('[CLIENT] Received ICE candidate:', msg);
      }
    }, clientId);

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop();
        scannerRef.current.destroy();
      }
    };
  }, []);

  const startScanning = async () => {
    if (!videoRef.current) return;

    try {
      setError("");
      setIsScanning(true);

      const hasCamera = await QrScanner.hasCamera();
      if (!hasCamera) {
        throw new Error("No camera found on this device");
      }

      scannerRef.current = new QrScanner(
        videoRef.current,
        (result) => {
          console.log('QR Code detected:', result.data);
          handleQRResult(result.data);
        },
        {
          onDecodeError: (error) => {
            console.log('QR decode error:', error);
          },
          highlightScanRegion: true,
          highlightCodeOutline: true,
        }
      );

      await scannerRef.current.start();
    } catch (err) {
      console.error('Failed to start QR scanner:', err);
      setError(err instanceof Error ? err.message : 'Failed to access camera');
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const validateEncryptionHeader = (qrData: SecureQRData): boolean => {
    // Check if QR code has required security headers
    if (!qrData.encryptionHeader) {
      console.error('QR code missing encryption header');
      return false;
    }

    // Validate encryption header format (should be base64 encoded)
    const headerPattern = /^[A-Za-z0-9+/=]+$/;
    if (!headerPattern.test(qrData.encryptionHeader)) {
      console.error('Invalid encryption header format');
      return false;
    }

    // Check for admin signature for enhanced security
    if (qrData.securityLevel === 'enhanced' && !qrData.adminSignature) {
      console.error('Enhanced security QR code missing admin signature');
      return false;
    }

    return true;
  };

  const handleQRResult = async (qrString: string) => {
    try {
      console.log('Processing QR string:', qrString);
      
      // First try to parse as JSON
      let parsedData: SecureQRData;
      try {
        parsedData = JSON.parse(qrString);
      } catch (parseError) {
        console.error('QR data is not valid JSON:', parseError);
        setError("QR code does not contain valid data. Please scan an authorized organization invite QR code.");
        return;
      }

      console.log('Parsed QR data:', parsedData);

      // Check if it's an organization invite
      if (!parsedData.type || parsedData.type !== 'organization_invite') {
        console.error('QR code type mismatch. Expected: organization_invite, Got:', parsedData.type);
        setError("This QR code is not an organization invite. Please scan a valid organization QR code.");
        return;
      }

      // Validate required fields
      const requiredFields = ['organizationId', 'organizationName', 'adminId', 'inviteCode'];
      const missingFields = requiredFields.filter(field => !parsedData[field]);
      
      if (missingFields.length > 0) {
        console.error('QR code missing required fields:', missingFields);
        setError(`QR code is missing required information: ${missingFields.join(', ')}`);
        return;
      }

      // Security validation: Check encryption header
      if (!validateEncryptionHeader(parsedData)) {
        setError("QR code security validation failed. This QR code is not properly encrypted or signed.");
        return;
      }
      // Prompt for user details before sending join request
      setPendingQRData(parsedData);
      setShowUserForm(true);
    } catch (err) {
      console.error('QR parsing failed:', err);
      setError(err instanceof Error ? err.message : "Failed to read QR code. Please try again.");
    }
  };

  // Called when user submits their details
  const handleUserFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingQRData) return;
    setShowUserForm(false);
    // Build pending request object
    const pendingRequest = {
      userId: localStorage.getItem('clientId') || 'client',
      organizationId: pendingQRData.organizationId,
      organizationName: pendingQRData.organizationName,
      adminId: pendingQRData.adminId,
      inviteCode: pendingQRData.inviteCode,
      timestamp: Date.now(),
      userData: { name: userName, age: userAge }
    };
    // Save to localStorage
    const stored = localStorage.getItem('pendingJoinRequests');
    let requests = [];
    if (stored) {
      try { requests = JSON.parse(stored); } catch {}
    }
    // Only add if not already present
    if (!requests.some((r: any) => r.inviteCode === pendingRequest.inviteCode)) {
      requests.push(pendingRequest);
      localStorage.setItem('pendingJoinRequests', JSON.stringify(requests));
    }
    // Send join request to admin for validation via WebSocket signaling
    sendSignalingViaWebSocket({
      type: 'join_request',
      data: {
        userData: { name: userName, age: userAge },
        qrData: pendingQRData
      },
      fromPeerId: localStorage.getItem('clientId') || 'client',
      toPeerId: pendingQRData.adminId
    });
    setUserName("");
    setUserAge("");
    setPendingQRData(null);
    // Notify parent to switch to pending page
    if (typeof onJoinRequestSubmitted === 'function') {
      onJoinRequestSubmitted();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      await handleQRResult(result.data);
    } catch (error) {
      console.error('QR scan from file failed:', error);
      setError("Failed to scan QR code from image");
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center">
          <QrCode className="w-5 h-5 mr-2" />
          Scan Secure Organization QR Code
          <Shield className="w-4 h-4 ml-2 text-green-600" />
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showUserForm ? (
          <form onSubmit={handleUserFormSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={userName}
                onChange={e => setUserName(e.target.value)}
                required
                className="w-full border rounded px-3 py-2"
                placeholder="Enter your name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Age</label>
              <input
                type="number"
                value={userAge}
                onChange={e => setUserAge(e.target.value)}
                required
                min={1}
                className="w-full border rounded px-3 py-2"
                placeholder="Enter your age"
              />
            </div>
            <div className="flex space-x-2">
              <Button type="submit" className="flex-1">Submit</Button>
              <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowUserForm(false); setPendingQRData(null); }}>Cancel</Button>
            </div>
          </form>
        ) : !isScanning ? (
          <div className="space-y-4">
            <div className="w-full h-64 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <Camera className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">Position secure organization QR code within the camera view</p>
                <Button onClick={startScanning}>
                  <Camera className="w-4 h-4 mr-2" />
                  Start Camera
                </Button>
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-500 mb-2">Or upload an image</p>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="qr-upload"
              />
              <Button variant="outline" className="cursor-pointer" onClick={() => document.getElementById('qr-upload')?.click()}>
                Upload QR Image
              </Button>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="flex items-center text-blue-800">
                <Shield className="w-4 h-4 mr-2" />
                <span className="text-sm">Only scan encrypted QR codes from authorized admins</span>
              </div>
            </div>

            <div className="bg-yellow-50 p-3 rounded-lg">
              <div className="flex items-start text-yellow-800">
                <AlertTriangle className="w-4 h-4 mr-2 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Security Requirements:</p>
                  <ul className="mt-1 text-xs space-y-1">
                    <li>• QR must be generated by admin</li>
                    <li>• QR must have valid encryption header</li>
                    <li>• Invite code must not be expired</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <video
                ref={videoRef}
                className="w-full h-64 object-cover rounded-lg"
                playsInline
              />
              <div className="absolute inset-0 border-2 border-blue-500 rounded-lg">
                <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-blue-500"></div>
                <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-blue-500"></div>
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-blue-500"></div>
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-blue-500"></div>
              </div>
            </div>

            <div className="flex space-x-2">
              <Button variant="outline" onClick={stopScanning} className="flex-1">
                Stop Scanning
              </Button>
            </div>

            <p className="text-sm text-center text-gray-500">
              Point your camera at the secure organization QR code to scan
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600 font-medium">Security Error</p>
            <p className="text-sm text-red-600">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2" 
              onClick={() => setError("")}
            >
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
