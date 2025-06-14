
import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, Camera, X } from "lucide-react";
import QrScanner from "qr-scanner";
import { qrService, QRData } from "@/services/QRService";

interface QRScannerProps {
  onQRScanned: (qrData: QRData) => void;
  onClose: () => void;
}

export const QRScannerComponent = ({ onQRScanned, onClose }: QRScannerProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup scanner on unmount
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

      // Check if QR scanner is supported
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

  const handleQRResult = (qrString: string) => {
    const qrData = qrService.parseQRData(qrString);
    
    if (qrData) {
      stopScanning();
      onQRScanned(qrData);
    } else {
      setError("Invalid QR code. Please scan a valid organization QR code.");
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
          Scan QR Code
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isScanning ? (
          <div className="space-y-4">
            <div className="w-full h-64 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <Camera className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">Position QR code within the camera view</p>
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
              <label htmlFor="qr-upload">
                <Button variant="outline" as="span">
                  Upload QR Image
                </Button>
              </label>
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
              Point your camera at the QR code to scan
            </p>
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
