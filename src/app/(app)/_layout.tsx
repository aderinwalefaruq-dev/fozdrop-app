import { Redirect, Stack } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { useSession } from '@/ctx';
import { ActivityIndicator, View } from 'react-native';

export default function AppLayout() {
  const { session, isLoading } = useSession();

  // Still loading session — show spinner instead of flashing redirect
  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a0a02' }}>
        <ActivityIndicator color="#F25C19" size="large" />
      </View>
    );
  }

  // Unauthenticated — send to sign-in
  if (!session) {
    return <Redirect href={'/(auth)/sign-in' as RelativePathString} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="vendor/[id]" />
      <Stack.Screen name="checkout" />
      <Stack.Screen name="vendor-menu" />
      <Stack.Screen name="vendor-wallet" />
      <Stack.Screen name="vendor-orders" />
      <Stack.Screen name="operator-orders" />
    </Stack>
  );
}
