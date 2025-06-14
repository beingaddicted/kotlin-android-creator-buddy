
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from './useSupabaseAuth';
import { toast } from 'sonner';

interface Subscription {
  id: string;
  organization_id: string;
  stripe_subscription_id?: string;
  google_play_subscription_id?: string;
  status: 'active' | 'inactive' | 'past_due' | 'canceled';
  member_count: number;
  monthly_cost_cents: number;
  current_period_start?: string;
  current_period_end?: string;
  created_at: string;
  updated_at: string;
}

interface BillingHistory {
  id: string;
  organization_id: string;
  amount_cents: number;
  member_count: number;
  billing_period_start: string;
  billing_period_end: string;
  payment_status: 'pending' | 'paid' | 'failed';
  payment_method: 'stripe' | 'google_play';
  created_at: string;
}

export const useSubscription = (organizationId?: string) => {
  const { user } = useSupabaseAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (organizationId && user) {
      fetchSubscription();
      fetchBillingHistory();
    }
  }, [organizationId, user]);

  const fetchSubscription = async () => {
    try {
      const { data, error } = await supabase
        .from('organization_subscriptions')
        .select('*')
        .eq('organization_id', organizationId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching subscription:', error);
        return;
      }

      if (data) {
        const typedData: Subscription = {
          ...data,
          status: data.status as 'active' | 'inactive' | 'past_due' | 'canceled'
        };
        setSubscription(typedData);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBillingHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('billing_history')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching billing history:', error);
        return;
      }

      if (data) {
        const typedData: BillingHistory[] = data.map(item => ({
          ...item,
          payment_status: item.payment_status as 'pending' | 'paid' | 'failed',
          payment_method: item.payment_method as 'stripe' | 'google_play'
        }));
        setBillingHistory(typedData);
      }
    } catch (error) {
      console.error('Error fetching billing history:', error);
    }
  };

  const createSubscription = async (organizationId: string) => {
    try {
      const { data, error } = await supabase
        .from('organization_subscriptions')
        .insert({
          organization_id: organizationId,
          status: 'inactive',
          member_count: 0,
          monthly_cost_cents: 0
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating subscription:', error);
        toast.error('Failed to create subscription');
        return null;
      }

      const typedData: Subscription = {
        ...data,
        status: data.status as 'active' | 'inactive' | 'past_due' | 'canceled'
      };
      setSubscription(typedData);
      toast.success('Subscription created successfully');
      return typedData;
    } catch (error) {
      console.error('Error creating subscription:', error);
      toast.error('Failed to create subscription');
      return null;
    }
  };

  const updateSubscriptionStatus = async (status: string, paymentId?: string, paymentMethod?: 'stripe' | 'google_play') => {
    if (!subscription) return;

    try {
      const updateData: any = { status };
      
      if (paymentMethod === 'stripe' && paymentId) {
        updateData.stripe_subscription_id = paymentId;
      } else if (paymentMethod === 'google_play' && paymentId) {
        updateData.google_play_subscription_id = paymentId;
      }

      const { data, error } = await supabase
        .from('organization_subscriptions')
        .update(updateData)
        .eq('id', subscription.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating subscription:', error);
        toast.error('Failed to update subscription');
        return;
      }

      const typedData: Subscription = {
        ...data,
        status: data.status as 'active' | 'inactive' | 'past_due' | 'canceled'
      };
      setSubscription(typedData);
      toast.success('Subscription updated successfully');
    } catch (error) {
      console.error('Error updating subscription:', error);
      toast.error('Failed to update subscription');
    }
  };

  const calculateMonthlyCost = (memberCount: number) => {
    return memberCount * 10; // 10 cents per member
  };

  return {
    subscription,
    billingHistory,
    loading,
    createSubscription,
    updateSubscriptionStatus,
    calculateMonthlyCost,
    refreshData: () => {
      fetchSubscription();
      fetchBillingHistory();
    }
  };
};
