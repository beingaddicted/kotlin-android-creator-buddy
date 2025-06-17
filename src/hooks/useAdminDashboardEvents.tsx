import { useEffect } from "react";
import { webRTCService } from "@/services/WebRTCService";
import { connectToSignalingServer, sendSignalingViaWebSocket } from "@/services/webrtc/SignalingService";
import { toast } from "sonner";
import { JoinRequest } from "@/components/admin/JoinRequests";
import { appConfig } from "@/config/appConfig";

interface UseAdminDashboardEventsProps {
  onJoinRequest: (request: JoinRequest) => void;
}

export const useAdminDashboardEvents = ({ onJoinRequest }: UseAdminDashboardEventsProps) => {
  useEffect(() => {
    // Register admin with signaling server
    const adminId = localStorage.getItem('adminId') || 'admin-' + Date.now();
    localStorage.setItem('adminId', adminId);
    // Store ws instance for cleanup
    let wsCleanup: (() => void) | null = null;
    wsCleanup = connectToSignalingServer(appConfig.SIGNALING_SERVER_URL, (msg) => {
      console.log('[ADMIN] Received signaling message:', msg);
      // Dispatch as DOM event so join_request is handled by event listener
      window.dispatchEvent(new CustomEvent('webrtc-message-received', { detail: { message: msg } }));
      if (msg.type === 'join_request') {
        console.log('[ADMIN] Handling join request:', msg);
      }
      if (msg.type === 'offer') {
        console.log('[ADMIN] Received offer:', msg);
      }
      if (msg.type === 'answer') {
        console.log('[ADMIN] Received answer:', msg);
      }
      if (msg.type === 'ice-candidate') {
        console.log('[ADMIN] Received ICE candidate:', msg);
      }
    }, adminId);

    console.log('AdminDashboard: Setting up join request listeners');

    // Update handler to accept Event and cast to CustomEvent
    const handleWebRTCMessage = (event: Event) => {
      const customEvent = event as CustomEvent<{ message: import("@/services/webrtc/SignalingService").SignalingMessage }>;

      const { message } = customEvent.detail;
      if (message.type === 'join_request') {
        const { userData, qrData } = message.data;
        const peerId = message.fromPeerId;
        // Add detailed logging
        console.log('[ADMIN] join_request received:', { userData, qrData, peerId });
        const pendingInvites = JSON.parse(localStorage.getItem('pendingInvites') || '[]');
        console.log('[ADMIN] pendingInvites:', pendingInvites);
        console.log('[ADMIN] Checking for inviteCode:', qrData.inviteCode);
        const inviteExists = pendingInvites.some((invite: { inviteCode: string }) => invite.inviteCode === qrData.inviteCode);
        if (inviteExists) {
          console.log('[ADMIN] Invite code matched. Approving join request.');
          const newRequest = {
            peerId: message.fromPeerId,
            userData,
            qrData
          };
          onJoinRequest(newRequest);
          // Send approval response
          webRTCService.sendToPeer(message.fromPeerId, {
            type: 'join_response',
            status: 'approved'
          });
        } else {
          console.log('[ADMIN] Invite code NOT found. Denying join request.');
          // Send rejection response
          webRTCService.sendToPeer(message.fromPeerId, {
            type: 'join_response',
            status: 'denied',
            reason: 'Invalid or expired invite code'
          });
        }
      }
    };

    // Listen for incoming WebRTC messages via DOM event
    window.addEventListener('webrtc-message-received', handleWebRTCMessage);

    // Listen for location updates that might contain join requests
    const handleLocationUpdate = (event: CustomEvent<{ message: import("@/services/webrtc/SignalingService").SignalingMessage }>) => {
      const { message } = event.detail;
      
    };

    // Listen for direct join request events
    const handleJoinRequestEvent = (event: CustomEvent<{ message: import("@/services/webrtc/SignalingService").SignalingMessage }>) => {
      const { message } = event.detail;
      if (message.type === 'join_request') {
        const { userData, qrData } = message.data;
        const peerId = message.fromPeerId;
        
        if (userData && qrData) {
          // Instead of faking a CustomEvent, call the handler directly with the correct type
          handleWebRTCMessage(new CustomEvent('webrtc-message-received', { detail: { message: { type: 'join_request', data: { userData, qrData }, fromPeerId: adminId } } }));
        }
      }
    };

    // Add multiple event listeners to catch join requests
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
      if (wsCleanup) wsCleanup(); // Close WebSocket if possible
    };
  }, [onJoinRequest]); // Only run once on mount, or if onJoinRequest changes
};
