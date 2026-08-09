import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl: string = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey: string = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

// ---------------------------------------------------------------------------
// Storage adapter — three tiers:
//   1. Native (iOS / Android): expo-secure-store (encrypted keychain/keystore)
//   2. Web normal browsing:    window.localStorage (standard)
//   3. Web Safari Private /
//      any browser that blocks localStorage (SecurityError): in-memory fallback
//      so the app still works — session won't persist across hard-reloads in
//      private mode, but it will NOT crash or blank-screen.
// ---------------------------------------------------------------------------

// Minimal in-memory store used only when localStorage is unavailable.
const memoryStore: Record<string, string> = {};
const inMemoryStorage: Storage = {
  getItem: (key) => memoryStore[key] ?? null,
  setItem: (key, value) => { memoryStore[key] = value; },
  removeItem: (key) => { delete memoryStore[key]; },
  clear: () => { Object.keys(memoryStore).forEach((k) => delete memoryStore[k]); },
  key: (index) => Object.keys(memoryStore)[index] ?? null,
  get length() { return Object.keys(memoryStore).length; },
};

function getSafeWebStorage(): Storage {
  try {
    // Safari Private Browsing throws SecurityError on any localStorage access
    const test = '__fozdrop_test__';
    window.localStorage.setItem(test, '1');
    window.localStorage.removeItem(test);
    return window.localStorage;
  } catch {
    return inMemoryStorage;
  }
}

// expo-secure-store adapter that mirrors the Storage interface
const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const storage = Platform.OS === 'web' ? getSafeWebStorage() : secureStoreAdapter;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    // Must be true on web so Supabase picks up the session from the URL hash
    // after email confirmation / OAuth redirects (e.g. #access_token=...).
    detectSessionInUrl: Platform.OS === 'web',
    // Bypass navigator.locks Web Locks API — avoids "lock stolen by another
    // request" errors in React Native web where concurrent auth calls
    // contend on the same lock.
    lock: <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => fn(),
  },
});
