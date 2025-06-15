
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Receipt } from 'lucide-react';

interface BillingHistoryItem {
  id: string;
  amount_cents: number;
  member_count: number;
  payment_method: string;
  payment_status: string;
  billing_period_start: string;
  billing_period_end: string;
}

interface BillingHistoryCardProps {
  billingHistory: BillingHistoryItem[];
}

export const BillingHistoryCard = ({ billingHistory }: BillingHistoryCardProps) => {
  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Receipt className="w-5 h-5" />
          <span>Billing History</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {billingHistory.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No billing history yet</p>
        ) : (
          <div className="space-y-3">
            {billingHistory.map((bill) => (
              <div key={bill.id} className="flex justify-between items-center p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{formatCurrency(bill.amount_cents)}</p>
                  <p className="text-sm text-gray-500">
                    {bill.member_count} members • {bill.payment_method}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(bill.billing_period_start).toLocaleDateString()} - {new Date(bill.billing_period_end).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={bill.payment_status === 'paid' ? 'default' : bill.payment_status === 'failed' ? 'destructive' : 'secondary'}>
                  {bill.payment_status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
