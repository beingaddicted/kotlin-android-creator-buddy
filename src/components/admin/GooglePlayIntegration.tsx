
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { googlePlayService, Product } from '@/services/GooglePlayService';
import { useSubscription } from '@/hooks/useSubscription';
import { ShoppingCart, RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { LoadingSpinner } from '../LoadingSpinner';

interface GooglePlayIntegrationProps {
  organizationId: string;
  memberCount: number;
}

// IMPORTANT: Replace with your actual product ID from Google Play Console
const GOOGLE_PLAY_PRODUCT_ID = 'your_monthly_subscription_id';

export const GooglePlayIntegration = ({ organizationId, memberCount }: GooglePlayIntegrationProps) => {
  const { subscription, updateSubscriptionStatus } = useSubscription(organizationId);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(true);

  useEffect(() => {
    const initBilling = async () => {
      setIsLoadingProduct(true);
      await googlePlayService.initialize();
      try {
        const details = await googlePlayService.getProductDetails(GOOGLE_PLAY_PRODUCT_ID);
        if (details) {
          setProduct(details);
        } else {
          toast.error('Could not load subscription details from Google Play.');
        }
      } catch (error) {
        console.error("Failed to fetch product details", error);
        toast.error("Could not load subscription details from Google Play.");
      } finally {
        setIsLoadingProduct(false);
      }
    };
    initBilling();
  }, []);

  const handleGooglePlayPurchase = async () => {
    setIsProcessing(true);
    try {
      toast.info('Initiating Google Play purchase...');
      
      const result = await googlePlayService.purchaseSubscription(GOOGLE_PLAY_PRODUCT_ID);
      
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
    setIsRefreshing(true);
    try {
      const purchases = await googlePlayService.refreshSubscriptionStatus();
      const activePurchase = purchases.find(p => p.sku === GOOGLE_PLAY_PRODUCT_ID);

      if (activePurchase && subscription?.status !== 'active') {
          await updateSubscriptionStatus('active', activePurchase.orderId || subscription?.google_play_subscription_id, 'google_play');
          toast.success('Subscription status updated to active.');
      } else if (!activePurchase && subscription?.status === 'active') {
          await updateSubscriptionStatus('canceled');
          toast.info('Subscription no longer active.');
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

  const handleCancelSubscription = () => {
    toast.info('To cancel your subscription, please go to the Google Play Store app on your device.');
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <ShoppingCart className="w-5 h-5" />
          <span>Google Play Store Integration</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoadingProduct ? <LoadingSpinner /> : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <Badge variant={subscription?.status === 'active' ? 'default' : 'secondary'}>
                  {subscription?.status || 'Not activated'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Plan</p>
                <p className="font-semibold">{product?.title || 'Monthly'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Price</p>
                <p className="font-semibold">{product?.price || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Payment Method</p>
                <p className="font-semibold">
                  {subscription?.google_play_subscription_id ? 'Google Play' : 'Not set'}
                </p>
              </div>
            </div>

            {subscription?.google_play_subscription_id && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Google Play Subscription ID: {subscription.google_play_subscription_id}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap gap-3">
              {subscription?.status !== 'active' && product && (
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
                  <span>{isProcessing ? 'Processing...' : `Subscribe for ${product.price}`}</span>
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
            
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Subscriptions are managed through your Google Play account. 
                {product?.description}
              </AlertDescription>
            </Alert>
          </>
        )}
      </CardContent>
    </Card>
  );
};
