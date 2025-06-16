
import { useState, useEffect } from "react";
import { QRData } from "@/services/QRService";
import { webRTCService } from "@/services/WebRTCService";

interface UserData {
  name: string;
  age: string;
  phone: string;
  email: string;
}

interface PendingRequest {
  userId: string;
  organizationId: string;
  organizationName: string;
  adminId: string;
  inviteCode: string;
  timestamp: number;
  userData: UserData;
}

interface UseUserRegistrationProps {
  qrData: QRData;
  onJoinRequest: (registrationData: any, qrData: QRData) => void;
  onCancel?: () => void;
}

export const useUserRegistration = ({ qrData, onJoinRequest, onCancel }: UseUserRegistrationProps) => {
  const [userData, setUserData] = useState<UserData>({
    name: '',
    age: '',
    phone: '',
    email: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);

  // Load existing user data and pending requests on mount
  useEffect(() => {
    // Load existing user data if available
    const existingUserData = localStorage.getItem('userData');
    if (existingUserData) {
      try {
        const parsed = JSON.parse(existingUserData);
        setUserData(parsed);
      } catch (error) {
        console.warn('Failed to parse existing user data:', error);
      }
    }

    // Load pending requests
    loadPendingRequests();

    // Check if current organization already has a pending request
    const currentOrgPending = checkIfCurrentOrgPending();
    setRequestSent(currentOrgPending);
  }, [qrData.organizationId]);

  const loadPendingRequests = () => {
    const stored = localStorage.getItem('pendingJoinRequests');
    if (stored) {
      try {
        const requests = JSON.parse(stored);
        setPendingRequests(requests);
      } catch (error) {
        console.warn('Failed to parse pending requests:', error);
      }
    }
  };

  const checkIfCurrentOrgPending = () => {
    const stored = localStorage.getItem('pendingJoinRequests');
    if (stored) {
      try {
        const requests = JSON.parse(stored);
        return requests.some((req: PendingRequest) => req.organizationId === qrData.organizationId);
      } catch (error) {
        console.warn('Failed to check pending requests:', error);
      }
    }
    return false;
  };

  const handleInputChange = (field: keyof UserData, value: string) => {
    setUserData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCancel = () => {
    if (requestSent) {
      // Cancel the pending request for current organization
      cancelSpecificRequest(qrData.organizationId);
    }

    // Call the onCancel callback if provided
    if (onCancel) {
      onCancel();
    }
  };

  const cancelSpecificRequest = (organizationId: string) => {
    const stored = localStorage.getItem('pendingJoinRequests');
    if (stored) {
      try {
        const requests = JSON.parse(stored);
        const requestToCancel = requests.find((req: PendingRequest) => req.organizationId === organizationId);
        
        if (requestToCancel) {
          // Send cancel message via WebRTC
          const cancelMessage = {
            type: 'cancel_join_request',
            data: {
              userId: requestToCancel.userId,
              organizationId: requestToCancel.organizationId,
              adminId: requestToCancel.adminId,
              inviteCode: requestToCancel.inviteCode
            },
            timestamp: Date.now()
          };

          // Send cancel message via WebRTC
          const connectedPeers = webRTCService.getConnectedPeers();
          connectedPeers.forEach(peer => {
            if (peer.id === requestToCancel.adminId || peer.id.includes('admin')) {
              webRTCService.sendToPeer(peer.id, cancelMessage);
            }
          });

          // Dispatch event for admin to handle
          const event = new CustomEvent('webrtc-cancel-join-request', {
            detail: {
              userId: requestToCancel.userId,
              organizationId: requestToCancel.organizationId,
              adminId: requestToCancel.adminId,
              inviteCode: requestToCancel.inviteCode
            }
          });
          window.dispatchEvent(event);

          // Remove from pending requests
          const updatedRequests = requests.filter((req: PendingRequest) => req.organizationId !== organizationId);
          localStorage.setItem('pendingJoinRequests', JSON.stringify(updatedRequests));
          setPendingRequests(updatedRequests);
          
          if (organizationId === qrData.organizationId) {
            setRequestSent(false);
          }

          console.log('Join request cancelled for organization:', organizationId);
        }
      } catch (error) {
        console.warn('Failed to cancel request:', error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userData.name || !userData.age) {
      alert('Please fill in at least name and age');
      return;
    }

    // Check if already have a pending request for this organization
    if (checkIfCurrentOrgPending()) {
      alert('You already have a pending request for this organization');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Save user data for future use
      localStorage.setItem('userData', JSON.stringify(userData));

      // Store user data locally
      const userId = localStorage.getItem('userId') || 'user-' + Date.now();
      if (!localStorage.getItem('userId')) {
        localStorage.setItem('userId', userId);
      }

      const registrationData = {
        userId,
        ...userData,
        organizationId: qrData.organizationId,
        organizationName: qrData.organizationName,
        adminId: qrData.adminId,
        registeredAt: Date.now(),
      };

      // Add to pending requests
      const newPendingRequest: PendingRequest = {
        userId,
        organizationId: qrData.organizationId,
        organizationName: qrData.organizationName,
        adminId: qrData.adminId,
        inviteCode: qrData.inviteCode,
        timestamp: Date.now(),
        userData
      };

      const existingRequests = pendingRequests;
      const updatedRequests = [...existingRequests, newPendingRequest];
      localStorage.setItem('pendingJoinRequests', JSON.stringify(updatedRequests));
      setPendingRequests(updatedRequests);

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
      
      // Mark request as sent
      setRequestSent(true);
      
      // Show waiting message
      alert('Join request sent! You can manage your pending requests from the pending requests section.');
      
    } catch (error) {
      console.error('Registration failed:', error);
      alert('Registration failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  return {
    userData,
    isSubmitting,
    requestSent,
    pendingRequests,
    handleInputChange,
    handleSubmit,
    handleCancel,
    cancelSpecificRequest,
    loadPendingRequests,
  };
};
