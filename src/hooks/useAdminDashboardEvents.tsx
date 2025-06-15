
import { useEffect } from "react";
import { webRTCService } from "@/services/WebRTCService";
import { toast } from "sonner";
import { JoinRequest } from "@/components/admin/JoinRequests";

interface UseAdminDashboardEventsProps {
  onJoinRequest: (request: JoinRequest) => void;
}

export const useAdminDashboardEvents = ({ onJoinRequest }: UseAdminDashboardEventsProps) => {
  useEffect(() => {
    console.log('AdminDashboard: Setting up join request listeners');

    // Listen for incoming WebRTC messages
    const handleWebRTCMessage = (event: any) => {
      console.log('AdminDashboard: Received WebRTC message:', event.detail);
      const { message, fromPeerId } = event.detail;
      
      if (message.type === 'join_request') {
        console.log('AdminDashboard: Processing join request from:', fromPeerId);
        const { userData, qrData } = message.data;
        
        // Validate invite code exists in pending invites
        const pendingInvites = JSON.parse(localStorage.getItem('pendingInvites') || '[]');
        const inviteExists = pendingInvites.some((invite: any) => invite.inviteCode === qrData.inviteCode);
        
        if (inviteExists) {
          const newRequest: JoinRequest = {
            peerId: fromPeerId,
            userData,
            qrData
          };
          
          console.log('AdminDashboard: Adding join request:', newRequest);
          onJoinRequest(newRequest);
          
          toast.info(`New join request from ${userData.name} for ${qrData.organizationName}`);
        } else {
          console.warn('AdminDashboard: Invalid invite code:', qrData.inviteCode);
          // Send rejection back to user
          webRTCService.sendToPeer(fromPeerId, {
            type: 'join_response',
            status: 'denied',
            reason: 'Invalid or expired invite code'
          });
        }
      }
    };

    // Listen for location updates that might contain join requests
    const handleLocationUpdate = (event: any) => {
      console.log('AdminDashboard: Location update event:', event.detail);
      const { peerId, data } = event.detail;
      
      // Check if this is actually a join request disguised as location update
      if (data && data.type === 'join_request') {
        console.log('AdminDashboard: Found join request in location update');
        handleWebRTCMessage({ detail: { message: data, fromPeerId: peerId } });
      }
    };

    // Listen for direct join request events
    const handleJoinRequestEvent = (event: any) => {
      console.log('AdminDashboard: Direct join request event:', event.detail);
      const { peerId, userData, qrData } = event.detail;
      
      if (userData && qrData) {
        handleWebRTCMessage({ 
          detail: { 
            message: { type: 'join_request', data: { userData, qrData } }, 
            fromPeerId: peerId 
          } 
        });
      }
    };

    // Add multiple event listeners to catch join requests
    window.addEventListener('webrtc-message-received', handleWebRTCMessage);
    window.addEventListener('webrtc-location-updated', handleLocationUpdate);
    window.addEventListener('webrtc-join-request', handleJoinRequestEvent);

    // Check for any existing pending requests on component mount
    const checkExistingRequests = () => {
      const pendingInvites = JSON.parse(localStorage.getItem('pendingInvites') || '[]');
      console.log('AdminDashboard: Checking existing pending invites:', pendingInvites);
    };

    checkExistingRequests();

    return () => {
      window.removeEventListener('webrtc-message-received', handleWebRTCMessage);
      window.removeEventListener('webrtc-location-updated', handleLocationUpdate);
      window.removeEventListener('webrtc-join-request', handleJoinRequestEvent);
    };
  }, [onJoinRequest]);
};
