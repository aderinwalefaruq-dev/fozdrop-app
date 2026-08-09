import {
  View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useSession } from '@/ctx';
import { getVendorByOwnerId, getVendorOrders, updateOrderStatus, cancelOrder } from '@/db/api';
import type { Order, Vendor } from '@/types/types';
import { formatNaira } from '@/lib/utils/format';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';

const ORANGE = '#F25C19';
const CREAM = '#FAF6F0';

const STATUS_COLORS: Record<string, string> = {
  Pending: '#fef3c7',
  Preparing: '#dbeafe',
  'Out for Delivery': '#ede9fe',
  'Arrived at Dropoff': '#d1fae5',
  Completed: '#f0fdf4',
  Cancelled: '#fee2e2',
};
const STATUS_TEXT_COLORS: Record<string, string> = {
  Pending: '#92400e',
  Preparing: '#1d4ed8',
  'Out for Delivery': '#6d28d9',
  'Arrived at Dropoff': '#065f46',
  Completed: '#166534',
  Cancelled: '#991b1b',
};

// Vendor can advance: Pending → Preparing → Out for Delivery
const VENDOR_NEXT_STATUS: Partial<Record<Order['status'], Order['status']>> = {
  Pending: 'Preparing',
  Preparing: 'Out for Delivery',
};

// Vendor can only cancel Pending orders (food not started yet)
const VENDOR_CANCELLABLE: Order['status'][] = ['Pending'];

type FilterTab = 'Active' | 'All';

export default function VendorOrdersScreen() {
  const { session } = useSession();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>('Active');
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);

  const loadData = useCallback(async () => {
    if (!session?.user?.id) { setLoading(false); setRefreshing(false); return; }
    const v = await getVendorByOwnerId(session.user.id);
    setVendor(v);
    if (v) {
      const o = await getVendorOrders(v.id);
      setOrders(o);
    }
    setLoading(false);
    setRefreshing(false);
  }, [session]);

  useFocusEffect(useCallback(() => { setLoading(true); loadData(); }, [loadData]));

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleAdvanceStatus = async (order: Order) => {
    const next = VENDOR_NEXT_STATUS[order.status];
    if (!next) return;
    setUpdating(order.id);
    await updateOrderStatus(order.id, next);
    setUpdating(null);
    loadData();
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    const id = cancelTarget.id;
    setUpdating(id);
    setCancelTarget(null);
    await cancelOrder(id);
    setUpdating(null);
    loadData();
  };

  const displayed = filter === 'Active'
    ? orders.filter((o) => o.status === 'Pending' || o.status === 'Preparing')
    : orders;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: CREAM, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={ORANGE} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: CREAM }}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={{ backgroundColor: ORANGE, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20 }}>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>Incoming Orders</Text>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 2 }}>
          {vendor?.name || 'My Store'}
        </Text>
      </View>

      {/* Filter Tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
        {(['Active', 'All'] as FilterTab[]).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setFilter(tab)}
            style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: filter === tab ? ORANGE : '#f0f0f0' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: filter === tab ? '#fff' : '#555' }}>
              {tab}{tab === 'Active' ? ` (${orders.filter((o) => o.status === 'Pending' || o.status === 'Preparing').length})` : ` (${orders.length})`}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={displayed}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <Text style={{ fontSize: 44 }}>📋</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginTop: 14 }}>
              {filter === 'Active' ? 'No active orders' : 'No orders yet'}
            </Text>
            <Text style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
              {filter === 'Active' ? 'New orders will appear here' : 'Orders will show up once customers place them'}
            </Text>
          </View>
        }
        renderItem={({ item: order }) => (
          <VendorOrderCard
            order={order}
            onAdvance={() => handleAdvanceStatus(order)}
            onCancel={() => setCancelTarget(order)}
            updating={updating === order.id}
          />
        )}
      />

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) setCancelTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Cancel order #{cancelTarget?.order_ref}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setCancelTarget(null)}>
              Keep Order
            </AlertDialogCancel>
            <AlertDialogAction onPress={handleCancel} className="bg-destructive">
              Yes, Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}

function VendorOrderCard({
  order, onAdvance, onCancel, updating,
}: {
  order: Order; onAdvance: () => void; onCancel: () => void; updating: boolean;
}) {
  const nextStatus = VENDOR_NEXT_STATUS[order.status];
  const canCancel = VENDOR_CANCELLABLE.includes(order.status);
  const nextLabel: Record<string, string> = {
    'Preparing': 'Mark as Preparing',
    'Out for Delivery': 'Ready for Pickup',
  };

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 }}>
      {/* Order Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, paddingBottom: 10 }}>
        <View>
          <Text style={{ fontSize: 13, fontWeight: '900', color: '#1a1a1a' }}>#{order.order_ref}</Text>
          <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
            {new Date(order.created_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
            {' • '}
            {new Date(order.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
          </Text>
        </View>
        <View style={{ backgroundColor: STATUS_COLORS[order.status] || '#f5f5f5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: STATUS_TEXT_COLORS[order.status] || '#555' }}>
            {order.status}
          </Text>
        </View>
      </View>

      {/* Customer + Dropoff */}
      <View style={{ paddingHorizontal: 14, paddingBottom: 10, gap: 4 }}>
        <Text style={{ fontSize: 13, color: '#555' }}>
          👤 {(order.customer as { name?: string })?.name || 'Customer'}
        </Text>
        <Text style={{ fontSize: 13, color: '#555' }} numberOfLines={1}>
          📍 {(order.dropoff_location as { location_name?: string })?.location_name || 'Unknown location'}
        </Text>
        {order.delivery_notes ? (
          <Text style={{ fontSize: 12, color: '#888', fontStyle: 'italic' }}>📝 {order.delivery_notes}</Text>
        ) : null}
      </View>

      {/* Order Items */}
      <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
        {(order.order_items || []).map((item) => (
          <View key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
            <Text style={{ fontSize: 13, color: '#333', flex: 1 }} numberOfLines={1}>
              {item.quantity}× {item.item_name}
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#555' }}>{formatNaira(item.price * item.quantity)}</Text>
          </View>
        ))}
      </View>

      {/* Footer */}
      <View style={{ borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingHorizontal: 14, paddingVertical: 12, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: 11, color: '#888' }}>
              {order.packaging_fee > 0 ? 'Your earnings (incl. packaging)' : 'Subtotal (your earnings)'}
            </Text>
            <Text style={{ fontSize: 16, fontWeight: '900', color: ORANGE }}>
              {formatNaira(order.subtotal + (order.packaging_fee || 0))}
            </Text>
          </View>
          {nextStatus ? (
            <Pressable
              onPress={onAdvance}
              disabled={updating}
              style={{ backgroundColor: ORANGE, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, opacity: updating ? 0.7 : 1 }}>
              {updating
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{nextLabel[nextStatus] ?? nextStatus}</Text>}
            </Pressable>
          ) : (
            <View style={{ backgroundColor: STATUS_COLORS[order.status] || '#f5f5f5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}>
              <Text style={{ fontSize: 12, color: STATUS_TEXT_COLORS[order.status] || '#555', fontWeight: '700' }}>
                {order.status === 'Out for Delivery' ? '🛵 Runner picking up' : order.status === 'Cancelled' ? '❌ Cancelled' : '✅ Done'}
              </Text>
            </View>
          )}
        </View>

        {/* Cancel button — only for Pending orders */}
        {canCancel ? (
          <Pressable
            onPress={onCancel}
            disabled={updating}
            style={{ borderWidth: 1.5, borderColor: '#dc2626', borderRadius: 10, paddingVertical: 9, alignItems: 'center', opacity: updating ? 0.5 : 1 }}>
            <Text style={{ color: '#dc2626', fontWeight: '700', fontSize: 13 }}>❌ Cancel Order</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}


