
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, ArrowLeft } from "lucide-react";
import { QRData } from "@/services/QRService";

interface UserData {
  name: string;
  age: string;
  phone: string;
  email: string;
}

interface UserRegistrationProps {
  qrData: QRData;
  onRegistrationComplete: (userData: UserData) => void;
  onBack: () => void;
}

export const UserRegistration = ({ qrData, onRegistrationComplete, onBack }: UserRegistrationProps) => {
  const [userData, setUserData] = useState<UserData>({
    name: '',
    age: '',
    phone: '',
    email: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: keyof UserData, value: string) => {
    setUserData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userData.name || !userData.age) {
      alert('Please fill in at least name and age');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Store user data locally
      const userId = 'user-' + Date.now();
      const registrationData = {
        userId,
        ...userData,
        organizationId: qrData.organizationId,
        organizationName: qrData.organizationName,
        adminId: qrData.adminId,
        registeredAt: Date.now(),
      };

      localStorage.setItem('userRegistration', JSON.stringify(registrationData));
      localStorage.setItem('userId', userId);

      console.log('User registered:', registrationData);
      
      // Simulate registration request to admin (in real P2P, this would be sent via WebRTC)
      onRegistrationComplete(userData);
    } catch (error) {
      console.error('Registration failed:', error);
      alert('Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900">{qrData.organizationName}</h3>
            <p className="text-sm text-blue-700">You're about to join this organization</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Full Name *
              </label>
              <Input
                type="text"
                placeholder="Enter your full name"
                value={userData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Age *
              </label>
              <Input
                type="number"
                placeholder="Enter your age"
                value={userData.age}
                onChange={(e) => handleInputChange('age', e.target.value)}
                required
                min="1"
                max="120"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Phone Number
              </label>
              <Input
                type="tel"
                placeholder="Enter your phone number"
                value={userData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Email Address
              </label>
              <Input
                type="email"
                placeholder="Enter your email address"
                value={userData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Joining...' : 'Join Organization'}
            </Button>
          </form>

          <div className="bg-yellow-50 p-3 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> By joining, you agree to share your location with the organization admin when requested.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
