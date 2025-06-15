
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

interface AdminDashboardHeaderProps {
  onBack: () => void;
}

export const AdminDashboardHeader = ({ onBack }: AdminDashboardHeaderProps) => {
  return (
    <div className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-500">Manage your location tracking system</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            System Online
          </Badge>
        </div>
      </div>
    </div>
  );
};
