import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGrad, Stop, Rect as SvgRect, Circle as SvgCircle } from 'react-native-svg';
import { SCREEN_W, hs, vs, ms } from '@/utils/responsive';
import { HEADER_ROW_GAP, HEADER_RAIL_H, HEADER_BOTTOM_PAD, HEADER_SEARCH_H } from '@/features/home/hubHeader';

interface HubGradientProps {
  /** Measured height of the Home hub header — enables the bottom fade into the content bg. */
  height?: number;
}

// Blend from light blue -> slate: starts mid-search-bar, completes just below it
// (+ HEADER_BOTTOM_PAD). Below that point the gradient is pure #f1f5f9, so the
// collapsed header reads as "search bar + slate padding" -- the faded rail zone
// merges seamlessly with the list background instead of reading as header chrome.
const BLEND_START_FROM_BOTTOM =
  HEADER_SEARCH_H / 2 + HEADER_ROW_GAP + HEADER_RAIL_H + HEADER_BOTTOM_PAD;
const BLEND_END_FROM_BOTTOM = HEADER_ROW_GAP + HEADER_RAIL_H;

export function HubGradient({ height }: HubGradientProps) {
  const hasFade = typeof height === 'number' && height > 0;
  const fadeStartPct = hasFade ? Math.max(0, ((height - BLEND_START_FROM_BOTTOM) / height) * 100) : 100;
  const fadeEndPct = hasFade ? Math.max(0, ((height - BLEND_END_FROM_BOTTOM) / height) * 100) : 100;
  const tailColor = hasFade ? '#f1f5f9' : '#7CB3FF';

  return (
    <View style={styles.wrap} renderToHardwareTextureAndroid>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGrad id="headerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#0000FF" />
            <Stop offset="50%" stopColor="#2F80ED" />
            <Stop offset={`${fadeStartPct}%`} stopColor="#7CB3FF" />
            <Stop offset={`${fadeEndPct}%`} stopColor={tailColor} />
            <Stop offset="100%" stopColor={tailColor} />
          </SvgGrad>
        </Defs>
        <SvgRect width="100%" height="100%" fill="url(#headerGrad)" />
        <SvgCircle cx={SCREEN_W * 1.1} cy={vs(-20)} r={ms(96)} fill="rgba(255,255,255,0.05)" />
        <SvgCircle cx={hs(-30)} cy={vs(120)} r={ms(96)} fill="rgba(255,255,255,0.04)" />
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
