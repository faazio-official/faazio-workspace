import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Vibration,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Check } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { DURATION, EASE_MOVE } from '@/theme/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { hs, ms } from '@/utils/responsive';

/** Fraction of the card width a rider must drag before the swipe arms Accept. */
const THRESHOLD_RATIO = 0.4;

interface DPSwipeAcceptProps {
  children: React.ReactNode;
  onAccept: () => void;
  disabled?: boolean;
  /** Reveal copy shown behind the card while swiping. */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Swipe-right-to-accept wrapper for an offer card. Core `Animated` only (no
 * reanimated in this layer). The gesture is a power-user shortcut — the card's
 * Accept/Reject buttons remain the accessible primary path. A short haptic fires
 * once the drag passes the arm threshold; under Reduce Motion the snap-back is
 * instant but the gesture still works.
 */
export function DPSwipeAccept({
  children,
  onAccept,
  disabled = false,
  label = 'Swipe to accept',
  style,
}: DPSwipeAcceptProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const widthRef = useRef(0);
  const armed = useRef(false);
  const accepted = useRef(false);
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    widthRef.current = next;
    setWidth(next);
  }, []);

  const settle = useCallback(() => {
    armed.current = false;
    Animated.timing(translateX, {
      toValue: 0,
      duration: reduceMotion ? 0 : DURATION.move,
      easing: EASE_MOVE,
      useNativeDriver: false,
    }).start();
  }, [reduceMotion, translateX]);

  const trigger = useCallback(() => {
    if (accepted.current) return;
    accepted.current = true;
    Vibration.vibrate(30);
    Animated.timing(translateX, {
      toValue: widthRef.current,
      duration: reduceMotion ? 0 : DURATION.exit,
      easing: EASE_MOVE,
      useNativeDriver: false,
    }).start(() => onAccept());
  }, [onAccept, reduceMotion, translateX]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          !disabled &&
          !accepted.current &&
          gesture.dx > 8 &&
          gesture.dx > Math.abs(gesture.dy) * 1.2,
        onPanResponderMove: (_event, gesture) => {
          const max = widthRef.current || 0;
          const next = Math.max(0, Math.min(gesture.dx, max));
          translateX.setValue(next);
          const past = max > 0 && next >= max * THRESHOLD_RATIO;
          if (past && !armed.current) {
            armed.current = true;
            Vibration.vibrate(20);
          } else if (!past && armed.current) {
            armed.current = false;
          }
        },
        onPanResponderRelease: (_event, gesture) => {
          const max = widthRef.current || 0;
          if (max > 0 && gesture.dx >= max * THRESHOLD_RATIO) trigger();
          else settle();
        },
        onPanResponderTerminate: () => settle(),
      }),
    [disabled, settle, translateX, trigger],
  );

  const revealOpacity = translateX.interpolate({
    inputRange: [0, Math.max(1, width * THRESHOLD_RATIO)],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={style} onLayout={onLayout}>
      <Animated.View style={[styles.reveal, { opacity: revealOpacity }]} pointerEvents="none">
        <Check size={ms(18)} color={DELIVERY.onBrand} strokeWidth={2} />
        <AppText style={styles.revealText}>{label}</AppText>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX }] }} {...responder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  reveal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: hs(8),
    paddingHorizontal: hs(16),
    borderRadius: DELIVERY.radius.md,
    backgroundColor: DELIVERY.success,
  },
  revealText: { ...DP_TYPE.label, color: DELIVERY.onBrand, fontWeight: '600' },
});
