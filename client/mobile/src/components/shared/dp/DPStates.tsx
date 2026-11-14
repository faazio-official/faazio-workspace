import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
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
}

/** Centered empty state: soft tone circle + title + description + optional action. */
export function DPEmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  tone = 'brand',
}: DPEmptyStateProps) {
  return (
    <View style={styles.state}>
      <View style={[styles.stateIcon, { backgroundColor: DP_TONE[tone].bg }]}>
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

/** Shimmering placeholder rows used while a screen's first load is in flight. */
export function DPSkeleton({ lines = 3, style }: DPSkeletonProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
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
  stateIcon: {
    width: ms(64),
    height: ms(64),
    borderRadius: ms(32),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(16),
  },
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