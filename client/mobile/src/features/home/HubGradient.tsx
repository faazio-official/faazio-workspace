import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGrad, Stop, Rect as SvgRect } from 'react-native-svg';
import { parentRamp } from '@/theme/brandTokens';
import { HEADER_ROW_GAP, HEADER_RAIL_H, HEADER_BOTTOM_PAD, HEADER_SEARCH_H } from '@/features/home/hubHeader';

interface HubGradientProps {
  /** Measured height of the Home hub header — enables the bottom fade into the content bg. */
  height?: number;
  /** Whether the category rail is present — moves the slate tail up past its slot when it is gone. */
  hasRail?: boolean;
}

// Blend from light blue -> slate: starts mid-search-bar, completes just below it
// (spanning the rail slot + HEADER_BOTTOM_PAD when the rail is present). Below that
// point the gradient is pure #f1f5f9, so the collapsed header reads as "search bar +
// slate padding" -- the pinned rail zone merges into the list background instead of
// reading as header chrome. With no curated rail chips the slate tail moves up so no
// empty rail band is left behind.
const TAIL_FROM_BOTTOM = (hasRail: boolean) => (hasRail ? HEADER_ROW_GAP + HEADER_RAIL_H : HEADER_BOTTOM_PAD);

export function HubGradient({ height, hasRail = true }: HubGradientProps) {
  const tailFromBottom = TAIL_FROM_BOTTOM(hasRail);
  const blendStartFromBottom = HEADER_SEARCH_H / 2 + tailFromBottom;
  const blendEndFromBottom = tailFromBottom;
  const hasFade = typeof height === 'number' && height > 0;
  const fadeStartPct = hasFade ? Math.max(0, ((height - blendStartFromBottom) / height) * 100) : 100;
  const fadeEndPct = hasFade ? Math.max(0, ((height - blendEndFromBottom) / height) * 100) : 100;
  const tailColor = hasFade ? '#f1f5f9' : parentRamp.base;

  return (
    <View style={styles.wrap} renderToHardwareTextureAndroid>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGrad id="headerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={parentRamp.base} />
            <Stop offset={`${fadeStartPct}%`} stopColor={parentRamp.baseLift} />
            <Stop offset={`${fadeEndPct}%`} stopColor={tailColor} />
            <Stop offset="100%" stopColor={tailColor} />
          </SvgGrad>
        </Defs>
        <SvgRect width="100%" height="100%" fill="url(#headerGrad)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
});
