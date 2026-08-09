/**
 * Super Admin Portal layout
 * Strict RBAC: only users with role='Admin' may access any route under (super-admin)/.
 * All other authenticated users are redirected to /.
 * Unauthenticated users are redirected to the sign-in screen.
 */
import { Redirect, Stack } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useSession } from '@/ctx';
import { getProfile } from '@/db/api';

export default function SuperAdminLayout() {
  const { session, isLoading } = useSession();
  const [roleChecked, setRoleChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!session) { setRoleChecked(true); return; }
    (async () => {
      const profile = await getProfile(session.user.id);
      setIsAdmin(profile?.role === 'Admin');
      setRoleChecked(true);
    })();
  }, [session]);

  if (isLoading || !roleChecked) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' }}>
        <ActivityIndicator color="#F25C19" size="large" />
      </View>
    );
  }

  if (!session) return <Redirect href={'/(auth)/sign-in' as RelativePathString} />;
  if (!isAdmin) return <Redirect href={'/' as RelativePathString} />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="vendors" />
      <Stack.Screen name="menu-editor" />
      <Stack.Screen name="all-orders" />
      <Stack.Screen name="users" />
      <Stack.Screen name="financials" />
      <Stack.Screen name="broadcast" />
      <Stack.Screen name="analytics" />
    </Stack>
  );
}
