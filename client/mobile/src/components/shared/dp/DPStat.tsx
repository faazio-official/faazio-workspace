import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import AppText from '@/components/AppText';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { hs, vs } from '@/utils/responsive';

export type DPStatSize = 'display' | 'title' | 'label';

interface DPStatProps {
  label: string;
  value: string;
  /** Figure role: `display` leads, `title` is the default, `label` is the compact variant. */
  size?: DPStatSize;
  style?: StyleProp<ViewStyle>;
}

/**
 * One figure over its label (the reference "This shift" / route summary stat).
 * Hierarchy comes from size and colour, not weight. `numberOfLines` +
 * `adjustsFontSizeToFit` keep a long ₹ value on one line in a narrow column.
 */
export function DPStat({ label, value, size = 'title', style }: DPStatProps) {
  return (
    <View style={style}>
      <AppText
        style={[
          styles.value,
          size === 'display' && styles.valueDisplay,
          size === 'label' && styles.valueLabel,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </AppText>
      <AppText style={styles.label}>{label}</AppText>
    </View>
  );
}

interface DPStatStripProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Row of `DPStat`s with hairline dividers inserted between them. Callers own each
 * stat's flex via its `style`; the strip owns only the row and the dividers.
 */
export function DPStatStrip({ children, style }: DPStatStripProps) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.strip, style]}>
      {items.map((child, index) => (
        <React.Fragment key={index}>
          {index > 0 ? <View style={styles.divider} /> : null}
          {child}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'center' },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: DELIVERY.border,
    marginHorizontal: hs(12),
  },
  value: { ...DP_TYPE.title, color: DELIVERY.ink, fontVariant: ['tabular-nums'] },
  valueDisplay: { ...DP_TYPE.display, color: DELIVERY.ink, fontVariant: ['tabular-nums'] },
  valueLabel: { ...DP_TYPE.label, color: DELIVERY.ink, fontWeight: '600', fontVariant: ['tabular-nums'] },
  label: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(2) },
});
