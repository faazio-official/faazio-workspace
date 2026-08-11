import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Star, Clock, MapPin, ChevronRight } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import type { MartLocalVendor } from '../../mocks/martHomeFeed';
import MartImage from './MartImage';

const IMG_SIZE = 96;
const MART_YELLOW = '#FFC107';

interface LocalVendorCardProps {
  vendor: MartLocalVendor;
  onPress?: (vendor: MartLocalVendor) => void;
}

const LocalVendorCard = memo(function LocalVendorCard({
  vendor,
  onPress,
}: LocalVendorCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(vendor)}
      activeOpacity={0.94}
      accessibilityRole="button"
      accessibilityLabel={`${vendor.name}, ${vendor.distance}`}
    >
      <View style={styles.imageWrap}>
        <MartImage uri={vendor.imageUrl} style={styles.image} />
        <View style={styles.distanceBadge}>
          <MapPin size={ms(9)} color="#FFFFFF" strokeWidth={2.4} />
          <AppText style={styles.distanceText}>{vendor.distance}</AppText>
        </View>
      </View>
      <View style={styles.body}>
        <AppText style={styles.name} numberOfLines={1}>
          {vendor.name}
        </AppText>
        <View style={styles.metaRow}>
          <View style={styles.ratingBadge}>
            <Star size={ms(10)} color="#FFFFFF" fill="#FFFFFF" strokeWidth={1.5} />
            <AppText style={styles.ratingText}>{vendor.rating}</AppText>
          </View>
          <View style={styles.timeRow}>
            <Clock size={ms(10)} color="#666666" strokeWidth={1.8} />
            <AppText style={styles.timeText}>{vendor.deliveryTime}</AppText>
          </View>
        </View>
        <View style={styles.ctaRow}>
          <AppText style={styles.ctaText}>Visit Store</AppText>
          <ChevronRight size={ms(14)} color={MART_YELLOW} strokeWidth={2.6} />
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default LocalVendorCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: ms(12),
    padding: hs(10),
    marginHorizontal: hs(16),
  },
  imageWrap: {
    width: IMG_SIZE,
    height: IMG_SIZE,
    borderRadius: ms(10),
    backgroundColor: '#FAFAFA',
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  distanceBadge: {
    position: 'absolute',
    bottom: vs(6),
    left: hs(6),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: ms(6),
    paddingHorizontal: hs(6),
    paddingVertical: vs(2),
    gap: hs(2),
  },
  distanceText: {
    fontSize: ms(9),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  body: {
    flex: 1,
    marginLeft: hs(12),
    gap: vs(6),
  },
  name: {
    fontSize: ms(14),
    fontWeight: '700',
    color: '#1E2022',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MART_YELLOW,
    borderRadius: ms(4),
    paddingHorizontal: hs(6),
    paddingVertical: vs(2),
    gap: hs(3),
  },
  ratingText: {
    fontSize: ms(10),
    fontWeight: '800',
    color: '#1E2022',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
  },
  timeText: {
    fontSize: ms(10),
    fontWeight: '600',
    color: '#666666',
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(3),
    alignSelf: 'flex-start',
  },
  ctaText: {
    fontSize: ms(11),
    fontWeight: '700',
    color: MART_YELLOW,
  },
});
