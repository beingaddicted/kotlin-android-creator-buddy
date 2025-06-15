
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

let Billing: any = null;
let Purchase: any = null;

// Dynamically import billing only on native platforms
const initializeBilling = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      const billingModule = await import('@capacitor-community/billing');
      Billing = billingModule.Billing;
      Purchase = billingModule.Purchase;
      return true;
    } catch (error) {
      console.warn('Billing plugin not available:', error);
      return false;
    }
  }
  return false;
};

export interface Product {
  productId: string;
  title?: string;
  description?: string;
  price?: string;
  priceAmountMicros?: number;
  currency?: string;
}

export class GooglePlayService {
  private static instance: GooglePlayService;
  private isInitialized = false;
  private products = new Map<string, Product>();

  static getInstance(): GooglePlayService {
    if (!GooglePlayService.instance) {
      GooglePlayService.instance = new GooglePlayService();
    }
    return GooglePlayService.instance;
  }

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    
    const billingAvailable = await initializeBilling();
    if (!billingAvailable || !Billing) {
      console.warn('Google Play Billing not available on this platform');
      return false;
    }

    try {
      await Billing.initialize();
      this.isInitialized = true;
      console.log('Google Play Billing Initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize Google Play Billing:', error);
      return false;
    }
  }

  async getProductDetails(productId: string): Promise<Product | undefined> {
    if (!Capacitor.isNativePlatform() || !Billing) {
      console.warn('Google Play Billing not available on this platform');
      return undefined;
    }

    if (!this.isInitialized) await this.initialize();
    if (this.products.has(productId)) {
        return this.products.get(productId);
    }
    try {
      const { products } = await Billing.getProducts({ skus: [productId] });
      if (products && products.length > 0) {
        const product = products[0];
        this.products.set(productId, product);
        return product;
      }
    } catch (error) {
      console.error('Failed to get product details:', error);
    }
    return undefined;
  }

  async purchaseSubscription(productId: string): Promise<{
    success: boolean;
    subscriptionId?: string;
    error?: string;
  }> {
    if (!Capacitor.isNativePlatform() || !Billing) {
      return {
        success: false,
        error: 'Google Play Billing not available on this platform'
      };
    }

    if (!this.isInitialized) await this.initialize();

    try {
      const purchase = await Billing.purchase({ sku: productId });
      
      const validationResult = await this.validatePurchase(purchase.purchaseToken, purchase.sku);

      if (validationResult.valid) {
        await Billing.acknowledgePurchase({ token: purchase.purchaseToken });
        
        return {
          success: true,
          subscriptionId: validationResult.subscriptionData?.orderId || `gp_sub_${Date.now()}`
        };
      } else {
        return {
          success: false,
          error: 'Purchase validation failed.'
        };
      }
    } catch (error) {
      console.error('Google Play purchase failed:', error);
      return {
        success: false,
        error: 'Purchase failed or cancelled. Please try again.'
      };
    }
  }

  async refreshSubscriptionStatus(): Promise<any[]> {
    if (!Capacitor.isNativePlatform() || !Billing) {
      console.warn('Google Play Billing not available on this platform');
      return [];
    }

    if (!this.isInitialized) await this.initialize();
    try {
      const result = await Billing.getPurchases();
      return result.purchases || [];
    } catch (error) {
      console.error('Failed to refresh subscription status:', error);
      return [];
    }
  }

  async validatePurchase(purchaseToken: string, productId: string): Promise<{
    valid: boolean;
    subscriptionData?: any;
    error?: string;
  }> {
    try {
        const { data, error } = await supabase.functions.invoke('google-play-validator', {
            body: {
                purchaseToken,
                productId,
                packageName: 'app.lovable.bcd1eb8b14f5447a94a2bc357ec4de2b',
            }
        });

        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('Failed to validate purchase via edge function:', error);
        return {
            valid: false,
            error: 'Purchase validation failed'
        };
    }
  }
}

export const googlePlayService = GooglePlayService.getInstance();
