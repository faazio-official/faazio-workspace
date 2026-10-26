import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { MapPin } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';

interface DistanceBadgeProps {
  distance: number;
  light?: boolean;
}

const DistanceBadge = memo(function DistanceBadge({ distance, light = false }: DistanceBadgeProps) {
  const tone = light ? 'rgba(255,255,255,0.85)' : foodTheme.textSecondary;
  return (
    <View style={styles.row}>
      <MapPin size={ms(12)} color={light ? '#ffffff' : foodTheme.textMuted} strokeWidth={2.5} />
      <AppText style={[styles.text, { color: tone }]}>{`${distance.toFixed(1)} km`}</AppText>
    </View>
  );
});

export default DistanceBadge;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(3),
  },
  text: {
    fontSize: ms(12.5),
    fontWeight: '500',
  },
});
