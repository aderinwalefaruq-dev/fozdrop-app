-- ============================================================
-- Scheduled-order reminder + alarm suppression for far-out orders
-- ============================================================
-- Problem this fixes: the existing send_order_alert_repeats() function
-- (migration 00036) treated every 'Pending' order the same, regardless
-- of scheduled_for. That meant an order scheduled hours ahead would
-- start generating "still waiting" repeat pushes almost immediately —
-- exactly the alarm behavior a scheduled order should NOT trigger yet.
--
-- Fix: the "still pending" repeat loop now only fires for orders that
-- are either ASAP (scheduled_for is null) or within 30 minutes of their
-- scheduled time. A new third loop sends a single one-time "starts
-- soon" reminder exactly once, at that same 30-minute mark.

alter table public.orders
  add column if not exists scheduled_reminder_sent_at timestamptz;

create or replace function public.send_order_alert_repeats()
returns void
language plpgsql
security definer
as $$
declare
  r record;
  tokens text[];
begin
  -- ---- 1. Still-pending orders (ASAP, or scheduled orders within 30
  --         minutes of their time — far-out scheduled orders stay quiet) ----
  for r in
    select o.id, o.order_ref, o.vendor_id, v.owner_id as vendor_owner_id
    from public.orders o
    join public.vendors v on v.id = o.vendor_id
    where o.status = 'Pending'
      and (o.last_pending_alert_at is null or o.last_pending_alert_at < now() - interval '2 minutes')
      and o.created_at < now() - interval '2 minutes'
      and (o.scheduled_for is null or o.scheduled_for <= now() + interval '30 minutes')
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

  -- ---- 3. One-time "starts soon" reminder for scheduled orders ----
  -- Fires exactly once per order, right as it crosses the 30-minutes-
  -- before-scheduled-time mark, while it's still sitting Pending.
  for r in
    select o.id, o.order_ref, o.scheduled_for, v.owner_id as vendor_owner_id
    from public.orders o
    join public.vendors v on v.id = o.vendor_id
    where o.status = 'Pending'
      and o.scheduled_for is not null
      and o.scheduled_for <= now() + interval '30 minutes'
      and o.scheduled_reminder_sent_at is null
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
          'title', '⏰ Scheduled order starting soon',
          'body', 'Order #' || r.order_ref || ' is scheduled for ' ||
                  to_char(r.scheduled_for at time zone 'Africa/Lagos', 'HH12:MI AM') ||
                  ' — start preparing now.',
          'sound', 'order_alert.wav',
          'priority', 'high',
          'channelId', 'order-alerts',
          'data', jsonb_build_object('orderId', r.id, 'type', 'scheduled_reminder')
        )
      );
    end if;

    update public.orders set scheduled_reminder_sent_at = now() where id = r.id;
  end loop;
end;
$$;
