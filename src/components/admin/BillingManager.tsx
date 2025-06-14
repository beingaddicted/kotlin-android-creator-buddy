
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSubscription } from '@/hooks/useSubscription';
import { GooglePlayIntegration } from './GooglePlayIntegration';
import { SubscriptionPlans } from './SubscriptionPlans';
import { CreditCard, Receipt, AlertCircle, CheckCircle, Smartphone, Globe } from 'lucide-react';
import { toast } from 'sonner';

interface Organization {
  id: string;
  name: string;
  memberCount: number;
  active: number;
}

interface BillingManagerProps {
  organizations: Organization[];
  selectedOrgId?: string;
}

export const BillingManager = ({ organizations, selectedOrgId }: BillingManagerProps) => {
  const [selectedOrg, setSelectedOrg] = useState(selectedOrgId || organizations[0]?.id);
  const { subscription, billingHistory, loading, createSubscription, updateSubscriptionStatus, calculateMonthlyCost } = useSubscription(selectedOrg);
  const [processingPayment, setProcessingPayment] = useState(false);

  const selectedOrgData = organizations.find(org => org.id === selectedOrg);

  const handleStripePayment = async () => {
    setProcessingPayment(true);
    try {
      // Simulate Stripe integration
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockSubscriptionId = `stripe_${Date.now()}`;
      await updateSubscriptionStatus('active', mockSubscriptionId, 'stripe');
      
      toast.success('Stripe subscription activated!');
    } catch (error) {
      toast.error('Failed to process Stripe payment');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handlePlanSelection = (planId: string) => {
    toast.info(`Selected ${planId} plan. Redirecting to payment...`);
    // Here you would implement plan-specific pricing logic
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return <div>Loading billing information...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Billing & Subscriptions</h2>
        {!subscription && selectedOrg && (
          <Button onClick={() => createSubscription(selectedOrg)}>
            Create Subscription
          </Button>
        )}
      </div>

      {/* Organization Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Organization</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={selectedOrg}
            onChange={(e) => setSelectedOrg(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name} ({org.memberCount} members)
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {selectedOrgData && (
        <>
          {/* Current Subscription Status */}
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
                  <p className="font-semibold">{selectedOrgData.memberCount}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Monthly Cost</p>
                  <p className="font-semibold">{formatCurrency(calculateMonthlyCost(selectedOrgData.memberCount))}</p>
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

          {/* Payment Methods Tabs */}
          <Tabs defaultValue="google-play" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="google-play" className="flex items-center space-x-2">
                <Smartphone className="w-4 h-4" />
                <span>Google Play</span>
              </TabsTrigger>
              <TabsTrigger value="stripe" className="flex items-center space-x-2">
                <Globe className="w-4 h-4" />
                <span>Stripe</span>
              </TabsTrigger>
              <TabsTrigger value="plans" className="flex items-center space-x-2">
                <CreditCard className="w-4 h-4" />
                <span>Plans</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="google-play">
              <GooglePlayIntegration 
                organizationId={selectedOrg} 
                memberCount={selectedOrgData.memberCount} 
              />
            </TabsContent>

            <TabsContent value="stripe">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Globe className="w-5 h-5" />
                    <span>Stripe Payment</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {subscription?.status !== 'active' && (
                    <div className="border-t pt-4">
                      <p className="text-sm text-gray-600 mb-4">
                        Pay securely with Stripe for web-based payments:
                      </p>
                      <Button
                        variant="outline"
                        onClick={handleStripePayment}
                        disabled={processingPayment}
                        className="flex items-center space-x-2"
                      >
                        <span>Pay with Stripe</span>
                      </Button>
                    </div>
                  )}

                  {subscription?.status === 'active' && subscription?.stripe_subscription_id && (
                    <div className="flex items-center space-x-2 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">Stripe subscription is active</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="plans">
              <SubscriptionPlans
                currentMemberCount={selectedOrgData.memberCount}
                onSelectPlan={handlePlanSelection}
                currentPlan="basic"
              />
            </TabsContent>
          </Tabs>

          {/* Billing History */}
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

          {/* Pricing Information */}
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
        </>
      )}
    </div>
  );
};
