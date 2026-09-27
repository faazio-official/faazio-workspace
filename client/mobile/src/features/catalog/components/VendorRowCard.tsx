import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { MapPin, Star } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import type { VendorMatch } from '@/services/categoryVendors';

interface VendorRowCardProps {
  match: VendorMatch;
  onPress: () => void;
}

/** Locality derived from the store's address (first two comma-separated parts). */
function locality(store: VendorMatch['store']): string {
  if (store.address) {
    return store.address.split(',').slice(0, 2).join(',').trim();
  }
  return store.distance;
}

/**
 * Compact one-per-row vendor card for the category drill-in page. Shows a cover
 * thumbnail, the vendor name, locality + distance, and rating. Tapping opens the
 * vendor's details page with the section's search pre-applied.
 */
const VendorRowCard = memo(function VendorRowCard({ match, onPress }: VendorRowCardProps) {
  const { store, matchCount } = match;
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={store.name}
    >
      <View style={styles.thumbWrap}>
        <ExpoImage source={{ uri: store.coverImage }} style={styles.thumb} contentFit="cover" cachePolicy="memory-disk" />
      </View>

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <AppText style={styles.name} numberOfLines={1}>{store.name}</AppText>
          <View style={styles.ratingWrap}>
            <Star size={ms(11)} color="#F59E0B" fill="#F59E0B" />
            <AppText style={styles.rating}>{store.rating}</AppText>
          </View>
        </View>

        <View style={styles.metaRow}>
          <MapPin size={ms(12)} color="#94a3b8" />
          <AppText style={styles.metaText} numberOfLines={1}>
            {locality(store)} · {store.distance}
          </AppText>
        </View>

        {matchCount > 0 && (
          <AppText style={styles.count}>{matchCount} {matchCount === 1 ? 'match' : 'matches'}</AppText>
        )}
      </View>
    </TouchableOpacity>
  );
});

export default VendorRowCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(12),
    paddingVertical: SPACE.ITEM,
    paddingHorizontal: hs(16),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  thumbWrap: {
    width: ms(52),
    height: ms(52),
    borderRadius: ms(12),
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  info: {
    flex: 1,
    gap: vs(3),
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: hs(8),
  },
  name: {
    flex: 1,
    fontSize: ms(13),
    fontWeight: '800',
    color: '#1E2022',
  },
  ratingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(3),
  },
  rating: {
    fontSize: ms(11),
    fontWeight: '800',
    color: '#1E2022',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(5),
  },
  metaText: {
    flex: 1,
    fontSize: ms(10),
    fontWeight: '500',
    color: '#64748b',
  },
  count: {
    fontSize: ms(9),
    fontWeight: '700',
    color: '#94a3b8',
  },
});
