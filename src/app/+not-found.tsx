import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { useSession } from '@/ctx';

// Catch-all: redirects to the correct screen based on auth state.
// Auth gating is now done inside layout files so this is safe to
// redirect to either group without causing loops.
export default function NotFound() {
  const router = useRouter();
  const { session, isLoading } = useSession();

  useEffect(() => {
    if (isLoading) return;
    const timer = setTimeout(() => {
      if (session) {
        router.replace('/(app)/(tabs)/home' as RelativePathString);
      } else {
        router.replace('/(auth)/sign-in' as RelativePathString);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [router, session, isLoading]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a0a02' }}>
      <ActivityIndicator color="#F25C19" size="large" />
    </View>
  );
}
