import React, { memo, useEffect, useRef, useState } from 'react';
import { Modal, View, TouchableOpacity, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';

interface ExitConfirmModalProps {
  visible: boolean;
  onKeepExploring: () => void;
  onExit: () => void;
}

/**
 * Exit confirmation sheet. The black backdrop fades in/out; the popup card
 * slides up from the bottom — matching the other sub-apps' slide-in behavior
 * without sliding the dark layer.
 */
const ExitConfirmModal = memo(function ExitConfirmModal({
  visible,
  onKeepExploring,
  onExit,
}: ExitConfirmModalProps) {
  const insets = useSafeAreaInsets();
  const [rendered, setRendered] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
    } else if (rendered) {
      Animated.timing(progress, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.in(Easing.quad),
      }).start(() => setRendered(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (rendered) {
      Animated.timing(progress, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendered]);

  if (!rendered) return null;

  const backdropOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const cardTranslateY = progress.interpolate({ inputRange: [0, 1], outputRange: [320, 0] });

  return (
    <Modal transparent visible animationType="none" onRequestClose={onKeepExploring}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={styles.backdropPress} onPress={onKeepExploring} accessibilityRole="button" accessibilityLabel="Dismiss exit confirmation" />
        </Animated.View>

        <Animated.View style={[styles.sheet, { transform: [{ translateY: cardTranslateY }], paddingBottom: Math.max(insets.bottom, vs(16)) }]}>
          <View style={styles.grabBar} />
          <AppText style={styles.title}>Exit Food?</AppText>
          <AppText style={styles.subtitle}>
            Are you sure you want to exit the current service and return to the main Faazio Hub?
          </AppText>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.keepBtn} onPress={onKeepExploring} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Keep exploring">
              <AppText style={styles.keepText}>Keep Exploring</AppText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exitBtn} onPress={onExit} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Exit to main app">
              <AppText style={styles.exitText}>Exit to Main App</AppText>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});

export default ExitConfirmModal;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  backdropPress: {
    flex: 1,
  },
  sheet: {
    backgroundColor: foodTheme.card,
    borderTopLeftRadius: ms(28),
    borderTopRightRadius: ms(28),
    paddingHorizontal: hs(24),
    paddingTop: vs(10),
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  grabBar: {
    width: hs(48),
    height: vs(6),
    borderRadius: vs(3),
    backgroundColor: '#E2E8F0',
    marginBottom: vs(16),
  },
  title: {
    fontSize: ms(14),
    fontWeight: '900',
    color: foodTheme.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: ms(10),
    fontWeight: '600',
    color: foodTheme.textSecondary,
    textAlign: 'center',
    lineHeight: vs(15),
    marginTop: vs(6),
    paddingHorizontal: hs(12),
  },
  buttons: {
    flexDirection: 'row',
    gap: hs(12),
    marginTop: vs(20),
    width: '100%',
  },
  keepBtn: {
    flex: 1,
    height: Math.max(42, vs(42)),
    borderRadius: ms(12),
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepText: {
    color: '#475569',
    fontSize: ms(10),
    fontWeight: '900',
  },
  exitBtn: {
    flex: 1,
    height: Math.max(42, vs(42)),
    borderRadius: ms(12),
    backgroundColor: foodTheme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitText: {
    color: foodTheme.white,
    fontSize: ms(10),
    fontWeight: '900',
  },
});
