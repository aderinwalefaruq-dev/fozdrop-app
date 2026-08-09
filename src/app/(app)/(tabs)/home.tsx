import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useFocusEffect, Redirect } from 'expo-router';
import { useCallback, useState } from 'react';
import type { RelativePathString } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSession } from '@/ctx';
import { getProfile, getVendors, getVendorOrders, getOperatorOrders, getVendorByOwnerId, updateVendorStatus, getAppIsOpen, setAppIsOpen } from '@/db/api';
import type { Profile, Vendor, Order } from '@/types/types';
import { formatNaira } from '@/lib/utils/format';
const ORANGE = '#F25C19';
const CREAM = '#FAF6F0';

export default function HomeTab() {
  const { session } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [myVendor, setMyVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [appIsOpen, setAppIsOpen] = useState(true);

  const loadData = useCallback(async () => {
    if (!session?.user?.id) { setLoading(false); setRefreshing(false); return; }
    const [p, v, open] = await Promise.all([
      getProfile(session.user.id),
      getVendors(),
      getAppIsOpen(),
    ]);
    setProfile(p);
    setVendors(v);
    setAppIsOpen(open);
    if (p?.role === 'Vendor') {
      const vendorRecord = await getVendorByOwnerId(session.user.id);
      setMyVendor(vendorRecord);
      if (vendorRecord) {
        const o = await getVendorOrders(vendorRecord.id);
        setOrders(o);
      }
    } else if (p?.role === 'Operator') {
      const o = await getOperatorOrders();
      setOrders(o);
    }
    // Admin, Customer, or any other role — always clear the loading flag.
    // Without this guard, role='Admin' had no branch and loading stayed true
    // forever, causing a permanent blank dark spinner screen.
    setLoading(false);
    setRefreshing(false);
  }, [session]);

  useFocusEffect(useCallback(() => { setLoading(true); loadData(); }, [loadData]));

  const onRefresh = () => { setRefreshing(true); loadData(); };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: CREAM, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={ORANGE} />
      </View>
    );
  }

  // Safety net: Admin users must never land here — send them to the portal.
  // This covers the edge case where an Admin bypasses the (auth)/_layout.tsx
  // redirect (e.g. direct deep-link, cached route) and reaches this screen.
  if (profile?.role === 'Admin') {
    return <Redirect href={'/(super-admin)' as RelativePathString} />;
  }

// Vendor / Operator Dashboard
  if (profile?.role === 'Vendor' || profile?.role === 'Operator') {
    return (
      <VendorOperatorDashboard profile={profile} orders={orders} myVendor={myVendor} onRefresh={onRefresh} refreshing={refreshing} router={router} reloadDashboard={loadData} appIsOpen={appIsOpen} />
    );
  }
  // Customer Home — show closed banner if app is off
  return (
    <View style={{ flex: 1, backgroundColor: CREAM }}>
      <StatusBar style="dark" />
      {/* Header */}
      <View style={{ backgroundColor: ORANGE, paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 }}>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>Good day,</Text>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{profile?.name || 'Campus Foodie'} 👋</Text>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 }}>What are you craving today?</Text>
      </View>

      {/* App-closed banner */}
      {!appIsOpen && (
        <View style={{ backgroundColor: '#fee2e2', margin: 16, borderRadius: 14, padding: 20, alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 36 }}>🔒</Text>
          <Text style={{ fontSize: 17, fontWeight: '900', color: '#dc2626', textAlign: 'center' }}>We are currently closed</Text>
          <Text style={{ fontSize: 13, color: '#7f1d1d', textAlign: 'center', lineHeight: 20 }}>
            Fozdrop is not accepting orders right now. Please check back later — we'll be open again soon!
          </Text>
        </View>
      )}

      <FlatList
        data={vendors}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />}
        ListHeaderComponent={
          <Text style={{ fontSize: 17, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 }}>
            Featured Cafeterias
          </Text>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Text style={{ fontSize: 40 }}>🍽️</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginTop: 12 }}>No vendors yet</Text>
            <Text style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Check back soon for campus food vendors</Text>
          </View>
        }
        renderItem={({ item }) => (
          <VendorCard
            vendor={item}
            appIsOpen={appIsOpen}
            onPress={() => router.push(`/(app)/vendor/${item.id}`)}
          />
        )}
      />
    </View>
  );
}

function VendorCard({ vendor, appIsOpen, onPress }: { vendor: Vendor; appIsOpen: boolean; onPress: () => void }) {
  const vendorOpen = vendor.status === 'Open';
  const canPress = appIsOpen && vendorOpen;
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={canPress ? onPress : undefined}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{
        backgroundColor: '#fff',
        borderRadius: 14,
        overflow: 'hidden',
        opacity: pressed ? 0.95 : canPress ? 1 : 0.65,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8,
      }}>
      <Image
        source={{ uri: vendor.image || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600' }}
        style={{ width: '100%', height: 160 }}
        contentFit="cover"
      />      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#1a1a1a', flex: 1 }}>{vendor.name}</Text>
          <View style={{ backgroundColor: vendorOpen ? '#dcfce7' : '#fee2e2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: vendorOpen ? '#16a34a' : '#dc2626' }}>
              {vendor.status}
            </Text>
          </View>
        </View>
        {!appIsOpen && (
          <Text style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>Fozdrop is currently closed</Text>
        )}
        {appIsOpen && !vendorOpen && (
          <Text style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>This vendor is currently closed</Text>
        )}
      </View>
    </Pressable>
  );
}

function VendorOperatorDashboard({
  profile, orders, myVendor, onRefresh, refreshing, router, reloadDashboard, appIsOpen,
}: {
  profile: Profile; orders: Order[]; myVendor: Vendor | null;
  onRefresh: () => void; refreshing: boolean;
  router: ReturnType<typeof useRouter>; reloadDashboard: () => void;
  appIsOpen: boolean;
}) {
  const isVendor = profile.role === 'Vendor';
  const [togglingStore, setTogglingStore] = useState(false);
  const [togglingApp, setTogglingApp] = useState(false);

  const handleStoreToggle = async () => {
    if (!myVendor) return;
    const next = myVendor.status === 'Open' ? 'Closed' : 'Open';
    setTogglingStore(true);
    await updateVendorStatus(myVendor.id, next);
    setTogglingStore(false);
    reloadDashboard();
  };

  const handleAppToggle = async () => {
    setTogglingApp(true);
    await setAppIsOpen(!appIsOpen);
    setTogglingApp(false);
    reloadDashboard();
  };

  const vendorActions = [
    { icon: '🍽️', label: 'Manage Menu', subtitle: 'Add, edit or remove items', route: '/(app)/vendor-menu' },
    { icon: '📋', label: 'Orders', subtitle: 'View & update order status', route: '/(app)/vendor-orders' },
    { icon: '💰', label: 'Wallet', subtitle: 'Earnings & withdrawals', route: '/(app)/vendor-wallet' },
  ];
  const operatorActions = [
    { icon: '🛵', label: 'Deliveries', subtitle: 'Manage active deliveries', route: '/(app)/operator-orders' },
  ];
  const actions = isVendor ? vendorActions : operatorActions;

  const pendingCount = orders.filter((o) => o.status === 'Pending').length;
  const preparingCount = orders.filter((o) => o.status === 'Preparing').length;
  const inTransitCount = orders.filter((o) => o.status === 'Out for Delivery' || o.status === 'Arrived at Dropoff').length;

  return (
    <View style={{ flex: 1, backgroundColor: CREAM }}>
      <StatusBar style="dark" />
      {/* Header */}
      <View style={{ backgroundColor: ORANGE, paddingTop: 56, paddingBottom: 24, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
              {isVendor ? '🏪 Vendor Dashboard' : '🛵 Runner Dashboard'}
            </Text>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 4 }}>{profile.name}</Text>
          </View>

          {/* App Open/Closed toggle — operators only */}
          {!isVendor ? (
            <Pressable
              onPress={handleAppToggle}
              disabled={togglingApp}
              style={{
                backgroundColor: appIsOpen ? '#dcfce7' : '#fee2e2',
                paddingHorizontal: 14, paddingVertical: 10,
                borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                opacity: togglingApp ? 0.6 : 1, minWidth: 100,
              }}>
              {togglingApp ? (
                <ActivityIndicator size="small" color={appIsOpen ? '#16a34a' : '#dc2626'} />
              ) : (
                <Text style={{ fontWeight: '900', fontSize: 13, color: appIsOpen ? '#16a34a' : '#dc2626' }}>
                  {appIsOpen ? '🟢 App Open' : '🔴 App Closed'}
                </Text>
              )}
            </Pressable>
          ) : null}

          {/* Open / Closed toggle — vendors only */}
          {isVendor && myVendor ? (
            <Pressable
              onPress={handleStoreToggle}
              disabled={togglingStore}
              style={{
                backgroundColor: myVendor.status === 'Open' ? '#dcfce7' : '#fee2e2',
                paddingHorizontal: 14, paddingVertical: 10,
                borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                opacity: togglingStore ? 0.6 : 1, minWidth: 90,
              }}>
              {togglingStore ? (
                <ActivityIndicator size="small" color={myVendor.status === 'Open' ? '#16a34a' : '#dc2626'} />
              ) : (
                <Text style={{ fontWeight: '900', fontSize: 13, color: myVendor.status === 'Open' ? '#16a34a' : '#dc2626' }}>
                  {myVendor.status === 'Open' ? '🟢 Open' : '🔴 Closed'}
                </Text>
              )}
            </Pressable>
          ) : null}
        </View>

        {/* Quick stats */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          {isVendor ? (
            <>
              <DashStat label="Pending" value={pendingCount} />
              <DashStat label="Preparing" value={preparingCount} />
            </>
          ) : (
            <DashStat label="In Transit" value={inTransitCount} />
          )}
        </View>
      </View>

      {/* Quick Actions */}
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: '#1a1a1a', marginBottom: 2 }}>Quick Actions</Text>
        {actions.map((action) => (
          <Pressable
            key={action.route}
            onPress={() => router.push(action.route as never)}
            style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 }}>
            <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: '#fff5f0', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 26 }}>{action.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#1a1a1a' }}>{action.label}</Text>
              <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{action.subtitle}</Text>
            </View>
            <Text style={{ fontSize: 18, color: '#ccc' }}>›</Text>
          </Pressable>
        ))}
      </View>

      {/* Recent Orders Preview */}
      {orders.length > 0 && (
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#1a1a1a', marginBottom: 10 }}>
            Recent Orders
          </Text>
          {orders.slice(0, 3).map((item) => (
            <View key={item.id} style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 }}>
              <View>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#1a1a1a' }}>#{item.order_ref}</Text>
                <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                  {(item.dropoff_location as { location_name?: string })?.location_name || '—'}
                </Text>
              </View>
              <View>
                <Text style={{ fontSize: 13, fontWeight: '800', color: ORANGE, textAlign: 'right' }}>{formatNaira(item.total_price)}</Text>
                <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#92400e' }}>{item.status}</Text>
                </View>
              </View>
            </View>
          ))}
          <Pressable
            onPress={() => router.push(isVendor ? '/(app)/vendor-orders' : '/(app)/operator-orders')}
            style={{ alignItems: 'center', paddingVertical: 10 }}>
            <Text style={{ color: ORANGE, fontWeight: '700', fontSize: 13 }}>View all orders →</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function DashStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>{value}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 1 }}>{label}</Text>
    </View>
  );
}
