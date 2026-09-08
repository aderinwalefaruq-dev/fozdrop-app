-- ============================================================
-- Native push infrastructure + timed re-alert system
-- ============================================================
-- IMPORTANT: this is separate from the existing push_subscriptions /
-- send-push setup, which is Web Push (VAPID) — a browser-only API that
-- does not run inside a compiled native iOS/Android app. Nothing here
-- modifies or depends on that table; this adds a parallel pipeline for
-- native push (Expo push tokens, backed by FCM on Android / APNs on iOS).

-- ---- Native device push tokens ----
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_tokens_user_id on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

create policy "push_tokens_manage_own" on public.push_tokens
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---- Re-alert bookkeeping on orders ----
alter table public.orders
  add column if not exists last_pending_alert_at timestamptz,
  add column if not exists last_arrival_alert_at timestamptz,
  add column if not exists customer_arrival_acknowledged_at timestamptz;

-- ============================================================
-- Scheduled re-alert function — runs every minute via pg_cron.
-- ============================================================
-- 1. Orders still 'Pending' after 2+ minutes since the last alert (or
--    since creation, if never alerted) -> re-pings the vendor's owner
--    + every Operator.
-- 2. Orders 'Arrived at Dropoff', not yet acknowledged by the customer,
--    3+ minutes since the last alert -> re-pings the customer.
--
-- Sends straight to Expo's push API via pg_net (no API key needed for
-- basic sends) rather than through an Edge Function, keeping this
-- self-contained inside Postgres. The 'sound' value below must match
-- the filename you bundle via the expo-notifications config plugin
-- (see app.json) — see the project README for the exact asset needed.
create or replace function public.send_order_alert_repeats()
returns void
language plpgsql
security definer
as $$
declare
  r record;
  tokens text[];
begin
  -- ---- 1. Still-pending orders ----
  for r in
    select o.id, o.order_ref, o.vendor_id, v.owner_id as vendor_owner_id
    from public.orders o
    join public.vendors v on v.id = o.vendor_id
    where o.status = 'Pending'
      and (o.last_pending_alert_at is null or o.last_pending_alert_at < now() - interval '2 minutes')
      and o.created_at < now() - interval '2 minutes'
  loop
    select array_agg(pt.expo_push_token) into tokens
    from public.push_tokens pt
    join public.profiles p on p.id = pt.user_id
    where pt.user_id = r.vendor_owner_id or p.role = 'Operator';

    if tokens is not null and array_length(tokens, 1) > 0 then
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'to', tokens,
          'title', 'Still waiting — Order #' || r.order_ref,
          'body', 'This order has not been accepted yet. Please take action.',
          'sound', 'order_alert.wav',
          'priority', 'high',
          'channelId', 'order-alerts',
          'data', jsonb_build_object('orderId', r.id, 'type', 'pending_repeat')
        )
      );
    end if;

    update public.orders set last_pending_alert_at = now() where id = r.id;
  end loop;

  -- ---- 2. Arrived-at-dropoff orders awaiting customer acknowledgement ----
  for r in
    select o.id, o.order_ref, o.customer_id
    from public.orders o
    where o.status = 'Arrived at Dropoff'
      and o.customer_arrival_acknowledged_at is null
      and (o.last_arrival_alert_at is null or o.last_arrival_alert_at < now() - interval '3 minutes')
  loop
    select array_agg(pt.expo_push_token) into tokens
    from public.push_tokens pt
    where pt.user_id = r.customer_id;

    if tokens is not null and array_length(tokens, 1) > 0 then
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'to', tokens,
          'title', 'Your order has arrived! 📍',
          'body', 'Order #' || r.order_ref || ' is waiting at your dropoff location.',
          'sound', 'order_alert.wav',
          'priority', 'high',
          'channelId', 'order-alerts',
          'data', jsonb_build_object('orderId', r.id, 'type', 'arrival_repeat')
        )
      );
    end if;

    update public.orders set last_arrival_alert_at = now() where id = r.id;
  end loop;
end;
$$;

-- ============================================================
-- Enable required extensions + schedule the job
-- ============================================================
-- If either of these two lines errors in the SQL editor, enable them
-- instead via Supabase Dashboard -> Database -> Extensions (search
-- "pg_cron" and "pg_net", toggle both on), then re-run just the
-- schedule block below.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Idempotent: drop any existing schedule of the same name first, so
-- this migration is safe to re-run.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'order-alert-repeats') then
    perform cron.unschedule('order-alert-repeats');
  end if;
end $$;

select cron.schedule(
  'order-alert-repeats',
  '* * * * *', -- every minute
  $$select public.send_order_alert_repeats();$$
);
