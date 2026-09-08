import { useEffect, useState, useCallback } from 'react';
import { useSession } from '@/ctx';
import { getProfile, getVendorByOwnerId } from '@/db/api';
import { supabase } from '@/client/supabase';
import { useLoopingAlarm } from '@/hooks/useLoopingAlarm';
import type { UserRole } from '@/types/types';

/**
 * Mounted once, at the top of the authenticated app shell (see
 * (app)/_layout.tsx) — NOT inside individual tab screens. This is
 * deliberate: the alarm needs to keep ringing no matter which screen
 * is currently focused (e.g. a vendor browsing their menu editor while
 * a new order comes in), not just while one particular order-list tab
 * happens to be open. It renders nothing.
 *
 * Vendor / Operator: alarm plays continuously while at least one
 * relevant order is 'Pending'. Stops the instant that count reaches
 * zero (i.e. every pending order has been accepted/moved on).
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
    if (role === 'Vendor' && vendorId) {
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', vendorId)
        .eq('status', 'Pending');
      setShouldAlarm((count ?? 0) > 0);
    } else if (role === 'Operator') {
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'Pending');
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

  // Live updates via Realtime — this app didn't previously use Realtime
  // anywhere; without this, the alarm would only re-check on the
  // occasional focus-triggered refetch elsewhere, not the moment a
  // relevant order actually changes.
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

  useLoopingAlarm(shouldAlarm);

  return null;
}
