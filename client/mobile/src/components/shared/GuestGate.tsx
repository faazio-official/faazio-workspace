import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, LogIn } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { useThemeMode } from '@/hooks/useThemeMode';

export interface GuestGateProps {
  title: string;
  message: string;
  onSignIn: () => void;
  /** Optional secondary action back to the catalogue. */
  onBrowse?: () => void;
  /** Optional back arrow (pushed screens); tab screens omit it. */
  onBack?: () => void;
}

/**
 * The login wall for an account-bound surface visited while browsing as a guest.
 * It explains why the surface needs an account and offers one primary action —
 * sign in — plus a quiet way back to the catalogue.
 */
export function GuestGate({ title, message, onSignIn, onBrowse, onBack }: GuestGateProps) {
  const insets = useSafeAreaInsets();
  const { palette } = useThemeMode();

  return (
    <View style={[styles.container, { backgroundColor: palette.canvas, paddingTop: insets.top }]}>
      {onBack ? (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onBack}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={ms(24)} color={palette.text} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.body}>
        <View style={[styles.iconCircle, { backgroundColor: palette.accentSoft }]}>
          <LogIn size={ms(26)} color={palette.accent} strokeWidth={2} />
        </View>
        <AppText style={[styles.title, { color: palette.text }]}>{title}</AppText>
        <AppText style={[styles.message, { color: palette.textMuted }]}>{message}</AppText>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: palette.accent }]}
          onPress={onSignIn}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
        >
          <AppText style={[styles.primaryText, { color: palette.onAccent }]}>Sign in</AppText>
        </TouchableOpacity>

        {onBrowse ? (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={onBrowse}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Keep browsing"
          >
            <AppText style={[styles.secondaryText, { color: palette.textMuted }]}>
              Keep browsing
            </AppText>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    minHeight: vs(48),
    justifyContent: 'center',
    paddingHorizontal: hs(8),
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(32),
    paddingBottom: vs(64),
  },
  iconCircle: {
    width: ms(64),
    height: ms(64),
    borderRadius: ms(32),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.SECTION,
  },
  title: {
    fontSize: ms(20),
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: vs(8),
  },
  message: {
    fontSize: ms(13),
    lineHeight: ms(19),
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: hs(300),
  },
  primaryBtn: {
    minHeight: 48,
    minWidth: hs(200),
    borderRadius: ms(24),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACE.SECTION,
  },
  primaryText: {
    fontSize: ms(14),
    fontWeight: '600',
  },
  secondaryBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(16),
    marginTop: vs(4),
  },
  secondaryText: {
    fontSize: ms(12),
    fontWeight: '600',
  },
});
