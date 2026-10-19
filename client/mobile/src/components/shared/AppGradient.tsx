import React, { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';

export interface AppGradientProps {
  colors: readonly string[];
  locations?: readonly number[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * Linear-gradient surface rendered with `react-native-svg` (already a
 * dependency), replacing `expo-linear-gradient` with no new native module.
 * Children render above the gradient.
 */
export function AppGradient({
  colors,
  locations,
  start = { x: 0.5, y: 0 },
  end = { x: 0.5, y: 1 },
  style,
  children,
}: AppGradientProps) {
  const rawId = useId();
  const gradientId = `grad-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const last = colors.length - 1;

  return (
    <View style={style}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <SvgLinearGradient
            id={gradientId}
            x1={`${start.x * 100}%`}
            y1={`${start.y * 100}%`}
            x2={`${end.x * 100}%`}
            y2={`${end.y * 100}%`}
          >
            {colors.map((color, index) => (
              <Stop
                key={`${color}-${index}`}
                offset={`${
                  (locations?.[index] ?? (last === 0 ? 0 : index / last)) * 100
                }%`}
                stopColor={color}
                stopOpacity={1}
              />
            ))}
          </SvgLinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
      {children}
    </View>
  );
}

export default AppGradient;
