
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Check, X } from "lucide-react";

export interface JoinRequest {
  peerId: string;
  userData: any;
  qrData: any;
}

interface JoinRequestsProps {
  joinRequests: JoinRequest[];
  onApproval: (request: JoinRequest, approved: boolean) => void;
}

export const JoinRequests = ({ joinRequests, onApproval }: JoinRequestsProps) => {
  if (joinRequests.length === 0) {
    return null;
  }

  return (
    <Card className="border-blue-500">
      <CardHeader>
        <CardTitle className="flex items-center">
          <UserPlus className="w-5 h-5 mr-2 text-blue-500" />
          Pending Join Requests
          <Badge variant="destructive" className="ml-2">{joinRequests.length}</Badge>
        </CardTitle>
        <CardDescription>
          New users want to join your organizations. Approve or deny their requests.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {joinRequests.map(req => (
          <div key={req.qrData.inviteCode} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="font-semibold">{req.userData.name} <span className="font-normal text-gray-600">(Age: {req.userData.age})</span></p>
              <p className="text-sm text-gray-500">Wants to join: <strong>{req.qrData.organizationName}</strong></p>
            </div>
            <div className="flex space-x-2">
              <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => onApproval(req, false)}>
                <X className="w-4 h-4 mr-1" /> Deny
              </Button>
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => onApproval(req, true)}>
                <Check className="w-4 h-4 mr-1" /> Approve
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
