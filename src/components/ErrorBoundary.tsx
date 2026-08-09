import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; message: string };

/**
 * Global error boundary — catches any JS rendering error and shows a
 * recovery screen instead of a blank white/black screen.
 *
 * Placed at the very root of the app so it catches errors from all
 * layouts and screens, including post-login rendering failures on iOS/Safari.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // Log to console for debugging; Sentry wrapping in _layout.tsx captures it too
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReload = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = '/';
    } else {
      // On native, reset local state so the tree re-mounts
      this.setState({ hasError: false, message: '' });
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a0a02',
          padding: 32,
        }}
      >
        <Text style={{ fontSize: 48, marginBottom: 16 }}>⚠️</Text>
        <Text
          style={{
            color: '#fff',
            fontSize: 20,
            fontWeight: '700',
            marginBottom: 8,
            textAlign: 'center',
          }}
        >
          Something went wrong
        </Text>
        <Text
          style={{
            color: 'rgba(255,255,255,0.55)',
            fontSize: 14,
            marginBottom: 32,
            textAlign: 'center',
            lineHeight: 20,
          }}
        >
          {this.state.message}
        </Text>
        <Pressable
          onPress={this.handleReload}
          style={{
            backgroundColor: '#F25C19',
            paddingHorizontal: 32,
            paddingVertical: 14,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
            Back to Home
          </Text>
        </Pressable>
      </View>
    );
  }
}
