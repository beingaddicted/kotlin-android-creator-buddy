
import { useState } from "react";
import { QRData } from "@/services/QRService";
import { webRTCService } from "@/services/WebRTCService";

interface UserData {
  name: string;
  age: string;
  phone: string;
  email: string;
}

interface UseUserRegistrationProps {
  qrData: QRData;
  onJoinRequest: (registrationData: any, qrData: QRData) => void;
}

export const useUserRegistration = ({ qrData, onJoinRequest }: UseUserRegistrationProps) => {
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

      console.log('User requesting to join:', registrationData);
      
      // Send join request via WebRTC to admin
      const joinRequestMessage = {
        type: 'join_request',
        data: {
          userData: registrationData,
          qrData: qrData
        },
        timestamp: Date.now()
      };

      console.log('Sending join request message:', joinRequestMessage);

      // Get connected peers and try to send to admin
      const connectedPeers = webRTCService.getConnectedPeers();
      let adminFound = false;
      
      // Try to find and send to admin peer
      connectedPeers.forEach(peer => {
        if (peer.id === qrData.adminId || peer.id.includes('admin')) {
          webRTCService.sendToPeer(peer.id, joinRequestMessage);
          adminFound = true;
        }
      });
      
      if (!adminFound) {
        console.log('No admin connected via WebRTC, dispatching event');
        // Fallback: dispatch event that admin might be listening for
        const event = new CustomEvent('webrtc-join-request', {
          detail: {
            peerId: userId,
            userData: registrationData,
            qrData: qrData
          }
        });
        window.dispatchEvent(event);
      }
      
      // Also call the original callback
      onJoinRequest(registrationData, qrData);
      
      // Show waiting message
      alert('Join request sent! Please wait for admin approval.');
      
    } catch (error) {
      console.error('Registration failed:', error);
      alert('Registration failed. Please try again.');
      setIsSubmitting(false);
    }
    // No longer setting isSubmitting to false here, as we wait for admin
  };

  return {
    userData,
    isSubmitting,
    handleInputChange,
    handleSubmit,
  };
};
