import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { hs, ms, vs } from '@/utils/responsive';

interface DPBackLinkProps {
  onPress: () => void;
  label?: string;
  accessibilityLabel?: string;
}

/**
 * Full-screen page back affordance (`ChevronLeft` + label) used above `DPPageHeader`
 * on the stack detail screens (Route, Earnings detail, Settings, Support). One
 * owner of the back row, so the four screens stop re-literalising it.
 */
export function DPBackLink({ onPress, label = 'Back', accessibilityLabel = 'Back' }: DPBackLinkProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.back, pressed && styles.pressed]}
    >
      <ChevronLeft size={ms(18)} color={DELIVERY.brand} strokeWidth={2} />
      <AppText style={styles.label}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(2),
    alignSelf: 'flex-start',
    minHeight: DELIVERY.touch.min,
    paddingTop: vs(8),
    paddingBottom: vs(4),
  },
  pressed: { opacity: 0.7 },
  label: { ...DP_TYPE.label, color: DELIVERY.brand, fontWeight: '600' },
});
