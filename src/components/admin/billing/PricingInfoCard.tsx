
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export const PricingInfoCard = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-blue-500" />
            <span className="text-sm">You pay $0.10 per month for each active member in your organization</span>
          </div>
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-blue-500" />
            <span className="text-sm">Billing is automatically calculated based on your current member count</span>
          </div>
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-blue-500" />
            <span className="text-sm">You can pay through Google Play Store or Stripe</span>
          </div>
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-blue-500" />
            <span className="text-sm">Google Play integration provides native mobile payment experience</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
