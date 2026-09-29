/**
 * send-push Edge Function
 *
 * Accepts:
 *   { targets: 'all' | 'broadcast', title, body, url }
 *   { targets: 'role', role: 'Customer'|'Vendor'|'Runner'|'Customers'|'Vendors'|'Riders', title, body, url }
 *   { targets: 'user', userId: string, title, body, url }
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Utility ───────────────────────────────────────────────────────────────────

function b64urlToBytes(b64: string): Uint8Array {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function bytesToB64url(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function jsonB64url(obj: unknown): string {
  return bytesToB64url(new TextEncoder().encode(JSON.stringify(obj)));
}

// ── VAPID JWT (RFC 8292) ──────────────────────────────────────────────────────

async function makeVapidJwt(audience: string, subject: string, privateKeyPkcs8B64: string): Promise<string> {
  const header  = jsonB64url({ typ: "JWT", alg: "ES256" });
  const payload = jsonB64url({ aud: audience, exp: Math.floor(Date.now() / 1000) + 43200, sub: subject });
  const sigInput = `${header}.${payload}`;

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    b64urlToBytes(privateKeyPkcs8B64),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(sigInput)
  );
  return `${sigInput}.${bytesToB64url(new Uint8Array(sig))}`;
}

// ── RFC 8291 aes128gcm payload encryption ────────────────────────────────────

async function encryptPayload(
  plaintext: string,
  p256dhB64: string,
  authB64: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPubRaw: Uint8Array }> {
  const enc = new TextEncoder();

  const serverKP = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const serverPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", serverKP.publicKey));

  const clientPub = await crypto.subtle.importKey(
    "raw", b64urlToBytes(p256dhB64),
    { name: "ECDH", namedCurve: "P-256" }, false, []
  );

  const ikm = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientPub }, serverKP.privateKey, 256
  ));

  const authSecret = b64urlToBytes(authB64);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const clientPubRaw = b64urlToBytes(p256dhB64);

  const webPushInfo = concat(
    enc.encode("WebPush: info\0"),
    clientPubRaw,
    serverPubRaw
  );
  const prkExtractKey = await crypto.subtle.importKey("raw", ikm, { name: "HKDF" }, false, ["deriveBits"]);
  const prk = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: authSecret, info: webPushInfo },
    prkExtractKey, 256
  );

  const keyInfo = buildKeyInfo();
  const prkExpKey = await crypto.subtle.importKey("raw", prk, { name: "HKDF" }, false, ["deriveBits"]);

  const cekInfo = concat(keyInfo, new Uint8Array([1]));
  const cekBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: cekInfo },
    prkExpKey, 128
  );

  const nonceInfo = concat(buildNonceInfo(), new Uint8Array([1]));
  const nonceBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: nonceInfo },
    prkExpKey, 96
  );

  const cek = await crypto.subtle.importKey("raw", cekBits, { name: "AES-GCM" }, false, ["encrypt"]);

  const pt = enc.encode(plaintext);
  const padded = new Uint8Array(pt.length + 1);
  padded.set(pt);
  padded[pt.length] = 0x02;

  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: new Uint8Array(nonceBits) },
    cek, padded
  );

  return { ciphertext: new Uint8Array(ciphertextBuf), salt, serverPubRaw };
}

function buildKeyInfo(): Uint8Array {
  return new TextEncoder().encode("Content-Encoding: aes128gcm\0");
}

function buildNonceInfo(): Uint8Array {
  return new TextEncoder().encode("Content-Encoding: nonce\0");
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

// ── RFC 8291 §2 — aes128gcm record layer header ──────────────────────────────

function buildRecordHeader(salt: Uint8Array, serverPubRaw: Uint8Array): Uint8Array {
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  const idLen = new Uint8Array([serverPubRaw.length]);
  return concat(salt, rs, idLen, serverPubRaw);
}

// ── Single push dispatch ──────────────────────────────────────────────────────

async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth_key: string },
  payload: string,
  vapidPublicRaw: string,
  vapidPrivatePkcs8: string,
  vapidSubject: string
): Promise<{ ok: boolean; status: number; body: string }> {
  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const jwt = await makeVapidJwt(audience, vapidSubject, vapidPrivatePkcs8);

  const { ciphertext, salt, serverPubRaw } = await encryptPayload(payload, sub.p256dh, sub.auth_key);
  const header = buildRecordHeader(salt, serverPubRaw);
  const body = concat(header, ciphertext);

  const resp = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "Authorization": `vapid t=${jwt},k=${vapidPublicRaw}`,
      "TTL": "86400",
    },
    body,
  });

  const respBody = await resp.text().catch(() => "");
  return { ok: resp.ok, status: resp.status, body: respBody };
}

// ── Helper to normalize target role inputs ───────────────────────────────────

function getMatchingRoles(rawRole: string): string[] {
  const r = (rawRole || "").toLowerCase().trim();
  if (r.includes("customer")) return ["Customer", "customer"];
  if (r.includes("vendor")) return ["Vendor", "vendor"];
  if (r.includes("rider") || r.includes("runner")) return ["Runner", "Rider", "runner", "rider", "Delivery Runner"];
  return [rawRole];
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const vapidPublic  = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:fozdropdelivery@gmail.com";

    if (!vapidPublic || !vapidPrivate) {
      console.error("send-push: VAPID keys not set in environment");
      return json({ error: "VAPID keys not configured" }, 500);
    }

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { targets, role, userId, title, body: msgBody, url } = body;

    let query = svc.from("push_subscriptions").select("id, endpoint, p256dh, auth_key");

    // Fix: Handle 'all', 'broadcast', missing targets, or role = 'all'
    const targetType = (targets || "").toLowerCase();
    const roleType = (role || "").toLowerCase();

    if (targetType === "all" || targetType === "broadcast" || roleType === "all" || roleType === "all users") {
      // Select all subscriptions without filter
    } else if (targetType === "role") {
      const allowedRoles = getMatchingRoles(role);
      query = query.in("user_role", allowedRoles);
    } else if (targetType === "user") {
      query = query.eq("user_id", userId);
    } else {
      // Fallback: If targets is omitted or unknown, fetch all subscriptions rather than failing 400
      console.warn(`send-push: Unknown targets "${targets}", default to all subscriptions`);
    }

    const { data: subs, error: subErr } = await query;
    if (subErr) { 
      console.error("send-push: DB query error", subErr); 
      return json({ error: subErr.message }, 500); 
    }

    if (!subs || subs.length === 0) {
      console.log(`send-push: no subscriptions found (targets=${targets}, role=${role ?? userId})`);
      return json({ sent: 0, total: 0, message: "No active push subscriptions found" });
    }

    const payloadStr = JSON.stringify({ title, body: msgBody, url: url ?? "/" });

    const staleEndpoints: string[] = [];
    let sent = 0;

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          const result = await sendWebPush(sub, payloadStr, vapidPublic, vapidPrivate, vapidSubject);
          if (result.ok) {
            sent++;
            console.log(`send-push: ✓ delivered to ${sub.endpoint.slice(0, 60)}...`);
          } else {
            console.warn(`send-push: ✗ HTTP ${result.status} for ${sub.endpoint.slice(0, 60)} — ${result.body}`);
            if (result.status === 404 || result.status === 410) {
              staleEndpoints.push(sub.endpoint);
            }
          }
        } catch (err) {
          console.error(`send-push: exception for ${sub.endpoint.slice(0, 60)}:`, err);
        }
      })
    );

    if (staleEndpoints.length > 0) {
      await svc.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
      console.log(`send-push: removed ${staleEndpoints.length} stale subscription(s)`);
    }

    console.log(`send-push: ${sent}/${subs.length} delivered (targets=${targets}, role=${role ?? userId})`);
    return json({ sent, total: subs.length, staleRemoved: staleEndpoints.length });

  } catch (err) {
    console.error("send-push unhandled error:", err);
    return json({ error: String(err) }, 500);
  }
});