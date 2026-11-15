import React, { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import AppText from '@/components/AppText';
import { DELIVERY, DP_TONE, DP_TYPE, type DpTone } from '@/theme/deliveryTokens';
import { hs, ms, vs } from '@/utils/responsive';
import { DPButton } from './DPButton';

interface DPEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: DpTone;
  /** Tighter geometry for an empty region inside a card or section. */
  compact?: boolean;
}

/** Centered empty state: soft tone circle + title + description + optional action. */
export function DPEmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  tone = 'brand',
  compact = false,
}: DPEmptyStateProps) {
  return (
    <View style={[styles.state, compact && styles.stateCompact]}>
      <View
        style={[
          styles.stateIcon,
          compact && styles.stateIconCompact,
          { backgroundColor: DP_TONE[tone].bg },
        ]}
      >
        {icon ?? <View style={[styles.stateDot, { backgroundColor: DP_TONE[tone].fg }]} />}
      </View>
      <AppText style={styles.stateTitle}>{title}</AppText>
      {description ? <AppText style={styles.stateDescription}>{description}</AppText> : null}
      {actionLabel && onAction ? (
        <View style={styles.stateAction}>
          <DPButton label={actionLabel} onPress={onAction} variant="outline" size="sm" fullWidth={false} />
        </View>
      ) : null}
    </View>
  );
}

interface DPErrorStateProps {
  title?: string;
  description?: string;
  retryLabel?: string;
  onRetry: () => void;
}

/** Destructive-tone error state with retry, same geometry as the empty state. */
export function DPErrorState({
  title = 'Something went wrong',
  description,
  retryLabel = 'Try again',
  onRetry,
}: DPErrorStateProps) {
  return (
    <DPEmptyState
      tone="danger"
      title={title}
      description={description}
      actionLabel={retryLabel}
      onAction={onRetry}
    />
  );
}

interface DPSkeletonProps {
  lines?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Placeholder rows while a screen's first load is in flight. A single settle to the
 * resting opacity — never a looping pulse (`docs/UI_DESIGN_SYSTEM.md` §10) — and it
 * holds still under Reduce Motion.
 */
export function DPSkeleton({ lines = 3, style }: DPSkeletonProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    let mounted = true;
    let animation: Animated.CompositeAnimation | undefined;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!mounted || reduced) {
        opacity.setValue(0.75);
        return;
      }
      animation = Animated.timing(opacity, {
        toValue: 0.75,
        duration: 480,
        useNativeDriver: true,
      });
      animation.start();
    });
    return () => {
      mounted = false;
      animation?.stop();
    };
  }, [opacity]);

  return (
    <View style={style}>
      {Array.from({ length: lines }).map((_, index) => (
        <Animated.View
          key={index}
          style={[styles.skeletonRow, { opacity, width: index === lines - 1 ? '62%' : '100%' }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', paddingVertical: vs(40), paddingHorizontal: hs(24) },
  stateCompact: { paddingVertical: vs(20), paddingHorizontal: hs(12) },
  stateIcon: {
    width: ms(64),
    height: ms(64),
    borderRadius: ms(32),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(16),
  },
  stateIconCompact: { width: ms(44), height: ms(44), borderRadius: ms(22), marginBottom: vs(10) },
  stateDot: { width: ms(20), height: ms(20), borderRadius: ms(10) },
  stateTitle: { ...DP_TYPE.label, color: DELIVERY.ink, fontWeight: '600', textAlign: 'center' },
  stateDescription: {
    ...DP_TYPE.body,
    color: DELIVERY.inkMuted,
    textAlign: 'center',
    marginTop: vs(6),
  },
  stateAction: { marginTop: vs(16) },
  skeletonRow: {
    height: vs(14),
    borderRadius: ms(7),
    backgroundColor: DELIVERY.surfaceAlt,
    marginBottom: vs(10),
  },
});