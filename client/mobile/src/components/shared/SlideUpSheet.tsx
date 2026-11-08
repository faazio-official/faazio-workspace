import React, { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Modal,
  View,
  Pressable,
  StyleSheet,
  Animated,
  PanResponder,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hs, ms, vs } from '@/utils/responsive';
import { DURATION, EASING } from '@/theme/motion';
import { neutral } from '@/theme/brandTokens';
import { SHADOW_COLOR } from '@/theme/tokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface SlideUpSheetProps {
  visible: boolean;
  onRequestClose: () => void;
  /** Optional fixed content rendered above the sheet children (e.g. a grab bar). */
  sheetTop?: ReactNode;
  children: ReactNode;
}

/**
 * Bottom sheet with a fading backdrop and a card that slides up from the
 * bottom. Enters on the entrance curve and leaves ~20% faster, with the
 * backdrop and card animating together (docs/UI_DESIGN_SYSTEM.md §3 Pass 9).
 * Drag the grab handle down to dismiss; the translation clamps at the resting
 * position and rubber-bands below it, so it respects its bounds.
 */
const SlideUpSheet = memo(function SlideUpSheet({
  visible,
  onRequestClose,
  sheetTop,
  children,
}: SlideUpSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [rendered, setRendered] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReducedMotion();
  const onRequestCloseRef = useRef(onRequestClose);
  onRequestCloseRef.current = onRequestClose;

  const snapBack = () => {
    Animated.timing(panY, {
      toValue: 0,
      duration: reduceMotion ? 0 : DURATION.press,
      useNativeDriver: true,
      easing: EASING,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => {
        // Never pull above the resting position; rubber-band upward past it.
        const dy = gesture.dy > 0 ? gesture.dy : gesture.dy * 0.15;
        panY.setValue(Math.max(0, dy));
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 120 || gesture.vy > 1.2) {
          onRequestCloseRef.current();
        } else {
          snapBack();
        }
      },
      onPanResponderTerminate: snapBack,
    }),
  ).current;

  useEffect(() => {
    if (visible) {
      panY.setValue(0);
      setRendered(true);
    } else if (rendered) {
      Animated.timing(progress, {
        toValue: 0,
        duration: reduceMotion ? 0 : DURATION.exit,
        useNativeDriver: true,
        easing: EASING,
      }).start(() => setRendered(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (rendered) {
      Animated.timing(progress, {
        toValue: 1,
        duration: reduceMotion ? 0 : DURATION.enter,
        useNativeDriver: true,
        easing: EASING,
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

        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [{ translateY: Animated.add(cardTranslateY, panY) }],
              paddingBottom: Math.max(insets.bottom, vs(16)),
              maxHeight: windowHeight * 0.85,
            },
          ]}
        >
          <View style={styles.handleArea} {...panResponder.panHandlers}>
            <View style={styles.grabber} />
          </View>
          {sheetTop}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
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
    backgroundColor: neutral.card,
    borderTopLeftRadius: ms(28),
    borderTopRightRadius: ms(28),
    paddingHorizontal: hs(24),
    paddingTop: vs(10),
    alignItems: 'center',
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  handleArea: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: vs(8),
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: neutral.border,
  },
  body: {
    alignSelf: 'stretch',
  },
  bodyContent: {
    alignItems: 'center',
    paddingBottom: vs(8),
  },
});
