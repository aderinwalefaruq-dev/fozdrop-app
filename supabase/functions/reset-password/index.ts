import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Rate limiting: track per-email attempts (resets when function cold-starts)
const emailAttempts = new Map<string, number[]>();
const MAX_ATTEMPTS = 3;
const WINDOW_MS = 60_000;

function isRateLimited(email: string): boolean {
  const now = Date.now();
  const attempts = (emailAttempts.get(email) ?? []).filter(t => now - t < WINDOW_MS);
  emailAttempts.set(email, attempts);
  return attempts.length >= MAX_ATTEMPTS;
}

function recordAttempt(email: string) {
  const now = Date.now();
  const attempts = (emailAttempts.get(email) ?? []).filter(t => now - t < WINDOW_MS);
  attempts.push(now);
  emailAttempts.set(email, attempts);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return json({ error: 'email is required' }, 400);
    }

    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return json({ error: 'Invalid email format' }, 400);
    }

    // Server-side rate limiting
    if (isRateLimited(trimmed)) {
      return json({ error: 'Too many requests. Please wait a minute before trying again.' }, 429);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const svc = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if user exists — prevents leaking emails but lets us log internally
    const { data: usersData } = await svc.auth.admin.listUsers();
    const userExists = usersData?.users?.some(
      (u) => u.email?.toLowerCase() === trimmed
    );

    console.log(`reset-password: request for ${trimmed}, exists=${userExists}`);

    if (!userExists) {
      // Anti-enumeration: return success even if email not found
      recordAttempt(trimmed);
      console.log(`reset-password: email not found, returning fake success`);
      return json({ success: true });
    }

    // Send reset email with explicit Web App Redirect URL
    const { error: resetError } = await svc.auth.resetPasswordForEmail(trimmed, {
      redirectTo: 'https://fozdrop-app.vercel.app/reset-password',
    });

    if (resetError) {
      console.error('reset-password error:', resetError);
      return json({ error: resetError.message }, 500);
    }

    recordAttempt(trimmed);
    console.log(`reset-password: email sent successfully to ${trimmed}`);

    return json({ success: true });

  } catch (err) {
    console.error('reset-password function error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});
