/**
 * Only SuperFoods — Razorpay Order Creation Edge Function
 * Creates a server-side Razorpay Order with authenticated price and order details.
 */

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const keyId = Deno.env.get('RAZORPAY_KEY_ID') || Deno.env.get('PUBLIC_RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!keyId || !keySecret) {
      return new Response(
        JSON.stringify({
          error: 'Razorpay API credentials not configured in edge function environment.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { amount, orderNumber, customerName, customerPhone, notes } = await req.json();

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid order amount.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const authHeader = btoa(`${keyId}:${keySecret}`);
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(Number(amount) * 100), // convert to paise
        currency: 'INR',
        receipt: orderNumber || `OSF-${Date.now()}`,
        notes: {
          order_number: orderNumber || '',
          customer_name: customerName || 'Valued Customer',
          customer_phone: customerPhone || '',
          ...(notes || {}),
        },
      }),
    });

    const rzpData = await rzpRes.json();

    if (!rzpRes.ok) {
      console.error('[Create Razorpay Order Error]', rzpData);
      return new Response(
        JSON.stringify({ error: rzpData.error?.description || 'Failed to create Razorpay order.' }),
        {
          status: rzpRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        order_id: rzpData.id,
        amount: rzpData.amount,
        currency: rzpData.currency,
        key_id: keyId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('[Create Razorpay Order Exception]', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

