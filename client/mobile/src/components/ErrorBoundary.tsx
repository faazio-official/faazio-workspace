import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { reportRenderError } from '@/services/crashReporting';
import { parentRamp } from '@/theme/brandTokens';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Short label shown with the message, e.g. "SubApp" or "App". */
  scope?: string;
  /** When provided, a "Go to Home" action is offered to escape the broken tree. */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render/lifecycle errors in its subtree and shows a recoverable card.
 *
 * The thrown `message` is always surfaced (release builds strip `console.*`, so
 * this is often the only signal) and the first stack frame is shown in dev.
 * Never render props/route params here — message + stack only (PII-free).
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', this.props.scope ?? 'app', error, info);
    // Release default (P0 observability): send message + stacks to the gateway /errors sink. Never
    // renders props/route params here — the report stays PII-free (message + stack only).
    reportRenderError(error, this.props.scope ?? 'app', info.componentStack ?? undefined);
  }

  private reset = () => {
    this.setState({ hasError: false, error: null });
  };

  private goHome = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      const { scope, onReset } = this.props;
      const error = this.state.error;
      const firstFrame = __DEV__ ? error?.stack?.split('\n')[1]?.trim() : undefined;

      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>An unexpected error occurred. Please try again.</Text>
          {!!scope && <Text style={styles.scope}>{scope}</Text>}
          {!!error?.message && (
            <Text style={styles.message} numberOfLines={4}>
              {error.message}
            </Text>
          )}
          {!!firstFrame && (
            <Text style={styles.stack} numberOfLines={2}>
              {firstFrame}
            </Text>
          )}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.button} onPress={this.reset} activeOpacity={0.8}>
              <Text style={styles.buttonText}>Try again</Text>
            </TouchableOpacity>
            {!!onReset && (
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={this.goHome}
                activeOpacity={0.8}
              >
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>Go to Home</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 12,
  },
  scope: {
    fontSize: 11,
    fontWeight: '800',
    color: parentRamp.base,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  message: {
    fontSize: 12,
    color: '#334155',
    textAlign: 'center',
    marginBottom: 6,
  },
  stack: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    height: 44,
    borderRadius: 12,
    backgroundColor: parentRamp.base,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  secondaryButton: {
    backgroundColor: '#eef2ff',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButtonText: {
    color: parentRamp.base,
  },
});
