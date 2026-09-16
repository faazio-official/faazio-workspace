import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGrad, Stop, Rect as SvgRect, Circle as SvgCircle } from 'react-native-svg';
import { SCREEN_W, hs, vs, ms } from '@/utils/responsive';

/**
 * The shared sub-app header gradient backdrop (decorative circles on a
 * vertical gradient). Reused by `SubAppHeader` (Food/Pharma) and the lean
 * `MartSubAppHeader`.
 */
const SubAppHeaderBackdrop = memo(function SubAppHeaderBackdrop({ gradient }: { gradient: [string, string] }) {
  return (
    <Svg style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgGrad id="subHeaderGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={gradient[0]} />
          <Stop offset="100%" stopColor={gradient[1]} />
        </SvgGrad>
      </Defs>
      <SvgRect width="100%" height="100%" fill="url(#subHeaderGrad)" />
      <SvgCircle cx={SCREEN_W * 1.1} cy={vs(-20)} r={ms(96)} fill="rgba(255,255,255,0.05)" />
      <SvgCircle cx={hs(-30)} cy={vs(120)} r={ms(96)} fill="rgba(255,255,255,0.04)" />
    </Svg>
  );
});

export default SubAppHeaderBackdrop;
