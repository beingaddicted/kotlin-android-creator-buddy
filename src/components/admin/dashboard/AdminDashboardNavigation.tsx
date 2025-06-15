
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, QrCode, MapPin, CreditCard } from "lucide-react";

type ActiveSection = 'overview' | 'organizations' | 'qr' | 'tracking' | 'billing';

interface AdminDashboardNavigationProps {
  activeSection: ActiveSection;
  onSectionChange: (section: ActiveSection) => void;
  joinRequestsCount: number;
}

export const AdminDashboardNavigation = ({ 
  activeSection, 
  onSectionChange, 
  joinRequestsCount 
}: AdminDashboardNavigationProps) => {
  const navigationItems = [
    { id: 'overview' as const, label: 'Overview', icon: Building2 },
    { id: 'organizations' as const, label: 'Organizations', icon: Building2 },
    { id: 'qr' as const, label: 'QR Generator', icon: QrCode },
    { id: 'tracking' as const, label: 'Live Tracking', icon: MapPin },
    { id: 'billing' as const, label: 'Billing', icon: CreditCard }
  ];

  return (
    <div className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-8">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`relative flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeSection === item.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
              {item.id === 'overview' && joinRequestsCount > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-2 px-1.5 py-0.5 text-xs">
                  {joinRequestsCount}
                </Badge>
              )}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};
