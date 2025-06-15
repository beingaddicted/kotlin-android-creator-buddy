
import { Button } from '@/components/ui/button';

interface BillingHeaderProps {
  hasSubscription: boolean;
  selectedOrg?: string;
  onCreateSubscription: () => void;
}

export const BillingHeader = ({ hasSubscription, selectedOrg, onCreateSubscription }: BillingHeaderProps) => {
  return (
    <div className="flex justify-between items-center">
      <h2 className="text-2xl font-bold text-gray-900">Billing & Subscriptions</h2>
      {!hasSubscription && selectedOrg && (
        <Button onClick={onCreateSubscription}>
          Create Subscription
        </Button>
      )}
    </div>
  );
};
