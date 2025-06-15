
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, X } from "lucide-react";
import { qrService } from "@/services/QRService";
import { WebRTCServerOffer } from "@/services/webrtc/types";
import { CameraScanner } from "./scanner/CameraScanner";
import { ConnectionHandler } from "./scanner/ConnectionHandler";
import { ConnectionStatus } from "./scanner/ConnectionStatus";

interface WebRTCQRScannerProps {
  onConnectionEstablished: (offerData: WebRTCServerOffer) => void;
  onClose: () => void;
}

export const WebRTCQRScanner = ({ onConnectionEstablished, onClose }: WebRTCQRScannerProps) => {
  const [error, setError] = useState<string>("");
  const [step, setStep] = useState<'scanning' | 'connecting' | 'connected'>('scanning');
  const [scannedOffer, setScannedOffer] = useState<WebRTCServerOffer | null>(null);

  const handleQRResult = async (qrString: string) => {
    try {
      const qrData = await qrService.parseQRData(qrString);
      
      if (qrData && 'type' in qrData && qrData.type === 'webrtc_server_offer') {
        const offerData = qrData as WebRTCServerOffer;
        setScannedOffer(offerData);
        await connectToServer(offerData);
      } else {
        setError("Invalid WebRTC server QR code. Please scan the server QR from admin.");
      }
    } catch (err) {
      console.error('QR parsing failed:', err);
      setError(err instanceof Error ? err.message : "Failed to parse QR code");
    }
  };

  const connectToServer = async (offerData: WebRTCServerOffer) => {
    try {
      setStep('connecting');
      
      await ConnectionHandler.connectToServer(offerData);
      
      setStep('connected');
      onConnectionEstablished(offerData);
    } catch (error) {
      console.error('Failed to connect to server:', error);
      setError('Failed to connect to server. Please try again.');
      setStep('scanning');
    }
  };

  const getTitle = () => {
    switch (step) {
      case 'scanning': return 'Scan Server QR';
      case 'connecting': return 'Connecting to Server';
      case 'connected': return 'Connected to Server';
      default: return 'Scan Server QR';
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center">
          <QrCode className="w-5 h-5 mr-2" />
          {getTitle()}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 'scanning' && (
          <CameraScanner onQRDetected={handleQRResult} onError={setError} />
        )}

        {(step === 'connecting' || step === 'connected') && (
          <ConnectionStatus 
            step={step} 
            scannedOffer={scannedOffer} 
            onClose={onClose} 
          />
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
