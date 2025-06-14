
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, QrCode, UserPlus, MapPin } from "lucide-react";

interface UserInterfaceProps {
  onBack: () => void;
}

export const UserInterface = ({ onBack }: UserInterfaceProps) => {
  const [isRegistered, setIsRegistered] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Member Portal</h1>
              <p className="text-sm text-gray-500">Join organization tracking</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto px-4 py-8">
        {!isRegistered ? (
          <div className="space-y-6">
            <Card>
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <QrCode className="w-8 h-8 text-green-600" />
                </div>
                <CardTitle>Scan QR Code</CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <p className="text-gray-600">Scan the QR code provided by your admin to join an organization</p>
                <Button className="w-full">
                  <QrCode className="w-4 h-4 mr-2" />
                  Open QR Scanner
                </Button>
              </CardContent>
            </Card>

            <div className="text-center">
              <p className="text-sm text-gray-500">
                Don't have a QR code? Contact your organization admin.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-green-600" />
                  Location Sharing Active
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">Your location is being shared with your organization admin.</p>
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-sm text-green-800">✓ Connected to: Sales Team</p>
                  <p className="text-sm text-green-800">✓ Background tracking enabled</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};
