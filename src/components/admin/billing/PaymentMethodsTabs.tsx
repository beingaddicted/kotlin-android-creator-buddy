
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GooglePlayIntegration } from '../GooglePlayIntegration';
import { SubscriptionPlans } from '../SubscriptionPlans';
import { CheckCircle, Smartphone, Globe, CreditCard } from 'lucide-react';

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

interface PaymentMethodsTabsProps {
  selectedOrg: string;
  selectedOrgData: Organization;
  subscription?: Subscription | null;
  processingPayment: boolean;
  onStripePayment: () => void;
  onPlanSelection: (planId: string) => void;
}

export const PaymentMethodsTabs = ({ 
  selectedOrg, 
  selectedOrgData, 
  subscription, 
  processingPayment, 
  onStripePayment, 
  onPlanSelection 
}: PaymentMethodsTabsProps) => {
  return (
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
                  onClick={onStripePayment}
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
          onSelectPlan={onPlanSelection}
          currentPlan="basic"
        />
      </TabsContent>
    </Tabs>
  );
};
