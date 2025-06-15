
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";
import QrScanner from "qr-scanner";

interface CameraScannerProps {
  onQRDetected: (qrString: string) => void;
  onError: (error: string) => void;
}

export const CameraScanner = ({ onQRDetected, onError }: CameraScannerProps) => {
  const [isScanning, setIsScanning] = useState(false);
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
      onError("");
      setIsScanning(true);

      const hasCamera = await QrScanner.hasCamera();
      if (!hasCamera) {
        throw new Error("No camera found on this device");
      }

      scannerRef.current = new QrScanner(
        videoRef.current,
        (result) => {
          console.log('QR Code detected:', result.data);
          onQRDetected(result.data);
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
      onError(err instanceof Error ? err.message : 'Failed to access camera');
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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    QrScanner.scanImage(file, { returnDetailedScanResult: true })
      .then(result => {
        onQRDetected(result.data);
      })
      .catch(error => {
        console.error('QR scan from file failed:', error);
        onError("Failed to scan QR code from image");
      });
  };

  if (!isScanning) {
    return (
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
    );
  }

  return (
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
  );
};
