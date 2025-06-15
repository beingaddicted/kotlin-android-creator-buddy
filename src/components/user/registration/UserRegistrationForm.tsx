
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  isSubmitting: boolean;
}

export const UserRegistrationForm = ({ 
  userData, 
  onInputChange, 
  onSubmit, 
  isSubmitting 
}: UserRegistrationFormProps) => {
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

      <Button 
        type="submit" 
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Sending Request...' : 'Request to Join Organization'}
      </Button>
    </form>
  );
};
