import {
  View, Text, ScrollView, TextInput, Pressable,
  ActivityIndicator, KeyboardAvoidingView, Linking,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSession } from '@/ctx';
import { submitSupportRequest, getAppIsOpen } from '@/db/api';

const ORANGE = '#F25C19';
const CREAM = '#FAF6F0';

const FAQS = [
  {
    q: 'How do I top up my wallet?',
    a: 'Go to the Wallet tab and tap "Top Up Wallet". Choose a quick amount or enter a custom amount, then confirm.',
  },
  {
    q: 'What happens if my order is delayed?',
    a: 'Your runner is on the way! Orders may take longer during peak hours. You can check the real-time status on your Orders tab.',
  },
  {
    q: 'How do I mark an item as unavailable?',
    a: 'Vendors can toggle item availability directly from the vendor store page or from the Dashboard by using the toggle switch on each menu item.',
  },
  {
    q: 'What is the delivery fee?',
    a: 'A flat delivery fee of ₦199 applies to all orders. This is shown clearly on the checkout screen before you confirm.',
  },
  {
    q: 'Can I cancel an order after placing it?',
    a: 'Currently, orders cannot be cancelled once placed. Please contact support if you have an urgent issue.',
  },
  {
    q: 'Which campus dropoff locations are available?',
    a: 'You can select from pre-approved campus locations on the checkout screen (e.g., Amina Hostel, Faculty of Engineering LT 1, University Library Gate, and more).',
  },
  {
    q: 'How do I become a delivery runner?',
    a: 'Register a new account and select "Delivery Runner" as your role. Your dashboard will show available deliveries to fulfil.',
  },
];

export default function SupportTab() {
  const { session } = useSession();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [appOpen, setAppOpen] = useState(true);

  useFocusEffect(useCallback(() => {
    (async () => { setAppOpen(await getAppIsOpen()); })();
  }, []));

  const handleSubmit = async () => {
    if (!appOpen) { setSubmitError('Fozdrop is currently closed. Please try again when we reopen.'); return; }
    if (!subject.trim()) { setSubmitError('Please enter a subject'); return; }
    if (!message.trim()) { setSubmitError('Please enter a message'); return; }
    if (!session?.user?.id) return;
    setSubmitting(true); setSubmitError('');
    const ok = await submitSupportRequest(subject.trim(), message.trim(), session.user.id);
    setSubmitting(false);
    if (ok) {
      setSubmitSuccess(true);
      setSubject('');
      setMessage('');
    } else {
      setSubmitError('Failed to submit. Please try again.');
    }
  };

  const inputStyle = {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd',
    borderRadius: 10, padding: 13, fontSize: 14, color: '#1a1a1a',
  } as const;

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: CREAM }}
    >
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={{ backgroundColor: ORANGE, paddingTop: 56, paddingBottom: 24, paddingHorizontal: 20 }}>
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>Customer Care</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 }}>
            We're here to help 24/7
          </Text>
        </View>

        {/* Contact Section */}
        <View style={{ margin: 16, backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginBottom: 14 }}>📞 Contact Us</Text>

          <Pressable
            onPress={() => Linking.openURL('https://wa.me/2349066107818')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 22 }}>💬</Text>
            </View>
            <View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a' }}>WhatsApp Support</Text>
              <Text style={{ fontSize: 13, color: '#16a34a' }}>+234 906 610 7818</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => Linking.openURL('mailto:fozdropdelivery@gmail.com')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 22 }}>📧</Text>
            </View>
            <View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a' }}>Email Support</Text>
              <Text style={{ fontSize: 13, color: '#1d4ed8' }}>fozdropdelivery@gmail.com</Text>
            </View>
          </Pressable>
        </View>

        {/* FAQ Section */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginBottom: 12 }}>❓ Frequently Asked Questions</Text>
          {FAQS.map((faq, idx) => (
            <Pressable
              key={idx}
              onPress={() => setOpenFaq(openFaq === idx ? null : idx)}
              style={{ backgroundColor: '#fff', borderRadius: 12, marginBottom: 8, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 }}>
              <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: '#1a1a1a', lineHeight: 20 }}>{faq.q}</Text>
                <Text style={{ fontSize: 18, color: ORANGE }}>{openFaq === idx ? '−' : '+'}</Text>
              </View>
              {openFaq === idx && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#f5f5f5' }}>
                  <Text style={{ fontSize: 13, color: '#555', lineHeight: 20, marginTop: 10 }}>{faq.a}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {/* Report / Message Form */}
        <View style={{ marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 }}>✉️ Send a Message</Text>
          <Text style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>Report an issue or ask us anything</Text>

          {!appOpen && (
            <View style={{ backgroundColor: '#fee2e2', borderRadius: 10, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 20 }}>🔒</Text>
              <Text style={{ fontSize: 13, color: '#dc2626', fontWeight: '700', flex: 1 }}>
                Fozdrop is currently closed. Ticket submission is unavailable.
              </Text>
            </View>
          )}

          {submitSuccess ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Text style={{ fontSize: 40 }}>✅</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#16a34a', marginTop: 12 }}>Message Sent!</Text>
              <Text style={{ fontSize: 13, color: '#555', marginTop: 6, textAlign: 'center' }}>
                Our team will get back to you within 24 hours.
              </Text>
              <Pressable onPress={() => setSubmitSuccess(false)}
                style={{ marginTop: 16, backgroundColor: ORANGE, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Send Another</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#444', marginBottom: 6 }}>Subject *</Text>
                <TextInput
                  style={inputStyle}
                  placeholder="e.g. Order not received"
                  value={subject}
                  onChangeText={setSubject}
                />
              </View>
              <View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#444', marginBottom: 6 }}>Message *</Text>
                <TextInput
                  style={{ ...inputStyle, height: 110, textAlignVertical: 'top' }}
                  placeholder="Describe your issue or question in detail..."
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  numberOfLines={5}
                />
              </View>
              {submitError ? (
                <Text style={{ color: '#dc2626', fontSize: 12 }}>{submitError}</Text>
              ) : null}
              <Pressable onPress={handleSubmit} disabled={submitting}
                style={{ backgroundColor: ORANGE, padding: 15, borderRadius: 12, alignItems: 'center', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Submit Message</Text>}
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
