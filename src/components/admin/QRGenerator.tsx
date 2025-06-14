
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QrCode, Share2, Download } from "lucide-react";
import { qrService } from "@/services/QRService";

interface Organization {
  id: string;
  name: string;
  memberCount: number;
  active: number;
}

interface QRGeneratorProps {
  organizations: Organization[];
}

export const QRGenerator = ({ organizations }: QRGeneratorProps) => {
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  const generateQR = async () => {
    if (!selectedOrg) return;

    setIsGenerating(true);
    try {
      const org = organizations.find(o => o.id === selectedOrg);
      if (!org) return;

      const adminId = localStorage.getItem('adminId') || 'admin-' + Date.now();
      localStorage.setItem('adminId', adminId);

      const { qrDataURL, inviteCode } = await qrService.generateQRCode(selectedOrg, org.name, adminId);
      setQrCodeDataURL(qrDataURL);

      // Store the invite code as a pending request
      const pendingInvites = JSON.parse(localStorage.getItem('pendingInvites') || '[]');
      pendingInvites.push({
        inviteCode,
        organizationId: org.id,
        organizationName: org.name,
        adminId,
        timestamp: Date.now(),
      });
      localStorage.setItem('pendingInvites', JSON.stringify(pendingInvites));

    } catch (error) {
      console.error('Failed to generate QR code:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const shareViaWhatsApp = () => {
    if (!qrCodeDataURL || !selectedOrg) return;
    
    const org = organizations.find(o => o.id === selectedOrg);
    if (org) {
      qrService.shareViaWhatsApp(qrCodeDataURL, org.name);
    }
  };

  const downloadQR = () => {
    if (!qrCodeDataURL) return;

    const link = document.createElement('a');
    link.download = `${organizations.find(o => o.id === selectedOrg)?.name || 'organization'}-qr-code.png`;
    link.href = qrCodeDataURL;
    link.click();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">QR Code Generator</h2>
        <p className="text-gray-600">Generate QR codes for members to join organizations</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate New QR Code</CardTitle>
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
            onClick={generateQR} 
            disabled={!selectedOrg || isGenerating}
            className="w-full"
          >
            <QrCode className="w-4 h-4 mr-2" />
            {isGenerating ? 'Generating...' : 'Generate QR Code'}
          </Button>
        </CardContent>
      </Card>

      {qrCodeDataURL && (
        <Card>
          <CardHeader>
            <CardTitle>Generated QR Code</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="w-64 h-64 mx-auto bg-white border rounded-lg flex items-center justify-center p-4">
              <img 
                src={qrCodeDataURL} 
                alt="QR Code"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex space-x-2 justify-center">
              <Button variant="outline" onClick={shareViaWhatsApp}>
                <Share2 className="w-4 h-4 mr-2" />
                Share via WhatsApp
              </Button>
              <Button variant="outline" onClick={downloadQR}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Instructions:</strong> Share this QR code with new members. 
                When they scan it, they'll be prompted to register and join the selected organization.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {organizations.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <QrCode className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No organizations available</h3>
            <p className="text-gray-500">Create an organization first to generate QR codes.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
