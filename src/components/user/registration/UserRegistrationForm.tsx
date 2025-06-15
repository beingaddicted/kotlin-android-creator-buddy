
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface UserData {
  name: string;
  age: string;
  phone: string;
  email: string;
}

interface UserRegistrationFormProps {
  userData: UserData;
  onInputChange: (field: keyof UserData, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  requestSent: boolean;
}

export const UserRegistrationForm = ({ 
  userData, 
  onInputChange, 
  onSubmit, 
  onCancel,
  isSubmitting,
  requestSent
}: UserRegistrationFormProps) => {
  if (requestSent) {
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <p className="text-blue-900 font-medium">Request Sent!</p>
          <p className="text-blue-700 text-sm mt-1">
            Your join request has been sent to the admin. Please wait for approval.
          </p>
        </div>
        
        <Button 
          type="button" 
          variant="outline"
          className="w-full text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={onCancel}
        >
          <X className="w-4 h-4 mr-2" />
          Cancel Request
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">
          Full Name *
        </label>
        <Input
          type="text"
          placeholder="Enter your full name"
          value={userData.name}
          onChange={(e) => onInputChange('name', e.target.value)}
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
          onChange={(e) => onInputChange('age', e.target.value)}
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
          onChange={(e) => onInputChange('phone', e.target.value)}
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
          onChange={(e) => onInputChange('email', e.target.value)}
        />
      </div>

      <div className="flex space-x-3">
        <Button 
          type="button" 
          variant="outline"
          className="flex-1"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          className="flex-1"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Sending Request...' : 'Request to Join Organization'}
        </Button>
      </div>
    </form>
  );
};
