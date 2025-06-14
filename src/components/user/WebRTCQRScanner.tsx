
import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, Camera, X, CheckCircle } from "lucide-react";
import QrScanner from "qr-scanner";
import { qrService } from "@/services/QRService";
import { webRTCService, WebRTCServerOffer } from "@/services/WebRTCService";

interface WebRTCQRScannerProps {
  onConnectionEstablished: (offerData: WebRTCServerOffer) => void;
  onClose: () => void;
}

export const WebRTCQRScanner = ({ onConnectionEstablished, onClose }: WebRTCQRScannerProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string>("");
  const [step, setStep] = useState<'scanning' | 'connecting' | 'connected'>('scanning');
  const [scannedOffer, setScannedOffer] = useState<WebRTCServerOffer | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);

  useEffect(() => {
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

  const handleQRResult = async (qrString: string) => {
    const qrData = qrService.parseQRData(qrString);
    
    if (qrData && 'type' in qrData && qrData.type === 'webrtc_server_offer') {
      const offerData = qrData as WebRTCServerOffer;
      stopScanning();
      setScannedOffer(offerData);
      await connectToServer(offerData);
    } else {
      setError("Invalid WebRTC server QR code. Please scan the server QR from admin.");
    }
  };

  const connectToServer = async (offerData: WebRTCServerOffer) => {
    try {
      setStep('connecting');
      
      // Get user data from localStorage or prompt
      const userRegistration = localStorage.getItem('userRegistration');
      let userId = localStorage.getItem('userId');
      let userName = 'Anonymous User';
      
      if (userRegistration) {
        const userData = JSON.parse(userRegistration);
        userName = userData.name;
        userId = userData.userId;
      } else {
        userId = 'user-' + Date.now();
        userName = prompt('Enter your name:') || 'Anonymous User';
      }

      // Connect to WebRTC server
      await webRTCService.connectToServer(offerData, userId, userName);
      
      setStep('connected');

      // Notify parent about connection establishment
      onConnectionEstablished(offerData);
    } catch (error) {
      console.error('Failed to connect to server:', error);
      setError('Failed to connect to server. Please try again.');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    QrScanner.scanImage(file, { returnDetailedScanResult: true })
      .then(result => {
        handleQRResult(result.data);
      })
      .catch(error => {
        console.error('QR scan from file failed:', error);
        setError("Failed to scan QR code from image");
      });
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center">
          <QrCode className="w-5 h-5 mr-2" />
          {step === 'scanning' ? 'Scan Server QR' :
           step === 'connecting' ? 'Connecting to Server' :
           'Connected to Server'}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 'scanning' && (
          <>
            {!isScanning ? (
              <div className="space-y-4">
                <div className="w-full h-64 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <Camera className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">Scan the WebRTC server QR from admin</p>
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
                  <Button variant="outline" onClick={() => document.getElementById('qr-upload')?.click()}>
                    Upload QR Image
                  </Button>
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

                <Button variant="outline" onClick={stopScanning} className="w-full">
                  Stop Scanning
                </Button>

                <p className="text-sm text-center text-gray-500">
                  Point camera at the admin's server QR code
                </p>
              </div>
            )}
          </>
        )}

        {step === 'connecting' && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Connecting to server...</p>
            {scannedOffer && (
              <p className="text-sm text-gray-500 mt-2">
                Server: {scannedOffer.organizationName}
              </p>
            )}
          </div>
        )}

        {step === 'connected' && (
          <div className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
              <p className="text-sm text-green-800 mb-2">
                <strong>Successfully connected!</strong>
              </p>
              <p className="text-sm text-green-700">
                You are now connected directly to the admin's device. They can request your location anytime.
              </p>
            </div>

            <Button onClick={onClose} className="w-full">
              Start Location Sharing
            </Button>

            {scannedOffer && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-xs text-blue-700">
                  Connected to: {scannedOffer.organizationName} | 
                  Server IP: {scannedOffer.serverIp}
                </p>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
