/**
 * Auth layout — guards sign-in/register screens.
 * Already-authenticated users are redirected based on their role:
 *   Admin  → /(super-admin)
 *   others → /(app)/(tabs)/home
 */
import { Redirect, Stack } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useSession } from '@/ctx';
import { supabase } from '@/client/supabase';

export default function AuthLayout() {
  const { session, isLoading } = useSession();
  const [role, setRole] = useState<string | null>(null);
  const [roleChecked, setRoleChecked] = useState(false);

  // Only fetch role AFTER ctx.isLoading has resolved — avoids a race where
  // we launch a DB query while the session is still being read from storage,
  // which caused a double-spinner / blank-dark-screen on cold launch.
  useEffect(() => {
    if (isLoading) return; // wait for session to resolve first
    if (!session) { setRoleChecked(true); return; }
    let cancelled = false;
    // Race the DB query against a 6-second timeout so the spinner never
    // hangs permanently on slow or flaky mobile connections.
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000));
    const query = supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => data?.role ?? null);
    Promise.race([query, timeout]).then((role) => {
      if (cancelled) return;
      setRole(role);
      setRoleChecked(true);
    });
    return () => { cancelled = true; };
  }, [isLoading, session]);

  // Show spinner while: (a) session still loading, or (b) session exists but
  // role not yet fetched. This prevents a flash of sign-in before redirect.
  if (isLoading || (session && !roleChecked)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a0a02' }}>
        <ActivityIndicator color="#F25C19" size="large" />
      </View>
    );
  }

  // Already authenticated — send to the correct portal based on role
  if (session) {
    const dest = role === 'Admin'
      ? '/(super-admin)' as RelativePathString
      : '/(app)/(tabs)/home' as RelativePathString;
    return <Redirect href={dest} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
