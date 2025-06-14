
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QrCode, Download, ArrowLeft, Wifi } from "lucide-react";
import { qrService } from "@/services/QRService";
import { webRTCService, WebRTCServerOffer } from "@/services/WebRTCService";

interface Organization {
  id: string;
  name: string;
  memberCount: number;
  active: number;
}

interface WebRTCQRGeneratorProps {
  organizations: Organization[];
  onConnectionEstablished: (organizationId: string) => void;
}

export const WebRTCQRGenerator = ({ organizations, onConnectionEstablished }: WebRTCQRGeneratorProps) => {
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [serverOffer, setServerOffer] = useState<WebRTCServerOffer | null>(null);

  const generateServerQR = async () => {
    if (!selectedOrg) return;

    setIsGenerating(true);
    try {
      const org = organizations.find(o => o.id === selectedOrg);
      if (!org) return;

      // Create WebRTC server offer
      const offerData = await webRTCService.createServerOffer(selectedOrg, org.name);
      setServerOffer(offerData);

      // Generate QR code for the server offer
      const qrDataURL = await qrService.generateWebRTCServerOfferQR(offerData);
      setQrCodeDataURL(qrDataURL);

      // Notify parent that server is ready
      onConnectionEstablished(selectedOrg);
    } catch (error) {
      console.error('Failed to generate server QR code:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadQR = () => {
    if (!qrCodeDataURL) return;

    const link = document.createElement('a');
    link.download = `webrtc-server-${selectedOrg}.png`;
    link.href = qrCodeDataURL;
    link.click();
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Wifi className="w-5 h-5 mr-2" />
          WebRTC Server Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Select Organization
            </label>
            <Select value={selectedOrg} onValueChange={setSelectedOrg}>
              <SelectTrigger>
                <SelectValue placeholder="Choose organization to host" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name} ({org.memberCount} members)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={generateServerQR} 
            disabled={!selectedOrg || isGenerating}
            className="w-full"
          >
            <QrCode className="w-4 h-4 mr-2" />
            {isGenerating ? 'Starting Server...' : 'Start WebRTC Server'}
          </Button>
        </div>

        {qrCodeDataURL && (
          <div className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-2">Server Active!</h3>
              <p className="text-sm text-green-700">
                Your device is now acting as a WebRTC server. Members can scan this QR code to connect directly to you.
              </p>
            </div>

            <div className="w-80 h-80 mx-auto bg-white border rounded-lg flex items-center justify-center p-4">
              <img 
                src={qrCodeDataURL} 
                alt="WebRTC Server QR"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex space-x-2">
              <Button variant="outline" onClick={downloadQR} className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Download QR
              </Button>
            </div>

            {serverOffer && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-xs text-blue-700">
                  Server: {serverOffer.organizationName} | 
                  IP: {serverOffer.serverIp} | 
                  Started: {new Date(serverOffer.timestamp).toLocaleTimeString()}
                </p>
              </div>
            )}

            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="font-semibold text-yellow-900 mb-2">Instructions for Members:</h4>
              <ol className="text-sm text-yellow-800 space-y-1">
                <li>1. Open the member app and scan this QR code</li>
                <li>2. They will automatically connect to your device</li>
                <li>3. You can request their location anytime from the tracking dashboard</li>
                <li>4. Connection persists even with IP changes</li>
              </ol>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
