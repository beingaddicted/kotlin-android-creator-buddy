
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { WebRTCServerOffer } from "@/services/WebRTCService";

interface ConnectionStatusProps {
  step: 'connecting' | 'connected';
  scannedOffer: WebRTCServerOffer | null;
  onClose: () => void;
}

export const ConnectionStatus = ({ step, scannedOffer, onClose }: ConnectionStatusProps) => {
  if (step === 'connecting') {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Connecting to server...</p>
        {scannedOffer && (
          <p className="text-sm text-gray-500 mt-2">
            Server: {scannedOffer.organizationName}
          </p>
        )}
      </div>
    );
  }

  if (step === 'connected') {
    return (
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
    );
  }

  return null;
};
