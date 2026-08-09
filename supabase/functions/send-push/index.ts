/**
 * send-push Edge Function
 *
 * Accepts:
 *   { targets: 'role', role: 'Operator'|'Vendor'|'Customer', title, body, url }
 *   { targets: 'user', userId: string, title, body, url }
 *
 * Uses RFC 8291 aes128gcm Web Push encryption + VAPID JWT (RFC 8292).
 * Compatible with Chrome/FCM, Firefox, Edge, Safari 16+.
 *
 * Key fixes vs previous version:
 *  - Switched from deprecated `aesgcm` to `aes128gcm` (RFC 8291) which FCM requires
 *  - Correct HKDF info strings for aes128gcm
 *  - Content-Encoding header is now `aes128gcm` (no separate Encryption/Crypto-Key headers)
 *  - Authorization uses `vapid` scheme (not `WebPush`)
 *  - Stale subscriptions (410/404) are auto-deleted from DB
 *  - Full per-subscription error logging for diagnostics
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

  // Generate ephemeral server key pair
  const serverKP = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const serverPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", serverKP.publicKey));

  // Import client public key
  const clientPub = await crypto.subtle.importKey(
    "raw", b64urlToBytes(p256dhB64),
    { name: "ECDH", namedCurve: "P-256" }, false, []
  );

  // ECDH shared secret
  const ikm = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientPub }, serverKP.privateKey, 256
  ));

  const authSecret = b64urlToBytes(authB64);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const clientPubRaw = b64urlToBytes(p256dhB64);

  // RFC 8291 §3.3 — PRK using HKDF-SHA-256
  // PRK_key = HKDF(salt=auth_secret, IKM=ecdh_secret, info="WebPush: info\0"||ua_pub||as_pub, L=32)
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

  // key_info for aes128gcm
  const keyInfo = buildKeyInfo();

  const prkExpKey = await crypto.subtle.importKey("raw", prk, { name: "HKDF" }, false, ["deriveBits"]);

  // CEK: HKDF-Expand(PRK, cek_info || 0x01, 16)
  const cekInfo = concat(keyInfo, new Uint8Array([1]));
  const cekBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: cekInfo },
    prkExpKey, 128
  );

  // Nonce: HKDF-Expand(PRK, nonce_info || 0x01, 12)
  const nonceInfo = concat(buildNonceInfo(), new Uint8Array([1]));
  const nonceBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: nonceInfo },
    prkExpKey, 96
  );

  const cek = await crypto.subtle.importKey("raw", cekBits, { name: "AES-GCM" }, false, ["encrypt"]);

  // RFC 8291 §4 — padding delimiter byte 0x02 (last record)
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
  // RFC 8291 §3.3: cek_info = "Content-Encoding: aes128gcm\0"
  return new TextEncoder().encode("Content-Encoding: aes128gcm\0");
}

function buildNonceInfo(): Uint8Array {
  // RFC 8291 §3.3: nonce_info = "Content-Encoding: nonce\0"
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
// salt (16) || rs (4, BE) || idlen (1) || keyid (idlen)

function buildRecordHeader(salt: Uint8Array, serverPubRaw: Uint8Array): Uint8Array {
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false); // record size 4096
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

    const { targets, role, userId, title, body: msgBody, url } = await req.json();

    // Fetch target subscriptions — include id for stale-subscription cleanup
    let query = svc.from("push_subscriptions").select("id, endpoint, p256dh, auth_key");
    if (targets === "role") {
      query = query.eq("user_role", role);
    } else if (targets === "user") {
      query = query.eq("user_id", userId);
    } else {
      return json({ error: "Invalid targets" }, 400);
    }

    const { data: subs, error: subErr } = await query;
    if (subErr) { console.error("send-push: DB query error", subErr); return json({ error: subErr.message }, 500); }
    if (!subs || subs.length === 0) {
      console.log(`send-push: no subscriptions found (targets=${targets}, role=${role ?? userId})`);
      return json({ sent: 0, total: 0 });
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
            // 404/410 = subscription expired — clean up
            if (result.status === 404 || result.status === 410) {
              staleEndpoints.push(sub.endpoint);
            }
          }
        } catch (err) {
          console.error(`send-push: exception for ${sub.endpoint.slice(0, 60)}:`, err);
        }
      })
    );

    // Remove stale subscriptions
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
