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

    // Use Admin API to generate reset link — this bypasses redirectTo allowlist requirement
    const { data: linkData, error: linkError } = await svc.auth.admin.generateLink({
      type: 'recovery',
      email: trimmed,
      options: {
        redirectTo: 'fozdropdelivery://reset-password',
      },
    });

    if (linkError) {
      console.error('reset-password: generateLink error:', linkError);
      return json({ error: linkError.message }, 500);
    }

    recordAttempt(trimmed);
    console.log(`reset-password: link generated for ${trimmed}, token_hash=${linkData?.properties?.hashed_token?.slice(0, 8)}...`);

    // Send the email using Supabase's built-in mailer via the reset link
    // The generateLink response contains action_link — we email it ourselves
    // OR we use the lower-level resetPasswordForEmail which triggers Supabase's mailer
    // generateLink alone doesn't send email; use admin.resetPasswordForEmail via REST
    const resetRes = await fetch(`${supabaseUrl}/auth/v1/recover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        email: trimmed,
        gotrue_meta_security: {},
      }),
    });

    const resetBody = await resetRes.text();
    console.log(`reset-password: /auth/v1/recover status=${resetRes.status} body=${resetBody}`);

    if (!resetRes.ok) {
      let errMsg = 'Failed to send reset email';
      try {
        const parsed = JSON.parse(resetBody);
        errMsg = parsed.msg || parsed.message || parsed.error_description || errMsg;
      } catch { /* ignore */ }
      return json({ error: errMsg }, resetRes.status);
    }

    return json({ success: true });

  } catch (err) {
    console.error('reset-password function error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});
