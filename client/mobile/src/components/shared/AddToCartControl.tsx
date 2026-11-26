import React, { useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Minus, Plus } from 'lucide-react-native';
import { ms } from '@/utils/responsive';
import { DURATION, RE_EASE_ENTRANCE, RE_EASE_MOVE, SCALE } from '@/theme/motion';
import { neutral } from '@/theme/brandTokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import AppText from '@/components/AppText';

export type AddToCartVariant = 'solid' | 'outline';

export interface AddToCartControlProps {
  /** Current cart quantity. `0` shows the "Add" pill; `> 0` shows the stepper. */
  quantity: number;
  onAdd: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
  /** Fill for the "Add" pill (solid) or its border/text (outline). */
  accent: string;
  /** Text/icon colour on a solid `accent`. Defaults to white. */
  onAccent?: string;
  /** Fill for the stepper once added. Defaults to `accent`. */
  addedAccent?: string;
  variant?: AddToCartVariant;
  /** Denser sizing for compact rail cards. */
  compact?: boolean;
  disabled?: boolean;
  /** Product name used to build the accessibility labels. */
  label: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The one add-to-cart affordance: a sentence-case "Add" pill that morphs into a
 * `− qty +` stepper the moment the line exists. Both states share one fixed
 * footprint, so the price row never reflows; the swap is a cross-fade + scale on
 * the entrance curve (docs/UI_DESIGN_SYSTEM.md §3 Pass 9) and reduce-motion
 * flips it instantly. The qty change gets one short success pulse, never a loop.
 */
export function AddToCartControl({
  quantity,
  onAdd,
  onIncrement,
  onDecrement,
  accent,
  onAccent = neutral.card,
  addedAccent,
  variant = 'solid',
  compact = false,
  disabled = false,
  label,
  style,
}: AddToCartControlProps) {
  const expanded = quantity > 0;
  const reduceMotion = useReducedMotion();

  const width = compact ? ms(46) : ms(58);
  const height = compact ? ms(28) : ms(32);
  const iconSize = compact ? ms(11) : ms(12);
  const radius = height / 2;

  const progress = useSharedValue(expanded ? 1 : 0);
  const pulse = useSharedValue(1);
  const firstRender = useRef(true);
  const previousQty = useRef(quantity);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      progress.value = expanded ? 1 : 0;
      return;
    }
    if (reduceMotion) {
      progress.value = expanded ? 1 : 0;
      return;
    }
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: expanded ? DURATION.menu : DURATION.exit,
      easing: expanded ? RE_EASE_ENTRANCE : RE_EASE_MOVE,
    });
  }, [expanded, reduceMotion, progress]);

  useEffect(() => {
    if (previousQty.current === quantity) return;
    const previous = previousQty.current;
    previousQty.current = quantity;
    // The first add already animates the whole pill into the stepper; the pulse is
    // only for subsequent +/- taps so the two entrances never fight.
    if (reduceMotion || quantity <= 0 || previous === 0) {
      pulse.value = 1;
      return;
    }
    pulse.value = 1;
    pulse.value = withSequence(
      withTiming(SCALE.knob, { duration: DURATION.fast, easing: RE_EASE_MOVE }),
      withTiming(1, { duration: DURATION.move, easing: RE_EASE_ENTRANCE }),
    );
  }, [quantity, reduceMotion, pulse]);

  const addStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ scale: 1 - 0.1 * progress.value }],
  }));

  const stepperStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.9 + 0.1 * progress.value }],
  }));

  const qtyStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const solid = variant === 'solid';
  const stepAccent = addedAccent ?? accent;
  const addTextColor = solid ? onAccent : accent;
  const stepColor = solid ? onAccent : stepAccent;

  const layerSize = { width, height, borderRadius: radius };

  return (
    <View style={[styles.container, { width, height }, style]}>
      <Animated.View
        pointerEvents={expanded ? 'none' : 'auto'}
        accessibilityElementsHidden={expanded}
        importantForAccessibility={expanded ? 'no-hide-descendants' : 'auto'}
        style={[
          styles.layer,
          layerSize,
          {
            backgroundColor: solid ? accent : neutral.card,
            borderColor: accent,
          },
          addStyle,
        ]}
      >
        <TouchableOpacity
          style={styles.fillCenter}
          onPress={onAdd}
          disabled={disabled}
          activeOpacity={0.85}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Add ${label} to cart`}
          accessibilityState={{ disabled }}
        >
          <AppText
            style={[styles.addText, { fontSize: compact ? ms(11) : ms(12), color: addTextColor }]}
          >
            Add
          </AppText>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        pointerEvents={expanded ? 'auto' : 'none'}
        accessibilityElementsHidden={!expanded}
        importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}
        style={[
          styles.layer,
          styles.row,
          layerSize,
          {
            backgroundColor: solid ? stepAccent : neutral.card,
            borderColor: stepAccent,
          },
          stepperStyle,
        ]}
      >
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={onDecrement}
          disabled={disabled || !onDecrement}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Remove one ${label}`}
          accessibilityState={{ disabled: disabled || !onDecrement }}
        >
          <Minus size={iconSize} color={stepColor} strokeWidth={2.6} />
        </TouchableOpacity>

        <Animated.View style={qtyStyle}>
          <AppText style={[styles.qty, { fontSize: compact ? ms(11) : ms(12), color: stepColor }]}>
            {quantity > 0 ? quantity : 1}
          </AppText>
        </Animated.View>

        <TouchableOpacity
          style={styles.stepBtn}
          onPress={onIncrement}
          disabled={disabled || !onIncrement}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Add one more ${label}`}
          accessibilityState={{ disabled: disabled || !onIncrement }}
        >
          <Plus size={iconSize} color={stepColor} strokeWidth={2.6} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

export default AddToCartControl;

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-end',
  },
  layer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
  },
  fillCenter: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  stepBtn: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qty: {
    fontWeight: '600',
    minWidth: ms(12),
    textAlign: 'center',
  },
});
