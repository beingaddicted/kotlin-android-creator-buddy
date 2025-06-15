
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, CheckCircle } from 'lucide-react';

interface Subscription {
  status: string;
  stripe_subscription_id?: string;
}

interface Organization {
  id: string;
  name: string;
  memberCount: number;
  active: number;
}

interface SubscriptionStatusCardProps {
  subscription?: Subscription | null;
  organization: Organization;
  monthlyCost: number;
}

export const SubscriptionStatusCard = ({ subscription, organization, monthlyCost }: SubscriptionStatusCardProps) => {
  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <CreditCard className="w-5 h-5" />
          <span>Current Subscription</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <Badge variant={subscription?.status === 'active' ? 'default' : 'secondary'}>
              {subscription?.status || 'Not activated'}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-gray-500">Members</p>
            <p className="font-semibold">{organization.memberCount}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Monthly Cost</p>
            <p className="font-semibold">{formatCurrency(monthlyCost)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Cost per Member</p>
            <p className="font-semibold">$0.10</p>
          </div>
        </div>

        {subscription?.status === 'active' && (
          <div className="flex items-center space-x-2 text-green-600">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">Subscription is active and billing automatically</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
