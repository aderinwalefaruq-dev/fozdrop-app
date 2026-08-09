import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { amount, email } = await req.json();
    if (!amount || !email) {
      return new Response(JSON.stringify({ error: 'amount and email are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (Number(amount) <= 0) {
      return new Response(JSON.stringify({ error: 'amount must be greater than zero' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!PAYSTACK_SECRET_KEY) {
      return new Response(JSON.stringify({ error: 'Paystack not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Paystack expects amount in kobo (1 NGN = 100 kobo)
    // We pass the user's intended net amount directly.
    // Paystack adds its fee on top and charges the customer the gross amount.
    // On verify, we read requested_amount (net) and fees separately.
    const amountKobo = Math.round(amount * 100);

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountKobo,
        currency: 'NGN',
        channels: ['card', 'bank', 'ussd', 'bank_transfer'],
        // subaccount not used — flat fee model, we read requested_amount on verify
        metadata: {
          custom_fields: [
            { display_name: 'App', variable_name: 'app', value: 'Fozdrop' },
            { display_name: 'Intended Top-up', variable_name: 'intended_topup', value: `${amount}` },
          ],
        },
      }),
    });

    const data = await res.json();
    if (!data.status) {
      return new Response(JSON.stringify({ error: data.message || 'Paystack initialization failed' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      authorization_url: data.data.authorization_url,
      access_code: data.data.access_code,
      reference: data.data.reference,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
