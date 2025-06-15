
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, ArrowLeft } from "lucide-react";
import { QRData } from "@/services/QRService";
import { useUserRegistration } from "@/hooks/useUserRegistration";
import { UserRegistrationForm } from "./registration/UserRegistrationForm";
import { OrganizationInfo } from "./registration/OrganizationInfo";

interface UserRegistrationProps {
  qrData: QRData;
  onJoinRequest: (registrationData: any, qrData: QRData) => void;
  onBack: () => void;
}

export const UserRegistration = ({ qrData, onJoinRequest, onBack }: UserRegistrationProps) => {
  const {
    userData,
    isSubmitting,
    requestSent,
    handleInputChange,
    handleSubmit,
    handleCancel,
  } = useUserRegistration({ 
    qrData, 
    onJoinRequest,
    onCancel: onBack 
  });

  return (
    <div className="max-w-md mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <CardTitle className="flex items-center">
                <UserPlus className="w-5 h-5 mr-2" />
                Join Organization
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <OrganizationInfo qrData={qrData} />
          
          <UserRegistrationForm
            userData={userData}
            onInputChange={handleInputChange}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
            requestSent={requestSent}
          />
        </CardContent>
      </Card>
    </div>
  );
};
