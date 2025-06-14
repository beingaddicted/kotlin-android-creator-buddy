
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { googlePlayService } from '@/services/GooglePlayService';
import { useSubscription } from '@/hooks/useSubscription';
import { ShoppingCart, RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface GooglePlayIntegrationProps {
  organizationId: string;
  memberCount: number;
}

export const GooglePlayIntegration = ({ organizationId, memberCount }: GooglePlayIntegrationProps) => {
  const { subscription, updateSubscriptionStatus, calculateMonthlyCost } = useSubscription(organizationId);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleGooglePlayPurchase = async () => {
    setIsProcessing(true);
    try {
      toast.info('Initiating Google Play purchase...');
      
      const result = await googlePlayService.purchaseSubscription(organizationId, memberCount);
      
      if (result.success && result.subscriptionId) {
        await updateSubscriptionStatus('active', result.subscriptionId, 'google_play');
        toast.success('Google Play subscription activated successfully!');
      } else {
        toast.error(result.error || 'Purchase failed');
      }
    } catch (error) {
      console.error('Google Play purchase error:', error);
      toast.error('Failed to process Google Play payment');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (!subscription?.google_play_subscription_id) {
      toast.warning('No Google Play subscription found');
      return;
    }

    setIsRefreshing(true);
    try {
      const status = await googlePlayService.refreshSubscriptionStatus(subscription.google_play_subscription_id);
      
      if (status.status !== subscription.status) {
        await updateSubscriptionStatus(status.status);
        toast.success('Subscription status updated');
      } else {
        toast.info('Subscription status is up to date');
      }
    } catch (error) {
      console.error('Error refreshing status:', error);
      toast.error('Failed to refresh subscription status');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription?.google_play_subscription_id) return;

    const confirmed = window.confirm('Are you sure you want to cancel your Google Play subscription?');
    if (!confirmed) return;

    try {
      const result = await googlePlayService.cancelSubscription(subscription.google_play_subscription_id);
      
      if (result.success) {
        await updateSubscriptionStatus('canceled');
        toast.success('Subscription canceled successfully');
      } else {
        toast.error(result.error || 'Failed to cancel subscription');
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
      toast.error('Failed to cancel subscription');
    }
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const monthlyCost = calculateMonthlyCost(memberCount);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <ShoppingCart className="w-5 h-5" />
          <span>Google Play Store Integration</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Subscription Status */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <Badge variant={subscription?.status === 'active' ? 'default' : 'secondary'}>
              {subscription?.status || 'Not activated'}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-gray-500">Members</p>
            <p className="font-semibold">{memberCount}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Monthly Cost</p>
            <p className="font-semibold">{formatCurrency(monthlyCost)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Payment Method</p>
            <p className="font-semibold">
              {subscription?.google_play_subscription_id ? 'Google Play' : 'Not set'}
            </p>
          </div>
        </div>

        {/* Google Play Subscription Info */}
        {subscription?.google_play_subscription_id && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Google Play Subscription ID: {subscription.google_play_subscription_id}
            </AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {subscription?.status !== 'active' && (
            <Button
              onClick={handleGooglePlayPurchase}
              disabled={isProcessing}
              className="flex items-center space-x-2"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ShoppingCart className="w-4 h-4" />
              )}
              <span>{isProcessing ? 'Processing...' : 'Subscribe via Google Play'}</span>
            </Button>
          )}

          {subscription?.google_play_subscription_id && (
            <>
              <Button
                variant="outline"
                onClick={handleRefreshStatus}
                disabled={isRefreshing}
                className="flex items-center space-x-2"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Refresh Status</span>
              </Button>

              {subscription?.status === 'active' && (
                <Button
                  variant="destructive"
                  onClick={handleCancelSubscription}
                  className="flex items-center space-x-2"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Cancel Subscription</span>
                </Button>
              )}
            </>
          )}
        </div>

        {/* Pricing Information */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Google Play Store charges $0.10 per month for each active member in your organization. 
            Current cost: {formatCurrency(monthlyCost)} for {memberCount} members.
          </AlertDescription>
        </Alert>

        {/* Development Note */}
        <Alert>
          <AlertDescription className="text-sm text-gray-600">
            <strong>Note:</strong> This is a development implementation. In production, you would integrate 
            with the actual Google Play Billing Library and Google Play Developer API for real transactions.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
