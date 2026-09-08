import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/client/supabase';

// Controls how a notification is presented while the app is in the
// foreground. Without this, foreground notifications are silent/hidden
// on some platforms by default.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Registers this device for native push notifications and upserts the
 * resulting Expo push token into `push_tokens`.
 *
 * Must run inside a real EAS development or production build — Expo Go
 * no longer supports remote push notifications on Android (deprecated
 * in SDK 53+), so this will fail silently (no permission prompt, or a
 * token request error) if run there. It's safe to call unconditionally
 * on every app start; it's a no-op after the first successful run
 * since the underlying token rarely changes.
 */
export async function registerForPushNotificationsAsync(userId: string): Promise<void> {
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device, not a simulator/emulator.');
    return;
  }

  if (Platform.OS === 'android') {
    // The sound filename here must match what's bundled via the
    // expo-notifications config plugin in app.json.
    await Notifications.setNotificationChannelAsync('order-alerts', {
      name: 'Order Alerts',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'order_alert.wav',
      vibrationPattern: [0, 500, 250, 500],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.warn('Push notification permission was not granted.');
    return;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn('No EAS project ID found in app config — run `eas build:configure` first.');
    return;
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  const expoPushToken = tokenResponse.data;

  const { error } = await supabase.from('push_tokens').upsert(
    {
      user_id: userId,
      expo_push_token: expoPushToken,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'expo_push_token' }
  );

  if (error) {
    console.warn('Failed to save push token:', error.message);
  }
}
