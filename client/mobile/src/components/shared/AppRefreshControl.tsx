import React from 'react';
import { RefreshControl, type RefreshControlProps } from 'react-native';
import { neutral, parentRamp } from '@/theme/brandTokens';

export interface AppRefreshControlProps {
  /** True while the manual pull is in flight. */
  refreshing: boolean;
  /** Re-run the surface's read. Must never clear existing rows on failure. */
  onRefresh: () => void;
  /** Shift the spinner below an overlay header (Android). */
  progressViewOffset?: number;
  accessibilityLabel?: string;
}

/**
 * The single pull-to-refresh control for the Faazio shell. Every surface wraps
 * the native `RefreshControl` with the Faazio Blue tint so the indicator never
 * drifts per screen (`parentRamp.base` is defined once in the theme tokens).
 *
 * Android's `ScrollView` clones the `refreshControl` element and passes the
 * scroll content as its `children` (ScrollView.js wraps it in an
 * `AndroidSwipeRefreshLayout`). This component must therefore forward
 * `children`/`style` and any extra props to the native control — dropping them
 * silently discards the whole list body.
 */
export function AppRefreshControl({
  refreshing,
  onRefresh,
  progressViewOffset,
  accessibilityLabel = 'Pull to refresh',
  ...rest
}: AppRefreshControlProps & Omit<RefreshControlProps, 'refreshing' | 'onRefresh'>) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={parentRamp.base}
      colors={[parentRamp.base]}
      progressBackgroundColor={neutral.card}
      progressViewOffset={progressViewOffset}
      accessibilityLabel={accessibilityLabel}
      {...rest}
    />
  );
}

export default AppRefreshControl;
