
import { useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from 'sonner';
import { BillingHeader } from './billing/BillingHeader';
import { OrganizationSelector } from './billing/OrganizationSelector';
import { SubscriptionStatusCard } from './billing/SubscriptionStatusCard';
import { PaymentMethodsTabs } from './billing/PaymentMethodsTabs';
import { BillingHistoryCard } from './billing/BillingHistoryCard';
import { PricingInfoCard } from './billing/PricingInfoCard';

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

  const handleCreateSubscription = () => {
    if (selectedOrg) {
      createSubscription(selectedOrg);
    }
  };

  if (loading) {
    return <div>Loading billing information...</div>;
  }

  return (
    <div className="space-y-6">
      <BillingHeader 
        hasSubscription={!!subscription}
        selectedOrg={selectedOrg}
        onCreateSubscription={handleCreateSubscription}
      />

      <OrganizationSelector 
        organizations={organizations}
        selectedOrg={selectedOrg}
        onOrgChange={setSelectedOrg}
      />

      {selectedOrgData && (
        <>
          <SubscriptionStatusCard 
            subscription={subscription}
            organization={selectedOrgData}
            monthlyCost={calculateMonthlyCost(selectedOrgData.memberCount)}
          />

          <PaymentMethodsTabs 
            selectedOrg={selectedOrg}
            selectedOrgData={selectedOrgData}
            subscription={subscription}
            processingPayment={processingPayment}
            onStripePayment={handleStripePayment}
            onPlanSelection={handlePlanSelection}
          />

          <BillingHistoryCard billingHistory={billingHistory} />

          <PricingInfoCard />
        </>
      )}
    </div>
  );
};
