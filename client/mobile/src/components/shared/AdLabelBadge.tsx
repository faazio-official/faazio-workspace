import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { hs, vs, ms } from '@/utils/responsive';
import AppText from '@/components/AppText';
import { neutral } from '@/theme/brandTokens';

interface AdLabelBadgeProps {
  size?: 'sm' | 'md';
  /** `dark` (default) = translucent dark pill + white "AD"; `light` = gray pill + black "Ad". */
  tone?: 'dark' | 'light';
}

// Minimal "AD" disclosure pill, absolute-positioned over image-based cards.
// Default bottom-right per Home spec; position is set by the parent wrapper.
const AdLabelBadge = memo(function AdLabelBadge({ size = 'sm', tone = 'dark' }: AdLabelBadgeProps) {
  return (
    <View
      style={[
        styles.badge,
        tone === 'light' && styles.badgeLight,
        size === 'md' && styles.badgeMd,
      ]}
    >
      <AppText
        style={[styles.text, tone === 'light' && styles.textLight, size === 'md' && styles.textMd]}
      >
        {tone === 'light' ? 'Ad' : 'AD'}
      </AppText>
    </View>
  );
});

export default AdLabelBadge;

const styles = StyleSheet.create({
  badge: {
    backgroundColor: 'rgba(15,23,42,0.55)',
    paddingHorizontal: hs(5),
    paddingVertical: vs(1.5),
    borderRadius: ms(4),
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  badgeLight: {
    backgroundColor: 'rgba(229,231,235,0.95)',
    borderColor: 'rgba(0,0,0,0.06)',
  },
  badgeMd: {
    paddingHorizontal: hs(7),
    paddingVertical: vs(2),
    borderRadius: ms(5),
  },
  text: {
    color: '#ffffff',
    fontSize: Math.max(11, ms(11)),
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  textLight: {
    color: neutral.ink,
    letterSpacing: 0,
  },
  textMd: {
    fontSize: ms(12),
    letterSpacing: 0.3,
  },
});
