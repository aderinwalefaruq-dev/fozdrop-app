import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { Session } from '@supabase/supabase-js';

import { supabase } from '@/client/supabase';

type SessionContextType = {
  session: Session | null;
  isLoading: boolean;
};

const SessionContext = createContext<SessionContextType>({
  session: null,
  isLoading: true,
});

// Maximum ms to wait for getSession() before giving up and rendering
// the app unauthenticated. Prevents a permanent blank/spinner screen if
// Supabase is unreachable or Safari blocks storage access.
// 3-second hard limit — if auth state hasn't resolved by then, force-show
// the sign-in screen. Prevents infinite spinner on iOS Safari and slow networks.
const SESSION_TIMEOUT_MS = 3000;

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const appState = useRef(AppState.currentState);
  const loadingResolved = useRef(false);

  const resolveLoading = (s: Session | null) => {
    if (loadingResolved.current) return;
    loadingResolved.current = true;
    setSession(s);
    setIsLoading(false);
  };

  useEffect(() => {
    // Safety net: if getSession() never resolves (network timeout, Safari
    // storage blocked, etc.) we stop the spinner after SESSION_TIMEOUT_MS
    // so the user sees the sign-in screen instead of a frozen spinner.
    const safetyTimer = setTimeout(() => resolveLoading(null), SESSION_TIMEOUT_MS);

    supabase.auth.getSession().then(({ data }) => {
      clearTimeout(safetyTimer);
      resolveLoading(data.session);
    }).catch(() => {
      clearTimeout(safetyTimer);
      resolveLoading(null);
    });

    // onAuthStateChange fires on every sign-in / sign-out / token refresh.
    // It also fires immediately with the current session on subscribe, so
    // it serves as a second path to resolve isLoading.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, newSession) => {
      clearTimeout(safetyTimer);
      // Always update session; only flip isLoading off if still pending
      setSession(newSession);
      if (!loadingResolved.current) {
        loadingResolved.current = true;
        setIsLoading(false);
      }
    });

    // iOS/Android: JS thread is suspended in background, autoRefreshToken
    // timers stop — manually refresh when returning to foreground.
    // Web timers are unaffected; autoRefreshToken handles it automatically.
    const appStateSubscription = AppState.addEventListener('change', async (nextState) => {
      if (Platform.OS !== 'web' && appState.current.match(/inactive|background/) && nextState === 'active') {
        const { error } = await supabase.auth.refreshSession();
        if (error) {
          await supabase.auth.signOut();
        }
      }
      appState.current = nextState;
    });

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
      appStateSubscription.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SessionContext.Provider value={{ session, isLoading }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
