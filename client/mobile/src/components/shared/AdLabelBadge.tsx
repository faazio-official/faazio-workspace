import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { hs, vs, ms } from '@/utils/responsive';
import AppText from '@/components/AppText';

interface AdLabelBadgeProps {
  size?: 'sm' | 'md';
}

// Minimal "AD" disclosure pill, absolute-positioned over image-based cards.
// Default bottom-right per Home spec; position is set by the parent wrapper.
const AdLabelBadge = memo(function AdLabelBadge({ size = 'sm' }: AdLabelBadgeProps) {
  return (
    <View style={[styles.badge, size === 'md' && styles.badgeMd]}>
      <AppText style={[styles.text, size === 'md' && styles.textMd]}>AD</AppText>
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
  badgeMd: {
    paddingHorizontal: hs(7),
    paddingVertical: vs(2),
    borderRadius: ms(5),
  },
  text: {
    color: '#ffffff',
    fontSize: ms(6.5),
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  textMd: {
    fontSize: ms(7.5),
    letterSpacing: 0.8,
  },
});
