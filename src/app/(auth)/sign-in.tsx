import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  withDelay,
  FadeInDown,
  FadeInUp,
  ZoomIn,
  SlideInRight,
  SlideInLeft,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { supabase } from '@/client/supabase';
import { saveReferredBy } from '@/db/api';
import type { UserRole } from '@/types/types';

const ORANGE = '#F25C19';
const ORANGE_DARK = '#C94A0E';
const ORANGE_LIGHT = '#FF7A45';

type Tab = 'login' | 'register';
const ROLES: { label: string; value: UserRole; emoji: string }[] = [
  { label: 'Customer', value: 'Customer', emoji: '🛒' },
  { label: 'Vendor', value: 'Vendor', emoji: '🍳' },
  { label: 'Delivery', value: 'Operator', emoji: '🛵' },
];

// Floating food particle config
const PARTICLES = [
  { emoji: '🍕', x: 0.12, delay: 0 },
  { emoji: '🍔', x: 0.35, delay: 600 },
  { emoji: '🌮', x: 0.58, delay: 1200 },
  { emoji: '🍜', x: 0.78, delay: 300 },
  { emoji: '🍗', x: 0.22, delay: 900 },
  { emoji: '🥗', x: 0.68, delay: 1500 },
];

function FloatingParticle({ emoji, xFraction, delay, height }: { emoji: string; xFraction: number; delay: number; height: number }) {
  const { width } = useWindowDimensions();
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const startAnim = () => {
      translateY.value = 0;
      opacity.value = 0;
      opacity.value = withDelay(delay, withTiming(0.75, { duration: 800 }));
      translateY.value = withDelay(
        delay,
        withRepeat(
          withTiming(-height * 0.55, { duration: 4500, easing: Easing.out(Easing.quad) }),
          -1,
          false,
          () => { 'worklet'; translateY.value = 0; }
        )
      );
    };
    startAnim();
  }, [delay, height, translateY, opacity]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: interpolate(
      translateY.value,
      [-height * 0.55, -height * 0.3, 0],
      [0, 0.75, 0.55]
    ),
  }));

  return (
    <Animated.Text
      style={[{
        position: 'absolute',
        bottom: 0,
        left: xFraction * width,
        fontSize: 24,
        zIndex: 1,
      }, style]}
    >
      {emoji}
    </Animated.Text>
  );
}

function AnimatedInput({
  label, placeholder, value, onChangeText, keyboardType, autoCapitalize,
  secureTextEntry, rightElement, delay = 0,
}: {
  label: string; placeholder: string; value: string;
  onChangeText: (v: string) => void; keyboardType?: 'email-address' | 'phone-pad' | 'default';
  autoCapitalize?: 'none' | 'sentences'; secureTextEntry?: boolean;
  rightElement?: React.ReactNode; delay?: number;
}) {
  const [focused, setFocused] = useState(false);
  const focusAnim = useSharedValue(0);

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: focusAnim.value === 1 ? ORANGE : '#e0e0e0',
    borderWidth: focusAnim.value === 1 ? 2 : 1,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    color: focusAnim.value === 1 ? ORANGE : '#666',
  }));

  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()}>
      <Animated.Text style={[{ fontSize: 12, fontWeight: '700', marginBottom: 6 }, labelStyle]}>
        {label}
      </Animated.Text>
      <Animated.View style={[{
        backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
        flexDirection: 'row', alignItems: 'center',
      }, borderStyle]}>
        <TextInput
          style={{ flex: 1, padding: 15, fontSize: 15, color: '#1a1a1a' }}
          placeholder={placeholder}
          placeholderTextColor="#bbb"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? 'sentences'}
          autoCorrect={false}
          secureTextEntry={secureTextEntry}
          onFocus={() => { setFocused(true); focusAnim.value = withTiming(1, { duration: 200 }); }}
          onBlur={() => { setFocused(false); focusAnim.value = withTiming(0, { duration: 200 }); }}
        />
        {rightElement}
      </Animated.View>
    </Animated.View>
  );
}

function RoleCard({ role, selected, onSelect }: {
  role: { label: string; value: UserRole; emoji: string };
  selected: boolean;
  onSelect: () => void;
}) {
  const roleScale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: roleScale.value }],
    borderColor: selected ? ORANGE : '#e0e0e0',
    backgroundColor: selected ? '#fff5f0' : '#fff',
    shadowColor: selected ? ORANGE : 'transparent',
  }));
  return (
    <Pressable
      onPressIn={() => { roleScale.value = withSpring(0.94); }}
      onPressOut={() => { roleScale.value = withSpring(1); }}
      onPress={onSelect}
      style={{ flex: 1 }}
    >
      <Animated.View style={[{
        padding: 12, borderRadius: 14, alignItems: 'center', borderWidth: 2,
        shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6,
      }, cardStyle]}>
        <Text style={{ fontSize: 22, marginBottom: 4 }}>{role.emoji}</Text>
        <Text style={{ fontSize: 11, fontWeight: '800', color: selected ? ORANGE : '#888', textAlign: 'center' }}>
          {role.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

async function verifyReferralCode(code: string): Promise<{ valid: boolean; referrerName?: string }> {
  if (!code || code.length !== 6) return { valid: false };
  const { data } = await supabase
    .from('profiles')
    .select('name')
    .eq('referral_code', code.trim().toUpperCase())
    .maybeSingle();
  return data ? { valid: true, referrerName: data.name } : { valid: false };
}

function ReferralCodeInput({
  value, onChange, delay = 0,
}: {
  value: string;
  onChange: (v: string, valid: boolean) => void;
  delay?: number;
}) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [referrerName, setReferrerName] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusAnim = useSharedValue(0);

  const borderStyle = useAnimatedStyle(() => {
    const color =
      status === 'valid' ? '#16a34a' :
      status === 'invalid' ? '#dc2626' :
      focusAnim.value === 1 ? ORANGE : '#e0e0e0';
    return { borderColor: color, borderWidth: focusAnim.value === 1 || status !== 'idle' ? 2 : 1 };
  });

  const handleChange = (raw: string) => {
    const v = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setStatus('idle');
    setReferrerName('');
    onChange(v, false);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.length === 6) {
      setStatus('checking');
      debounceRef.current = setTimeout(async () => {
        const result = await verifyReferralCode(v);
        if (result.valid) {
          setStatus('valid');
          setReferrerName(result.referrerName ?? '');
          onChange(v, true);
        } else {
          setStatus('invalid');
          onChange(v, false);
        }
      }, 500);
    }
  };

  const rightEl = (() => {
    if (status === 'checking') return <ActivityIndicator size="small" color={ORANGE} style={{ paddingHorizontal: 14 }} />;
    if (status === 'valid') return <Text style={{ paddingHorizontal: 14, fontSize: 18 }}>✅</Text>;
    if (status === 'invalid') return <Text style={{ paddingHorizontal: 14, fontSize: 18 }}>❌</Text>;
    return null;
  })();

  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={{ gap: 6 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: '#666' }}>
        🎟️ Have a referral code? <Text style={{ color: '#aaa', fontWeight: '400' }}>(optional)</Text>
      </Text>
      <Animated.View style={[{
        backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
        flexDirection: 'row', alignItems: 'center',
      }, borderStyle]}>
        <TextInput
          style={{ flex: 1, padding: 15, fontSize: 16, color: '#1a1a1a', letterSpacing: 3, fontWeight: '700' }}
          placeholder="e.g. A3KF9X"
          placeholderTextColor="#bbb"
          value={value}
          onChangeText={handleChange}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          onFocus={() => { focusAnim.value = withTiming(1, { duration: 200 }); }}
          onBlur={() => { focusAnim.value = withTiming(0, { duration: 200 }); }}
        />
        {rightEl}
      </Animated.View>

      {status === 'valid' && referrerName ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f0fdf4', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#bbf7d0' }}>
          <Text style={{ fontSize: 13 }}>👋</Text>
          <Text style={{ fontSize: 12, color: '#166534', fontWeight: '600', flex: 1 }}>
            Referred by <Text style={{ fontWeight: '800' }}>{referrerName}</Text> — you're both in for a treat!
          </Text>
        </View>
      ) : status === 'invalid' ? (
        <Text style={{ fontSize: 11, color: '#dc2626', fontWeight: '600', paddingLeft: 4 }}>
          Code not found. Check with your friend and try again.
        </Text>
      ) : (
        <Text style={{ fontSize: 11, color: '#aaa', paddingLeft: 4 }}>
          Ask a friend on Fozdrop for their 6-letter code.
        </Text>
      )}
    </Animated.View>
  );
}

function AgreementCheckbox({ agreed, onToggle }: { agreed: boolean; onToggle: () => void }) {
  const checkScale = useSharedValue(1);
  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(agreed ? 1.1 : 1, { duration: 150 }) }],
    borderColor: agreed ? ORANGE : '#ccc',
    backgroundColor: agreed ? ORANGE : '#fff',
  }));
  return (
    <Pressable
      onPress={() => { checkScale.value = withSequence(withSpring(0.85), withSpring(1)); onToggle(); }}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}
    >
      <Animated.View style={[{
        width: 22, height: 22, borderRadius: 7, borderWidth: 2,
        alignItems: 'center', justifyContent: 'center', marginTop: 1,
      }, checkStyle]}>
        {agreed && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>✓</Text>}
      </Animated.View>
      <Text style={{ flex: 1, fontSize: 12, color: '#666', lineHeight: 19 }}>
        I agree to the <Text style={{ color: ORANGE, fontWeight: '800' }}>User Agreement</Text>
        {' '}and <Text style={{ color: ORANGE, fontWeight: '800' }}>Privacy Policy</Text>
      </Text>
    </Pressable>
  );
}

function AnimatedButton({ onPress, loading, label, delay = 0 }: {
  onPress: () => void; loading: boolean; label: string; delay?: number;
}) {
  const scale = useSharedValue(1);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );
  }, [shimmer]);

  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.0, 0.18]),
  }));

  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={btnStyle}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.96, { damping: 10 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 10 }); }}
        onPress={onPress}
        disabled={loading}
        style={{
          borderRadius: 16, overflow: 'hidden', marginTop: 8,
          backgroundColor: ORANGE,
          shadowColor: ORANGE,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.45,
          shadowRadius: 12,
        }}
      >
        <View style={{ padding: 18, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={[{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderRadius: 16,
          }, glowStyle]} />
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontWeight: '900', fontSize: 17, letterSpacing: 0.5 }}>{label}</Text>}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function SignIn() {
  const router = useRouter();

  // ── Recovery Token Sniffer Interceptor ──
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const hash = window.location.hash;
      const search = window.location.search;

      if (
        hash.includes('recovery') || 
        hash.includes('access_token') || 
        search.includes('token') || 
        search.includes('code')
      ) {
        const targetUrl = `https://fozdrop-app.vercel.app/reset-password${search}${hash}`;
        window.location.replace(targetUrl);
      }
    }
  }, []);

  const { height } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPw, setShowRegPw] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('Customer');
  const [referralCode, setReferralCode] = useState('');
  const [referralValid, setReferralValid] = useState(false);

  const tabX = useSharedValue(0);
  const tabIndicatorStyle = useAnimatedStyle(() => ({
    left: interpolate(tabX.value, [0, 1], [5, 148]),
  }));

  const logoPulse = useSharedValue(1);
  useEffect(() => {
    logoPulse.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );
  }, [logoPulse]);
  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: logoPulse.value }] }));

  const handleTabSwitch = (t: Tab) => {
    setTab(t);
    setError('');
    tabX.value = withSpring(t === 'login' ? 0 : 1, { damping: 18, stiffness: 180 });
  };

  const navigateByRole = (role: string | null | undefined) => {
    const dest = role === 'Admin'
      ? '/(super-admin)' as RelativePathString
      : '/(app)/(tabs)/home' as RelativePathString;
    router.replace(dest);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      setTimeout(() => {
        if (window.location.pathname.includes('sign-in')) {
          window.location.href = role === 'Admin' ? '/super-admin' : '/';
        }
      }, 800);
    }
  };

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) { setError('Please fill in all fields'); return; }
    setLoading(true); setError('');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim().toLowerCase(),
      password: loginPassword,
    });
    if (authError) {
      setLoading(false);
      setError(authError.message);
      return;
    }
    let role: string | null = null;
    if (authData.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .maybeSingle();
      role = profile?.role ?? null;
    }
    setLoading(false);
    navigateByRole(role);
  };

  const handleRegister = async () => {
    if (!regName || !regEmail || !regPassword) { setError('Please fill in all required fields'); return; }
    if (!agreed) { setError('Please accept the User Agreement & Privacy Policy'); return; }
    if (regPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (referralCode.length > 0 && referralCode.length < 6) {
      setError('Referral code must be 6 characters'); return;
    }
    if (referralCode.length === 6 && !referralValid) {
      setError('That referral code is invalid. Please check it or leave the field empty.'); return;
    }
    setLoading(true); setError('');
    const { data, error: fnError } = await supabase.functions.invoke('register-user', {
      body: { email: regEmail.trim().toLowerCase(), password: regPassword, name: regName.trim(), phone_number: regPhone.trim(), role: selectedRole },
    });

    if (fnError) {
      setLoading(false);
      try {
        const raw = await fnError?.context?.text?.();
        const parsed = JSON.parse(raw || '{}');
        setError(parsed?.error || 'Registration failed. Please try again.');
      } catch {
        setError('Registration failed. Please try again.');
      }
      return;
    }

    if (data?.session) {
      await supabase.auth.setSession(data.session);
      if (referralCode.length === 6 && referralValid && data.session.user?.id) {
        saveReferredBy(data.session.user.id, referralCode).catch(() => null);
      }
      let role: string | null = null;
      if (data.session.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.session.user.id)
          .maybeSingle();
        role = profile?.role ?? null;
      }
      setLoading(false);
      navigateByRole(role);
      return;
    }

    if (data?.manualLogin) {
      setLoading(false);
      setLoginEmail(regEmail.trim().toLowerCase());
      setLoginPassword(regPassword);
      handleTabSwitch('login');
      setError('Account created! Please tap "Login" to sign in.');
      return;
    }

    setLoading(false);
    setError('Registration failed. Please try again.');
  };

  const heroH = height * 0.32;

  return (
    <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: '#1a0a02' }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <View style={{ height: heroH, backgroundColor: '#1a0a02', overflow: 'hidden', position: 'relative' }}>
          <View style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: ORANGE, opacity: 0.18 }} />
          <View style={{ position: 'absolute', top: 20, left: -80, width: 180, height: 180, borderRadius: 90, backgroundColor: ORANGE_LIGHT, opacity: 0.12 }} />
          <View style={{ position: 'absolute', bottom: -40, right: 40, width: 140, height: 140, borderRadius: 70, backgroundColor: ORANGE_DARK, opacity: 0.22 }} />

          {PARTICLES.map((p) => (
            <FloatingParticle key={p.emoji} emoji={p.emoji} xFraction={p.x} delay={p.delay} height={heroH} />
          ))}

          <View style={{ position: 'absolute', bottom: 28, left: 28, zIndex: 10 }}>
            <Animated.View entering={FadeInDown.delay(100).springify()} style={logoStyle}>
              <Text style={{ fontSize: 46, fontWeight: '900', color: '#fff', letterSpacing: 1.5 }}>
                Foz<Text style={{ color: ORANGE_LIGHT }}>drop</Text>
              </Text>
            </Animated.View>
            <Animated.Text entering={FadeInDown.delay(250).springify()} style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', marginTop: 2, letterSpacing: 0.5 }}>
              🎓 Campus Food Delivery
            </Animated.Text>
          </View>
        </View>

        <Animated.View
          entering={FadeInUp.delay(200).springify()}
          style={{
            flex: 1,
            backgroundColor: '#FAF6F0',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            marginTop: -18,
            padding: 24,
            paddingTop: 28,
            minHeight: height * 0.72,
          }}
        >
          <Animated.View entering={ZoomIn.delay(300).springify()} style={{
            flexDirection: 'row', backgroundColor: '#f0ebe3', borderRadius: 16,
            padding: 5, marginBottom: 28, position: 'relative',
          }}>
            <Animated.View style={[{
              position: 'absolute', top: 5, bottom: 5,
              width: '50%', borderRadius: 12, backgroundColor: ORANGE,
              shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4, shadowRadius: 8,
            }, tabIndicatorStyle]} />
            {(['login', 'register'] as Tab[]).map((t) => (
              <Pressable key={t} onPress={() => handleTabSwitch(t)} style={{ flex: 1, paddingVertical: 11, alignItems: 'center', zIndex: 2 }}>
                <Text style={{ fontWeight: '800', color: tab === t ? '#fff' : '#999', fontSize: 14, letterSpacing: 0.3 }}>
                  {t === 'login' ? '✨ Sign In' : '🚀 Register'}
                </Text>
              </Pressable>
            ))}
          </Animated.View>

          {error ? (
            <Animated.View entering={ZoomIn.springify()} style={{
              backgroundColor: '#fee2e2', padding: 13, borderRadius: 12,
              marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8,
              borderLeftWidth: 3, borderLeftColor: '#dc2626',
            }}>
              <Text style={{ fontSize: 16 }}>⚠️</Text>
              <Text style={{ color: '#dc2626', fontSize: 13, flex: 1, fontWeight: '600' }}>{error}</Text>
            </Animated.View>
          ) : null}

          {tab === 'login' ? (
            <Animated.View entering={SlideInRight.springify()} style={{ gap: 16 }}>
              <AnimatedInput label="📧 Email Address" placeholder="you@university.edu"
                value={loginEmail} onChangeText={setLoginEmail}
                keyboardType="email-address" autoCapitalize="none" delay={100} />

              <AnimatedInput
                label="🔒 Password" placeholder="••••••••"
                value={loginPassword} onChangeText={setLoginPassword}
                secureTextEntry={!showLoginPw} delay={200}
                rightElement={
                  <Pressable onPress={() => setShowLoginPw((v) => !v)} style={{ paddingHorizontal: 14 }}>
                    <Text style={{ fontSize: 11, color: ORANGE, fontWeight: '800', letterSpacing: 0.5 }}>
                      {showLoginPw ? 'HIDE' : 'SHOW'}
                    </Text>
                  </Pressable>
                }
              />

              <Animated.View entering={FadeInDown.delay(250).springify()} style={{ alignItems: 'flex-end', marginTop: -8 }}>
                <Pressable onPress={() => router.push('/(auth)/forgot-password')} hitSlop={10}>
                  <Text style={{ fontSize: 13, color: ORANGE, fontWeight: '700' }}>
                    Forgot Password?
                  </Text>
                </Pressable>
              </Animated.View>

              <AnimatedButton onPress={handleLogin} loading={loading} label="Sign In →" delay={300} />

              <Animated.Text entering={FadeInDown.delay(400)} style={{ textAlign: 'center', color: '#aaa', fontSize: 12, marginTop: 4 }}>
                Don't have an account?{' '}
                <Text onPress={() => handleTabSwitch('register')} style={{ color: ORANGE, fontWeight: '800' }}>
                  Register here
                </Text>
              </Animated.Text>
            </Animated.View>
          ) : (
            <Animated.View entering={SlideInLeft.springify()} style={{ gap: 16 }}>
              <AnimatedInput label="👤 Full Name *" placeholder="Your full name"
                value={regName} onChangeText={setRegName} delay={100} />

              <AnimatedInput label="📧 Email Address *" placeholder="you@university.edu"
                value={regEmail} onChangeText={setRegEmail}
                keyboardType="email-address" autoCapitalize="none" delay={150} />

              <AnimatedInput label="📱 Phone Number" placeholder="+234 800 000 0000"
                value={regPhone} onChangeText={setRegPhone}
                keyboardType="phone-pad" delay={200} />

              <AnimatedInput
                label="🔒 Password *" placeholder="Min. 6 characters"
                value={regPassword} onChangeText={setRegPassword}
                secureTextEntry={!showRegPw} delay={250}
                rightElement={
                  <Pressable onPress={() => setShowRegPw((v) => !v)} style={{ paddingHorizontal: 14 }}>
                    <Text style={{ fontSize: 11, color: ORANGE, fontWeight: '800', letterSpacing: 0.5 }}>
                      {showRegPw ? 'HIDE' : 'SHOW'}
                    </Text>
                  </Pressable>
                }
              />

              <Animated.View entering={FadeInDown.delay(300).springify()}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#666', marginBottom: 10 }}>👥 I am a...</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {ROLES.map((r) => (
                    <RoleCard
                      key={r.value}
                      role={r}
                      selected={selectedRole === r.value}
                      onSelect={() => setSelectedRole(r.value)}
                    />
                  ))}
                </View>
              </Animated.View>

              {selectedRole === 'Customer' && (
                <ReferralCodeInput
                  value={referralCode}
                  onChange={(v, valid) => { setReferralCode(v); setReferralValid(valid); }}
                  delay={325}
                />
              )}

              <Animated.View entering={FadeInDown.delay(350).springify()}>
                <AgreementCheckbox agreed={agreed} onToggle={() => setAgreed((v) => !v)} />
              </Animated.View>

              <AnimatedButton onPress={handleRegister} loading={loading} label="Create Account 🚀" delay={400} />

              <Animated.Text entering={FadeInDown.delay(500)} style={{ textAlign: 'center', color: '#aaa', fontSize: 12, marginTop: 4 }}>
                Already have an account?{' '}
                <Text onPress={() => handleTabSwitch('login')} style={{ color: ORANGE, fontWeight: '800' }}>
                  Sign in
                </Text>
              </Animated.Text>
            </Animated.View>
          )}
          <View style={{ height: 48 }} />
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
