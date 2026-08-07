import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { MapPin, Clock } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';

interface DistanceBadgeProps {
  distance: number;
  deliveryTime?: string;
  light?: boolean;
}

const DistanceBadge = memo(function DistanceBadge({ distance, deliveryTime, light = false }: DistanceBadgeProps) {
  const tone = light ? 'rgba(255,255,255,0.85)' : foodTheme.textSecondary;
  return (
    <View style={styles.row}>
      <MapPin size={ms(12)} color={light ? '#ffffff' : foodTheme.textMuted} strokeWidth={2.5} />
      <AppText style={[styles.text, { color: tone }]}>{`${distance.toFixed(1)} km`}</AppText>
      {deliveryTime ? (
        <>
          <View style={[styles.dot, { backgroundColor: light ? 'rgba(255,255,255,0.5)' : foodTheme.divider }]} />
          <Clock size={ms(12)} color={light ? '#ffffff' : foodTheme.textMuted} strokeWidth={2.5} />
          <AppText style={[styles.text, { color: tone }]}>{deliveryTime}</AppText>
        </>
      ) : null}
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
  dot: {
    width: ms(3),
    height: ms(3),
    borderRadius: ms(1.5),
    marginHorizontal: hs(4),
  },
});
