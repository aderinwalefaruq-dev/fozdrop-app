import * as Sentry from '@sentry/react-native';
import { Stack, useRouter } from 'expo-router';
import { PortalHost } from '@rn-primitives/portal';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';
import { ActivityIndicator, Linking, Platform, View } from 'react-native';

import { SessionProvider, useSession } from '@/ctx';
import { CartProvider } from '@/context/CartContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { supabase } from '@/client/supabase';
import "../global.css";

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
});

// Handles fozdropdelivery://reset-password#access_token=...&type=recovery deep links.
function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    const handle = async (url: string) => {
      if (!url.includes('reset-password')) return;
      const fragment = url.split('#')[1];
      if (!fragment) return;
      const params = new URLSearchParams(fragment);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type = params.get('type');
      if (type === 'recovery' && accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        router.push('/(auth)/reset-password');
      }
    };
    Linking.getInitialURL().then((url) => { if (url) handle(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, [router]);

  return null;
}

function RootLayoutNav() {
  const { isLoading } = useSession();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a0a02' }}>
        <ActivityIndicator color="#F25C19" size="large" />
      </View>
    );
  }

  // All screens are always registered — auth gating is handled by
  // redirect logic inside (app)/_layout.tsx and (auth)/_layout.tsx.
  // Stack.Protected is NOT used because it conditionally excludes screens
  // from the navigator, which causes +not-found loops when navigating
  // to a screen whose guard is false.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="(super-admin)" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

function SafariViewportFix() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    // Unregister any lingering service workers (previously used for push
    // notifications). Cleans up old registrations so they never intercept
    // network requests or trigger permission prompts again.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
    }

    // Safari on iOS collapses 100vh to the visible viewport height — fix it.
    const style = document.createElement('style');
    style.id = 'fozdrop-safari-fix';
    style.textContent = [
      'html, body, #root { height: 100%; }',
      'html { min-height: 100vh; min-height: -webkit-fill-available; }',
      'body { min-height: 100vh; min-height: -webkit-fill-available; display: flex; flex-direction: column; }',
    ].join('\n');
    if (!document.getElementById('fozdrop-safari-fix')) {
      document.head.appendChild(style);
    }
    return () => { style.remove(); };
  }, []);
  return null;
}

const RootLayout: React.FC = () => {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafariViewportFix />
        <SessionProvider>
          <CartProvider>
            <DeepLinkHandler />
            <RootLayoutNav />
            <PortalHost />
          </CartProvider>
        </SessionProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
};

export default Sentry.wrap(RootLayout);
