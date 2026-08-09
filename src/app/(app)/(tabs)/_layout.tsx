import { Tabs, Redirect } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { Home, LayoutGrid, Wallet, ReceiptText, Headphones, UserRound } from 'lucide-react-native';
import { useSession } from '@/ctx';
import { getProfile } from '@/db/api';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { UserRole } from '@/types/types';

const ORANGE = '#F25C19';

export default function TabsLayout() {
  const { session } = useSession();
  // null = still loading, string = resolved
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    if (!session?.user?.id) {
      // No session — default to Customer so tabs render immediately without a spinner
      setRole('Customer');
      return;
    }
    let cancelled = false;
    // Race DB query against 5s timeout — prevents permanent cream spinner on slow connections
    const timeout = new Promise<'Customer'>((resolve) => setTimeout(() => resolve('Customer'), 5000));
    const query = getProfile(session.user.id).then((p) => (p?.role ?? 'Customer') as UserRole);
    Promise.race([query, timeout]).then((r) => {
      if (!cancelled) setRole(r);
    });
    return () => { cancelled = true; };
  }, [session]);

  // Wait for role before rendering tabs — prevents flash of wrong tabs
  if (role === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAF6F0' }}>
        <ActivityIndicator color={ORANGE} size="large" />
      </View>
    );
  }

  // Admin users must never reach the regular app tabs — eject to portal.
  if (role === 'Admin') {
    return <Redirect href={'/(super-admin)' as RelativePathString} />;
  }

  const isCustomer = role === 'Customer';

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        tabBarActiveTintColor: ORANGE,
        tabBarInactiveTintColor: '#888',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e5e5e5',
          height: 68,
          paddingBottom: 10,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerShown: false,
      }}
    >
      {/* ── Home / Dashboard ── */}
      <Tabs.Screen
        name="home"
        options={{
          title: isCustomer ? 'Home' : 'Dashboard',
          tabBarIcon: ({ color, size }) =>
            isCustomer
              ? <Home size={size} color={color} />
              : <LayoutGrid size={size} color={color} />,
        }}
      />

      {/* ── Customer: Wallet ── */}
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          href: isCustomer ? undefined : null,
          tabBarIcon: ({ color, size }) => <Wallet size={size} color={color} />,
        }}
      />

      {/* ── Customer: Orders ── */}
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          href: isCustomer ? undefined : null,
          tabBarIcon: ({ color, size }) => <ReceiptText size={size} color={color} />,
        }}
      />

      {/* ── Support (all roles) ── */}
      <Tabs.Screen
        name="support"
        options={{
          title: 'Support',
          tabBarIcon: ({ color, size }) => <Headphones size={size} color={color} />,
        }}
      />

      {/* ── Profile (all roles) ── */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <UserRound size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
