import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
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

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  // Input focus animation
  const focusAnim = useSharedValue(0);
  const borderStyle = useAnimatedStyle(() => ({
    borderColor: focusAnim.value === 1 ? ORANGE : '#e0e0e0',
    borderWidth: focusAnim.value === 1 ? 2 : 1,
  }));

  // Back button scale
  const backScale = useSharedValue(1);
  const backStyle = useAnimatedStyle(() => ({ transform: [{ scale: backScale.value }] }));

  // Submit button scale
  const btnScale = useSharedValue(1);
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

  const handleSend = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setError('Please enter your email address.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');

    // Route through Edge Function — uses Admin API which bypasses redirectTo allowlist
    // and gives us full server-side error visibility via logs.
    const { data, error: fnError } = await supabase.functions.invoke('reset-password', {
      body: { email: trimmed },
    });

    setLoading(false);

    if (fnError) {
      // Try to extract a meaningful message from the function error
      let msg = 'Something went wrong. Please try again.';
      try {
        const text = await fnError?.context?.text?.();
        const parsed = JSON.parse(text || '{}');
        if (parsed.error) msg = parsed.error;
      } catch { /* keep generic message */ }
      setError(msg);
      return;
    }

    if (data?.error) {
      setError(data.error);
      return;
    }

    setSent(true);
  };

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
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
          <Animated.View entering={FadeInDown.delay(80).springify()} style={backStyle}>
            <Pressable
              onPressIn={() => { backScale.value = withSpring(0.92); }}
              onPressOut={() => { backScale.value = withSpring(1); }}
              onPress={() => router.back()}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
              hitSlop={10}
            >
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 22 }}>←</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600' }}>
                Back to Sign In
              </Text>
            </Pressable>
          </Animated.View>

          <Animated.Text
            entering={FadeInDown.delay(160).springify()}
            style={{ fontSize: 34, fontWeight: '900', color: '#fff', marginTop: 28, letterSpacing: 0.5 }}
          >
            Forgot{'\n'}
            <Text style={{ color: ORANGE }}>Password?</Text>
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(240).springify()}
            style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 10, lineHeight: 21 }}
          >
            No worries — enter your email and we'll send you a reset link.
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
            minHeight: 380,
          }}
        >
          {sent ? (
            /* ── Success State ── */
            <Animated.View entering={ZoomIn.springify()} style={{ alignItems: 'center', paddingTop: 16, gap: 16 }}>
              <Text style={{ fontSize: 64 }}>📬</Text>
              <Text style={{ fontSize: 22, fontWeight: '900', color: '#1a0a02', textAlign: 'center' }}>
                Check Your Inbox
              </Text>
              <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, paddingHorizontal: 8 }}>
                If an account exists for{' '}
                <Text style={{ color: ORANGE, fontWeight: '700' }}>{email.trim().toLowerCase()}</Text>
                {', '}we've sent a password reset link. It expires in{' '}
                <Text style={{ fontWeight: '700', color: '#333' }}>1 hour</Text>.
              </Text>
              <Text style={{ fontSize: 13, color: '#aaa', textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 }}>
                Don't see it? Check your spam folder or make sure you used the right email.
              </Text>

              {/* Resend / Back */}
              <Pressable onPress={() => { setSent(false); setEmail(''); }} style={{ marginTop: 8 }}>
                <Text style={{ color: ORANGE, fontWeight: '700', fontSize: 14 }}>
                  Try a different email
                </Text>
              </Pressable>
              <Pressable onPress={() => router.back()} style={{ marginTop: 4 }}>
                <Text style={{ color: '#aaa', fontSize: 13, fontWeight: '600' }}>
                  Return to Sign In
                </Text>
              </Pressable>
            </Animated.View>
          ) : (
            /* ── Request Form ── */
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

              {/* Email input */}
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#666' }}>
                  📧 EMAIL ADDRESS
                </Text>
                <Animated.View
                  style={[{
                    backgroundColor: '#fff',
                    borderRadius: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    overflow: 'hidden',
                  }, borderStyle]}
                >
                  <TextInput
                    style={{ flex: 1, padding: 15, fontSize: 15, color: '#1a1a1a' }}
                    placeholder="you@university.edu"
                    placeholderTextColor="#bbb"
                    value={email}
                    onChangeText={(v) => { setEmail(v); setError(''); }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="send"
                    onSubmitEditing={handleSend}
                    onFocus={() => { focusAnim.value = withTiming(1, { duration: 200 }); }}
                    onBlur={() => { focusAnim.value = withTiming(0, { duration: 200 }); }}
                  />
                </Animated.View>
                <Text style={{ fontSize: 11, color: '#bbb', paddingLeft: 4 }}>
                  Enter the email address linked to your Fozdrop account.
                </Text>
              </View>

              {/* Send button */}
              <Animated.View style={btnStyle}>
                <Pressable
                  onPressIn={() => { btnScale.value = withSpring(0.96, { damping: 10 }); }}
                  onPressOut={() => { btnScale.value = withSpring(1, { damping: 10 }); }}
                  onPress={handleSend}
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
                        Send Reset Link 📨
                      </Text>
                  }
                </Pressable>
              </Animated.View>

              {/* Back link */}
              <Text style={{ textAlign: 'center', color: '#aaa', fontSize: 13, marginTop: 4 }}>
                Remember your password?{' '}
                <Text onPress={() => router.back()} style={{ color: ORANGE, fontWeight: '700' }}>
                  Sign In
                </Text>
              </Text>
            </Animated.View>
          )}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
