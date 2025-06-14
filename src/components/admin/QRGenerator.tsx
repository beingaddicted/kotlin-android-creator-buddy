
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QrCode, Share2, Download } from "lucide-react";

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
  const [qrGenerated, setQrGenerated] = useState(false);

  const generateQR = () => {
    if (selectedOrg) {
      setQrGenerated(true);
    }
  };

  const shareViaWhatsApp = () => {
    const message = encodeURIComponent(`Join our organization tracking system! Scan this QR code to get started.`);
    window.open(`https://wa.me/?text=${message}`, '_blank');
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
            disabled={!selectedOrg}
            className="w-full"
          >
            <QrCode className="w-4 h-4 mr-2" />
            Generate QR Code
          </Button>
        </CardContent>
      </Card>

      {qrGenerated && (
        <Card>
          <CardHeader>
            <CardTitle>Generated QR Code</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {/* QR Code placeholder */}
            <div className="w-64 h-64 mx-auto bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <QrCode className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">QR Code for</p>
                <p className="font-semibold">
                  {organizations.find(org => org.id === selectedOrg)?.name}
                </p>
              </div>
            </div>

            <div className="flex space-x-2 justify-center">
              <Button variant="outline" onClick={shareViaWhatsApp}>
                <Share2 className="w-4 h-4 mr-2" />
                Share via WhatsApp
              </Button>
              <Button variant="outline">
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
