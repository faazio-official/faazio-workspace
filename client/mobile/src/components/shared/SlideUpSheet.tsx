import React, { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, View, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hs, ms, vs } from '@/utils/responsive';

interface SlideUpSheetProps {
  visible: boolean;
  onRequestClose: () => void;
  /** Optional fixed content rendered above the sheet children (e.g. a grab bar). */
  sheetTop?: ReactNode;
  children: ReactNode;
}

/**
 * Bottom sheet with a fading black backdrop and a card that slides up from the
 * bottom — the same arrival animation Food's exit sheet uses. The backdrop
 * fades in/out while the card translates 0→1; content (title, buttons) is
 * supplied by the caller so it can be shared across sub-apps with per-app
 * titles/accents.
 */
const SlideUpSheet = memo(function SlideUpSheet({
  visible,
  onRequestClose,
  sheetTop,
  children,
}: SlideUpSheetProps) {
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
    <Modal transparent visible animationType="none" onRequestClose={onRequestClose}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={styles.backdropPress} onPress={onRequestClose} accessibilityRole="button" accessibilityLabel="Dismiss" />
        </Animated.View>

        <Animated.View style={[styles.sheet, { transform: [{ translateY: cardTranslateY }], paddingBottom: Math.max(insets.bottom, vs(16)) }]}>
          {sheetTop}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
});

export default SlideUpSheet;

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
    backgroundColor: '#FFFFFF',
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
});
