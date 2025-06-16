
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, X, Building2 } from "lucide-react";
import { webRTCService } from "@/services/WebRTCService";

interface PendingRequest {
  userId: string;
  organizationId: string;
  organizationName: string;
  adminId: string;
  inviteCode: string;
  timestamp: number;
  userData: {
    name: string;
    age: string;
    phone: string;
    email: string;
  };
}

interface PendingRequestsManagerProps {
  onBack: () => void;
}

export const PendingRequestsManager = ({ onBack }: PendingRequestsManagerProps) => {
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);

  useEffect(() => {
    loadPendingRequests();
  }, []);

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

  const cancelRequest = (organizationId: string) => {
    const requestToCancel = pendingRequests.find(req => req.organizationId === organizationId);
    
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
      const updatedRequests = pendingRequests.filter(req => req.organizationId !== organizationId);
      localStorage.setItem('pendingJoinRequests', JSON.stringify(updatedRequests));
      setPendingRequests(updatedRequests);
      
      console.log('Join request cancelled for organization:', organizationId);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Pending Join Requests
              <Badge variant="secondary" className="ml-2">{pendingRequests.length}</Badge>
            </CardTitle>
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingRequests.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No pending requests</p>
              <p className="text-sm text-gray-500">You don't have any pending join requests at the moment.</p>
            </div>
          ) : (
            pendingRequests.map((request) => (
              <div key={request.organizationId} className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{request.organizationName}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Requested on: {formatTimestamp(request.timestamp)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Request ID: {request.inviteCode}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                      Pending
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-300"
                      onClick={() => cancelRequest(request.organizationId)}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};
