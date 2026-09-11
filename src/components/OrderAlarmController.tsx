import { useEffect, useState, useCallback } from 'react';
import { useSession } from '@/ctx';
import { getProfile, getVendorByOwnerId } from '@/db/api';
import { supabase } from '@/client/supabase';
import { useLoopingAlarm } from '@/hooks/useLoopingAlarm';
import type { UserRole } from '@/types/types';

// How far ahead of a scheduled order's time the alarm is allowed to
// start treating it as urgent. Kept in sync by hand with the matching
// value in supabase/migrations/00038_scheduled_order_reminder.sql (the
// server-side repeat-alert job) and place-order's reminder logic — this
// lives in three different runtimes (client TS, plpgsql, Deno) so it
// can't be a single shared constant, just a value kept consistent
// across all three by convention.
const SCHEDULED_ALARM_LEAD_MINUTES = 30;

/**
 * Mounted once, at the top of the authenticated app shell (see
 * (app)/_layout.tsx) — NOT inside individual tab screens. This is
 * deliberate: the alarm needs to keep ringing no matter which screen
 * is currently focused (e.g. a vendor browsing their menu editor while
 * a new order comes in), not just while one particular order-list tab
 * happens to be open. It renders nothing.
 *
 * Vendor / Operator: alarm plays continuously while at least one
 * relevant order is 'Pending' AND is either an ASAP order
 * (scheduled_for is null) or a scheduled order within
 * SCHEDULED_ALARM_LEAD_MINUTES of its scheduled time. A scheduled order
 * placed hours in advance stays silent until it's actually close to
 * time — otherwise scheduling ahead would ring the vendor's phone
 * immediately, defeating the point of scheduling at all.
 *
 * Customer: alarm plays continuously while their order is 'Arrived at
 * Dropoff' and not yet acknowledged. Acknowledgement is written by the
 * Orders tab (src/app/(app)/(tabs)/orders.tsx) the moment that screen
 * loads with such an order visible — see the comment there for why
 * that's used as the "opened the order" signal in an app that doesn't
 * have a separate per-order detail screen.
 */
export function OrderAlarmController() {
  const { session } = useSession();
  const [role, setRole] = useState<UserRole | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [shouldAlarm, setShouldAlarm] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) { setRole(null); return; }
    getProfile(session.user.id).then((p) => setRole((p?.role as UserRole) ?? null));
  }, [session?.user?.id]);

  useEffect(() => {
    if (role !== 'Vendor' || !session?.user?.id) { setVendorId(null); return; }
    getVendorByOwnerId(session.user.id).then((v) => setVendorId(v?.id ?? null));
  }, [role, session?.user?.id]);

  const checkPending = useCallback(async () => {
    // An order counts as "urgent right now" if it's an ASAP order
    // (scheduled_for is null) or its scheduled time is within the lead
    // window from this exact moment.
    const cutoffIso = new Date(Date.now() + SCHEDULED_ALARM_LEAD_MINUTES * 60 * 1000).toISOString();
    const urgentFilter = `scheduled_for.is.null,scheduled_for.lte.${cutoffIso}`;

    if (role === 'Vendor' && vendorId) {
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', vendorId)
        .eq('status', 'Pending')
        .or(urgentFilter);
      setShouldAlarm((count ?? 0) > 0);
    } else if (role === 'Operator') {
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'Pending')
        .or(urgentFilter);
      setShouldAlarm((count ?? 0) > 0);
    }
  }, [role, vendorId]);

  const checkArrived = useCallback(async () => {
    if (role !== 'Customer' || !session?.user?.id) return;
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', session.user.id)
      .eq('status', 'Arrived at Dropoff')
      .is('customer_arrival_acknowledged_at', null);
    setShouldAlarm((count ?? 0) > 0);
  }, [role, session?.user?.id]);

  // Initial check whenever the relevant identity (role / vendorId) resolves.
  useEffect(() => {
    if (role === 'Vendor' && !vendorId) return; // wait for vendor lookup
    if (role === 'Vendor' || role === 'Operator') checkPending();
    else if (role === 'Customer') checkArrived();
    else setShouldAlarm(false);
  }, [role, vendorId, checkPending, checkArrived]);

  // Live updates via Realtime — catches the moment an order's row
  // actually changes (new order, status change, etc).
  useEffect(() => {
    if (!role) return;

    if (role === 'Vendor' || role === 'Operator') {
      if (role === 'Vendor' && !vendorId) return;
      const filter = role === 'Vendor' ? `vendor_id=eq.${vendorId}` : undefined;
      const config = filter
        ? { event: '*' as const, schema: 'public', table: 'orders', filter }
        : { event: '*' as const, schema: 'public', table: 'orders' };
      const channel = supabase
        .channel(`order-alarm-${role}-${vendorId ?? 'all'}`)
        .on('postgres_changes', config, checkPending)
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }

    if (role === 'Customer' && session?.user?.id) {
      const channel = supabase
        .channel(`order-alarm-customer-${session.user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${session.user.id}` }, checkArrived)
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [role, vendorId, session?.user?.id, checkPending, checkArrived]);

  // Periodic re-check for Vendor/Operator only — a scheduled order
  // crossing the "now within 30 minutes" threshold is a change in
  // TIME, not a change in the order row, so Realtime alone would never
  // notice it. Without this, a scheduled order would only start
  // alarming once something else happened to touch that row first.
  useEffect(() => {
    if (role !== 'Vendor' && role !== 'Operator') return;
    if (role === 'Vendor' && !vendorId) return;
    const interval = setInterval(checkPending, 60 * 1000);
    return () => clearInterval(interval);
  }, [role, vendorId, checkPending]);

  useLoopingAlarm(shouldAlarm);

  return null;
}
