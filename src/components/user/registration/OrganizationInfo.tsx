
import { QRData } from "@/services/QRService";

interface OrganizationInfoProps {
  qrData: QRData;
}

export const OrganizationInfo = ({ qrData }: OrganizationInfoProps) => {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-900">{qrData.organizationName}</h3>
        <p className="text-sm text-blue-700">You're about to join this organization</p>
      </div>

      <div className="bg-yellow-50 p-3 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>Note:</strong> By joining, you agree to share your location with the organization admin when requested.
        </p>
      </div>
    </div>
  );
};
