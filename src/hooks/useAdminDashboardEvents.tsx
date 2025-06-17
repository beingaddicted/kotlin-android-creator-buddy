import { useEffect, useRef } from "react";
import { webRTCService } from "@/services/WebRTCService";
import { connectToSignalingServer } from "@/services/webrtc/SignalingService";
import { toast } from "sonner";
import { JoinRequest } from "@/components/admin/JoinRequests";
import { appConfig } from "@/config/appConfig";

interface UseAdminDashboardEventsProps {
  onJoinRequest: (request: JoinRequest) => void;
}

let wsConnectionInitialized = false;

// Stable handler references
function handleWebRTCMessageFactory(onJoinRequest: (request: JoinRequest) => void) {
  return function handleWebRTCMessage(event: Event) {
    console.log('[ADMIN] handleWebRTCMessage triggered:', event);
    const customEvent = event as CustomEvent<{ message: import("@/services/webrtc/SignalingService").SignalingMessage }>;

    const { message } = customEvent.detail;
    if (message.type === 'join_request') {
      const { userData, qrData } = message.data;
      const peerId = message.fromPeerId;
      // Add detailed logging
      console.log('[ADMIN] join_request received:', { userData, qrData, peerId });
      // Debug: log before calling onJoinRequest
      console.log('[ADMIN] Calling onJoinRequest with:', {
        peerId: message.fromPeerId,
        userData,
        qrData
      });
      // Always add join request for approval, regardless of pendingInvites
      const newRequest = {
        peerId: message.fromPeerId,
        userData,
        qrData
      };
      onJoinRequest(newRequest);
    }
  };
}

export const useAdminDashboardEvents = ({ onJoinRequest }: UseAdminDashboardEventsProps) => {
  // Stable handler
  const handleWebRTCMessage = handleWebRTCMessageFactory(onJoinRequest);

  // Stable location update handler
  const handleLocationUpdate = (event: CustomEvent<{ message: import("@/services/webrtc/SignalingService").SignalingMessage }>) => {
    const { message } = event.detail;
    
  };

  // Stable join request event handler
  const handleJoinRequestEvent = (event: CustomEvent<{ message: import("@/services/webrtc/SignalingService").SignalingMessage }>) => {
    const { message } = event.detail;
    if (message.type === 'join_request') {
      const { userData, qrData } = message.data;
      const peerId = message.fromPeerId;
      
      if (userData && qrData) {
        handleWebRTCMessage(new CustomEvent('webrtc-message-received', { detail: { message: { type: 'join_request', data: { userData, qrData }, fromPeerId: peerId } } }));
      }
    }
  };

  useEffect(() => {
    window.addEventListener('webrtc-message-received', handleWebRTCMessage);
    window.addEventListener('webrtc-location-updated', handleLocationUpdate);
    window.addEventListener('webrtc-join-request', handleJoinRequestEvent);

    if (!wsConnectionInitialized) {
      wsConnectionInitialized = true;
      const adminId = localStorage.getItem('adminId') || 'admin-' + Date.now();
      localStorage.setItem('adminId', adminId);
      connectToSignalingServer(appConfig.SIGNALING_SERVER_URL, (msg) => {
        console.log('[ADMIN] Received signaling message:', msg);
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
      const pendingInvites = JSON.parse(localStorage.getItem('pendingInvites') || '[]');
      console.log('AdminDashboard: Checking existing pending invites:', pendingInvites);
    }

    return () => {
      window.removeEventListener('webrtc-message-received', handleWebRTCMessage);
      window.removeEventListener('webrtc-location-updated', handleLocationUpdate);
      window.removeEventListener('webrtc-join-request', handleJoinRequestEvent);
    };
  }, [handleWebRTCMessage, handleLocationUpdate, handleJoinRequestEvent]);
};
