
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { google } from 'npm:googleapis'
import { supabase } from '@/integrations/supabase/client.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { purchaseToken, productId, packageName } = await req.json()

    if (!purchaseToken || !productId || !packageName) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }
    
    // IMPORTANT: You must set GOOGLE_SERVICE_ACCOUNT_JSON in Supabase project secrets
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if (!serviceAccountJson) {
        console.error('Missing GOOGLE_SERVICE_ACCOUNT_JSON secret');
        return new Response(JSON.stringify({ error: 'Server configuration error' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
    
    const serviceAccount = JSON.parse(serviceAccountJson);

    const jwt = new google.auth.JWT(
      serviceAccount.client_email,
      null,
      serviceAccount.private_key,
      ['https://www.googleapis.com/auth/androidpublisher']
    );

    const androidPublisher = google.androidpublisher({
      version: 'v3',
      auth: jwt,
    });

    const verification = await androidPublisher.purchases.subscriptions.get({
      packageName: packageName,
      subscriptionId: productId,
      token: purchaseToken,
    });

    if (verification.status === 200 && verification.data) {
        // Purchase is valid
        return new Response(JSON.stringify({ valid: true, data: verification.data }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    } else {
        // Purchase is invalid
        return new Response(JSON.stringify({ valid: false, error: 'Purchase verification failed' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }

  } catch (error) {
    console.error('Error validating Google Play purchase:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
