
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QrCode, Wifi, Download, RotateCcw } from "lucide-react";
import { qrService } from "@/services/QRService";
import { webRTCService, WebRTCOffer, WebRTCAnswer } from "@/services/WebRTCService";

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
  const [offerQR, setOfferQR] = useState<string>("");
  const [currentOffer, setCurrentOffer] = useState<WebRTCOffer | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isWaitingForAnswer, setIsWaitingForAnswer] = useState(false);
  const [step, setStep] = useState<'select' | 'offer-generated' | 'scanning-answer'>('select');

  const generateOfferQR = async () => {
    if (!selectedOrg) return;

    setIsGenerating(true);
    try {
      const org = organizations.find(o => o.id === selectedOrg);
      if (!org) return;

      // Create WebRTC offer
      const offerData = await webRTCService.createOfferQR(selectedOrg, org.name);
      setCurrentOffer(offerData);

      // Generate QR code for the offer
      const qrDataURL = await qrService.generateWebRTCOfferQR(offerData);
      setOfferQR(qrDataURL);
      setStep('offer-generated');
    } catch (error) {
      console.error('Failed to generate WebRTC offer QR:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswerScanned = async (answerData: WebRTCAnswer) => {
    if (!currentOffer) return;

    try {
      setIsWaitingForAnswer(true);
      
      // Process the answer to complete WebRTC connection
      await webRTCService.processAnswer(answerData);
      
      console.log('WebRTC connection established with:', answerData.userName);
      
      // Notify parent component
      onConnectionEstablished(selectedOrg);
      
      // Reset state
      resetState();
    } catch (error) {
      console.error('Failed to process WebRTC answer:', error);
    } finally {
      setIsWaitingForAnswer(false);
    }
  };

  const resetState = () => {
    setOfferQR("");
    setCurrentOffer(null);
    setStep('select');
    setSelectedOrg("");
  };

  const downloadQR = () => {
    if (!offerQR) return;

    const link = document.createElement('a');
    link.download = `${organizations.find(o => o.id === selectedOrg)?.name || 'organization'}-webrtc-offer.png`;
    link.href = offerQR;
    link.click();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">WebRTC P2P Connection</h2>
        <p className="text-gray-600">Generate connection QR for direct peer-to-peer location sharing</p>
      </div>

      {step === 'select' && (
        <Card>
          <CardHeader>
            <CardTitle>Setup P2P Connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Select Organization
              </label>
              <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an organization" />
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
              onClick={generateOfferQR} 
              disabled={!selectedOrg || isGenerating}
              className="w-full"
            >
              <Wifi className="w-4 h-4 mr-2" />
              {isGenerating ? 'Creating Connection...' : 'Generate Connection QR'}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'offer-generated' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Step 1: Share Connection QR</span>
              <Button variant="ghost" size="sm" onClick={resetState}>
                <RotateCcw className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="w-80 h-80 mx-auto bg-white border rounded-lg flex items-center justify-center p-4">
              <img 
                src={offerQR} 
                alt="WebRTC Connection QR"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800 mb-2">
                <strong>Instructions for members:</strong>
              </p>
              <ol className="text-sm text-blue-700 space-y-1 text-left">
                <li>1. Open the member app and scan this QR code</li>
                <li>2. Register with your details</li>
                <li>3. The app will generate an answer QR code</li>
                <li>4. Show the answer QR to the admin to complete connection</li>
              </ol>
            </div>

            <div className="flex space-x-2">
              <Button variant="outline" onClick={downloadQR}>
                <Download className="w-4 h-4 mr-2" />
                Download QR
              </Button>
              <Button onClick={() => setStep('scanning-answer')}>
                <QrCode className="w-4 h-4 mr-2" />
                Ready to Scan Answer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'scanning-answer' && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Scan Member's Answer QR</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Waiting for member's answer QR code...</strong>
              </p>
              <p className="text-sm text-green-700 mt-1">
                Ask the member to show you their generated answer QR code, then scan it to complete the connection.
              </p>
            </div>

            <div className="w-64 h-64 mx-auto bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <QrCode className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Scan member's answer QR</p>
              </div>
            </div>

            <Button variant="outline" onClick={() => setStep('offer-generated')}>
              Back to Share QR
            </Button>
          </CardContent>
        </Card>
      )}

      {organizations.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Wifi className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No organizations available</h3>
            <p className="text-gray-500">Create an organization first to setup P2P connections.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
