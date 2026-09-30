import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';

interface VendorRatingSummaryBarProps {
  average: number;
  count: number;
  /** Counts for 1..5 stars, index 0 = 1 star. */
  distribution: number[];
  activeColor?: string;
}

/** Compact read-only aggregate: big average + stars + review count + bars. */
const VendorRatingSummaryBar = memo(function VendorRatingSummaryBar({
  average,
  count,
  distribution,
  activeColor = '#F59E0B',
}: VendorRatingSummaryBarProps) {
  const rounded = Math.round(average);
  const max = Math.max(1, ...distribution);

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <AppText style={styles.average}>{average.toFixed(1)}</AppText>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              size={ms(13)}
              color={star <= rounded ? activeColor : '#D1D5DB'}
              fill={star <= rounded ? activeColor : 'transparent'}
              strokeWidth={2}
            />
          ))}
        </View>
        <AppText style={styles.count}>
          {count} {count === 1 ? 'review' : 'reviews'}
        </AppText>
      </View>

      <View style={styles.right}>
        {[5, 4, 3, 2, 1].map((star) => {
          const value = distribution[star - 1] ?? 0;
          return (
            <View key={star} style={styles.barRow}>
              <AppText style={styles.barLabel}>{star}</AppText>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.round((value / max) * 100)}%`, backgroundColor: activeColor },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
});

export default VendorRatingSummaryBar;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(20),
  },
  left: {
    alignItems: 'center',
    minWidth: ms(88),
  },
  average: {
    fontSize: ms(30),
    fontWeight: '900',
    color: '#111827',
  },
  stars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(2),
    marginTop: vs(2),
  },
  count: {
    fontSize: ms(11),
    color: '#6B7280',
    marginTop: vs(3),
  },
  right: {
    flex: 1,
    gap: vs(3),
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
  },
  barLabel: {
    fontSize: ms(10),
    color: '#6B7280',
    width: ms(9),
    textAlign: 'right',
  },
  barTrack: {
    flex: 1,
    height: vs(6),
    borderRadius: ms(3),
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: ms(3),
  },
});
