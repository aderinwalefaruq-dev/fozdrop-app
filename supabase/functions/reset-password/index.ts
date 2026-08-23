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
import { useState } from 'react';
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

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [error, setError] = useState('');

  // Focus animations
  const emailFocus = useSharedValue(0);
  const emailBorder = useAnimatedStyle(() => ({
    borderColor: emailFocus.value === 1 ? ORANGE : '#e0e0e0',
    borderWidth: emailFocus.value === 1 ? 2 : 1,
  }));

  const btnScale = useSharedValue(1);
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

  const handleGenerateLink = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');
    setGeneratedLink('');

    try {
      // Generate the recovery link directly via Supabase Admin / GoTrue API client
      const { data, error: linkError } = await supabase.auth.admin
        ? await supabase.auth.admin.generateLink({
            type: 'recovery',
            email: trimmed,
            options: {
              redirectTo: 'https://fozdrop-app.vercel.app/reset-password',
            },
          })
        : await supabase.auth.resetPasswordForEmail(trimmed, {
            redirectTo: 'https://fozdrop-app.vercel.app/reset-password',
          });

      setLoading(false);

      if (linkError) {
        // Fallback: use standard recovery method if admin isn't exposed on client
        const { data: fallbackData, error: fbError } = await supabase.auth.resetPasswordForEmail(trimmed, {
          redirectTo: 'https://fozdrop-app.vercel.app/reset-password',
        });
        if (fbError) {
          setError(fbError.message || 'Something went wrong.');
          return;
        }
        setGeneratedLink('Check your console logs or use the token method.');
        return;
      }

      // If we successfully get the action link from generateLink
      const actionLink = data?.properties?.action_link;
      if (actionLink) {
        // Swap out the domain to point straight to your Vercel deployment with the token
        // Supabase action links usually look like .../auth/v1/verify?token=XYZ&type=recovery
        const urlObj = new URL(actionLink);
        const token = urlObj.searchParams.get('token') || urlObj.searchParams.get('token_hash');
        
        const directVercelLink = `https://fozdrop-app.vercel.app/reset-password?token=${token}`;
        setGeneratedLink(directVercelLink);
      } else {
        setError('Could not retrieve action link directly.');
      }
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || 'Network error. Please check your connection.');
    }
  };

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
            Bypass{'\n'}
            <Text style={{ color: ORANGE }}>Reset Link</Text>
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(200).springify()}
            style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 10, lineHeight: 21 }}
          >
            Generate a direct Vercel reset link on your screen, bypassing MeDo and server redirection limits.
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
            minHeight: 400,
          }}
        >
          {generatedLink ? (
            /* ── Success State with Direct Link ── */
            <Animated.View entering={ZoomIn.springify()} style={{ alignItems: 'center', paddingTop: 10, gap: 14 }}>
              <Text style={{ fontSize: 48 }}>🔗</Text>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#1a0a02', textAlign: 'center' }}>
                Your Direct Reset Link
              </Text>
              <Text style={{ fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 20 }}>
                Tap the button below to open your Vercel reset page instantly:
              </Text>

              <Pressable
                onPress={() => {
                  if (Platform.OS === 'web') {
                    window.location.href = generatedLink;
                  }
                }}
                style={{
                  backgroundColor: '#16a34a',
                  borderRadius: 14,
                  padding: 16,
                  width: '100%',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>
                  Open Reset Page Now 🚀
                </Text>
              </Pressable>

              <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 10, width: '100%', borderWidth: 1, borderColor: '#e0e0e0' }}>
                <Text selectable style={{ fontSize: 11, color: '#444' }}>{generatedLink}</Text>
              </View>

              <Pressable
                onPress={() => setGeneratedLink('')}
                style={{ marginTop: 8 }}
              >
                <Text style={{ color: ORANGE, fontWeight: '700', fontSize: 13 }}>Generate another link</Text>
              </Pressable>
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

              {/* Email Input */}
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#666' }}>📧 ACCOUNT EMAIL</Text>
                <Animated.View style={[{
                  backgroundColor: '#fff', borderRadius: 14,
                  flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
                }, emailBorder]}>
                  <TextInput
                    style={{ flex: 1, padding: 15, fontSize: 15, color: '#1a1a1a' }}
                    placeholder="you@university.edu"
                    placeholderTextColor="#bbb"
                    value={email}
                    onChangeText={(v) => { setEmail(v); setError(''); }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleGenerateLink}
                    onFocus={() => { emailFocus.value = withTiming(1, { duration: 200 }); }}
                    onBlur={() => { emailFocus.value = withTiming(0, { duration: 200 }); }}
                  />
                </Animated.View>
              </View>

              {/* Submit Button */}
              <Animated.View style={btnStyle}>
                <Pressable
                  onPressIn={() => { btnScale.value = withSpring(0.96, { damping: 10 }); }}
                  onPressOut={() => { btnScale.value = withSpring(1, { damping: 10 }); }}
                  onPress={handleGenerateLink}
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
                    marginTop: 10,
                  }}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.4 }}>
                        Generate Direct Link ✨
                      </Text>
                  }
                </Pressable>
              </Animated.View>

              <Text style={{ textAlign: 'center', color: '#aaa', fontSize: 13, marginTop: 10 }}>
                Remember your password?{' '}
                <Text onPress={() => router.replace('/(auth)/sign-in' as RelativePathString)} style={{ color: ORANGE, fontWeight: '700' }}>
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
