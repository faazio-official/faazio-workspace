import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGrad, Stop, Rect as SvgRect, Circle as SvgCircle } from 'react-native-svg';
import { SCREEN_W, hs, vs, ms } from '@/utils/responsive';

export function HubGradient() {
  return (
    <View style={styles.wrap} renderToHardwareTextureAndroid>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGrad id="headerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#1162D3" />
            <Stop offset="50%" stopColor="#2F80ED" />
            <Stop offset="100%" stopColor="#7CB3FF" stopOpacity={0.85} />
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
    borderBottomLeftRadius: ms(32),
    borderBottomRightRadius: ms(32),
    overflow: 'hidden',
  },
});
