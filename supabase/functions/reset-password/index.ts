import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  FadeInDown,
  FadeInUp,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { supabase } from '@/client/supabase';

const ORANGE = '#F25C19';

// Password strength: requires ≥8 chars, 1 uppercase, 1 lowercase, 1 digit
function getStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 2) return { score, label: 'Weak', color: '#ef4444' };
  if (score <= 4) return { score, label: 'Fair', color: '#f97316' };
  return { score, label: 'Strong', color: '#16a34a' };
}

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [hasSession, setHasSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Focus animations
  const pwFocus = useSharedValue(0);
  const cfFocus = useSharedValue(0);
  const pwBorder = useAnimatedStyle(() => ({
    borderColor: pwFocus.value === 1 ? ORANGE : '#e0e0e0',
    borderWidth: pwFocus.value === 1 ? 2 : 1,
  }));
  const cfBorder = useAnimatedStyle(() => ({
    borderColor: cfFocus.value === 1 ? ORANGE : '#e0e0e0',
    borderWidth: cfFocus.value === 1 ? 2 : 1,
  }));

  const btnScale = useSharedValue(1);
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

  const strength = getStrength(password);

  // Establish a recovery session from the URL query params or hash fragments
  useEffect(() => {
    (async () => {
      if (Platform.OS === 'web') {
        const searchParams = new URLSearchParams(window.location.search);
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type');
        const code = searchParams.get('code');
        const hash = window.location.hash;

        // 1. Handle token_hash flow (OTP link format)
        if (tokenHash && type === 'recovery') {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          });
          if (verifyError) {
            console.error('verifyOtp failed:', verifyError.message);
          }
          window.history.replaceState(null, '', window.location.pathname);
        } 
        // 2. Handle PKCE flow (?code= query param)
        else if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error('exchangeCodeForSession failed:', exchangeError.message);
          }
          window.history.replaceState(null, '', window.location.pathname);
        }
        // 3. Handle Implicit flow (hash fragment with access_token)
        else if (hash && hash.includes('access_token')) {
          const params = new URLSearchParams(hash.replace('#', '?'));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            window.history.replaceState(null, '', window.location.pathname);
          }
        }
      }

      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);
      setCheckingSession(false);
    })();
  }, []);

  const handleReset = async () => {
    if (!password) { setError('Please enter a new password.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (!/[A-Z]/.test(password)) { setError('Password must include at least one uppercase letter.'); return; }
    if (!/[0-9]/.test(password)) { setError('Password must include at least one number.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setLoading(true);
    setError('');

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (updateError) {
      setError(updateError.message || 'Failed to update password. The link may have expired.');
      return;
    }

    setDone(true);

    // Sign out all other sessions for security, then redirect after brief delay
    await supabase.auth.signOut({ scope: 'others' });
    setTimeout(() => router.replace('/(auth)/sign-in' as RelativePathString), 2000);
  };

  if (checkingSession) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1a0a02', alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar style="light" />
        <ActivityIndicator color={ORANGE} size="large" />
      </View>
    );
  }

  if (!hasSession) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1a0a02', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <StatusBar style="light" />
        <Text style={{ fontSize: 48 }}>⏰</Text>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 16, textAlign: 'center' }}>
          Link Expired
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', marginTop: 12, lineHeight: 22 }}>
          This password reset link has expired or already been used. Please request a new one.
        </Text>
        <Pressable
          onPress={() => router.replace('/(auth)/forgot-password' as RelativePathString)}
          style={{ marginTop: 28, backgroundColor: ORANGE, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Request New Link</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#1a0a02' }}
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={{ paddingTop: 60, paddingHorizontal: 24, paddingBottom: 32 }}>
          <Animated.Text
            entering={FadeInDown.delay(100).springify()}
            style={{ fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: 0.5 }}
          >
            Set New{'\n'}
            <Text style={{ color: ORANGE }}>Password</Text>
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(200).springify()}
            style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 10, lineHeight: 21 }}
          >
            Choose a strong password for your Fozdrop account.
          </Animated.Text>
        </View>

        {/* ── Card ── */}
        <Animated.View
          entering={FadeInUp.delay(200).springify()}
          style={{
            flex: 1,
            backgroundColor: '#FAF6F0',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: 28,
            paddingTop: 32,
            minHeight: 440,
          }}
        >
          {done ? (
            /* ── Success State ── */
            <Animated.View entering={ZoomIn.springify()} style={{ alignItems: 'center', paddingTop: 16, gap: 16 }}>
              <Text style={{ fontSize: 64 }}>🔐</Text>
              <Text style={{ fontSize: 22, fontWeight: '900', color: '#1a0a02', textAlign: 'center' }}>
                Password Updated!
              </Text>
              <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, paddingHorizontal: 8 }}>
                Your password has been changed successfully. Signing you in now…
              </Text>
              <ActivityIndicator color={ORANGE} style={{ marginTop: 8 }} />
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.delay(100).springify()} style={{ gap: 20 }}>
              {/* Error message */}
              {error ? (
                <Animated.View
                  entering={ZoomIn.springify()}
                  style={{
                    backgroundColor: '#fee2e2',
                    padding: 13,
                    borderRadius: 12,
                    borderLeftWidth: 4,
                    borderLeftColor: '#ef4444',
                  }}
                >
                  <Text style={{ color: '#dc2626', fontSize: 13, fontWeight: '600' }}>
                    ⚠️ {error}
                  </Text>
                </Animated.View>
              ) : null}

              {/* New Password */}
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#666' }}>🔒 NEW PASSWORD</Text>
                <Animated.View style={[{
                  backgroundColor: '#fff', borderRadius: 14,
                  flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
                }, pwBorder]}>
                  <TextInput
                    style={{ flex: 1, padding: 15, fontSize: 15, color: '#1a1a1a' }}
                    placeholder="••••••••"
                    placeholderTextColor="#bbb"
                    value={password}
                    onChangeText={(v) => { setPassword(v); setError(''); }}
                    secureTextEntry={!showPw}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    onFocus={() => { pwFocus.value = withTiming(1, { duration: 200 }); }}
                    onBlur={() => { pwFocus.value = withTiming(0, { duration: 200 }); }}
                  />
                  <Pressable onPress={() => setShowPw((v) => !v)} style={{ paddingHorizontal: 14 }} hitSlop={8}>
                    <Text style={{ fontSize: 11, color: ORANGE, fontWeight: '800' }}>
                      {showPw ? 'HIDE' : 'SHOW'}
                    </Text>
                  </Pressable>
                </Animated.View>

                {/* Strength meter */}
                {password.length > 0 && (
                  <Animated.View entering={FadeInDown.springify()} style={{ gap: 6 }}>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      {[0, 1, 2, 3, 4].map((i) => (
                        <View
                          key={i}
                          style={{
                            flex: 1, height: 4, borderRadius: 4,
                            backgroundColor: i < strength.score ? strength.color : '#e0e0e0',
                          }}
                        />
                      ))}
                    </View>
                    <Text style={{ fontSize: 11, color: strength.color, fontWeight: '700' }}>
                      {strength.label} password
                    </Text>
                  </Animated.View>
                )}

                <Text style={{ fontSize: 11, color: '#bbb', paddingLeft: 4 }}>
                  Min. 8 characters · 1 uppercase · 1 number
                </Text>
              </View>

              {/* Confirm Password */}
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#666' }}>🔒 CONFIRM PASSWORD</Text>
                <Animated.View style={[{
                  backgroundColor: '#fff', borderRadius: 14,
                  flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
                }, cfBorder]}>
                  <TextInput
                    style={{ flex: 1, padding: 15, fontSize: 15, color: '#1a1a1a' }}
                    placeholder="••••••••"
                    placeholderTextColor="#bbb"
                    value={confirm}
                    onChangeText={(v) => { setConfirm(v); setError(''); }}
                    secureTextEntry={!showConfirm}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleReset}
                    onFocus={() => { cfFocus.value = withTiming(1, { duration: 200 }); }}
                    onBlur={() => { cfFocus.value = withTiming(0, { duration: 200 }); }}
                  />
                  <Pressable onPress={() => setShowConfirm((v) => !v)} style={{ paddingHorizontal: 14 }} hitSlop={8}>
                    <Text style={{ fontSize: 11, color: ORANGE, fontWeight: '800' }}>
                      {showConfirm ? 'HIDE' : 'SHOW'}
                    </Text>
                  </Pressable>
                </Animated.View>

                {/* Match indicator */}
                {confirm.length > 0 && (
                  <Text style={{
                    fontSize: 11, fontWeight: '700', paddingLeft: 4,
                    color: password === confirm ? '#16a34a' : '#ef4444',
                  }}>
                    {password === confirm ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </Text>
                )}
              </View>

              {/* Submit */}
              <Animated.View style={btnStyle}>
                <Pressable
                  onPressIn={() => { btnScale.value = withSpring(0.96, { damping: 10 }); }}
                  onPressOut={() => { btnScale.value = withSpring(1, { damping: 10 }); }}
                  onPress={handleReset}
                  disabled={loading}
                  style={{
                    backgroundColor: ORANGE,
                    borderRadius: 16,
                    padding: 18,
                    alignItems: 'center',
                    shadowColor: ORANGE,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.4,
                    shadowRadius: 12,
                  }}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.4 }}>
                        Update Password 🔐
                      </Text>
                  }
                </Pressable>
              </Animated.View>

              <Text style={{ textAlign: 'center', color: '#aaa', fontSize: 13 }}>
                <Text onPress={() => router.replace('/(auth)/sign-in' as RelativePathString)} style={{ color: ORANGE, fontWeight: '700' }}>
                  Return to Sign In
                </Text>
              </Text>
            </Animated.View>
          )}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
