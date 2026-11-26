import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { neutral } from '@/theme/brandTokens';
import { ms, vs, hs } from '@/utils/responsive';

/**
 * A white rounded surface on the grouped `canvas` background. The PDP uses these so the buy box,
 * product information and reviews read as distinct blocks instead of one flat scroll.
 */
export default function SurfaceCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: neutral.card,
    borderRadius: ms(16),
    paddingHorizontal: hs(16),
    paddingVertical: vs(14),
  },
});
