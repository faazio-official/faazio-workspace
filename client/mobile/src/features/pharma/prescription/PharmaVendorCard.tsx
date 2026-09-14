import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Star, Clock, MapPin } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import type { StoreProfile } from '@data/types';
import PharmaImage from '../components/pharma-home/PharmaImage';
import { PHARMA_TEAL } from '../mocks/pharmaHomeFeed';

const IMG_SIZE = 96;

interface PharmaVendorCardProps {
  store: StoreProfile;
  selected: boolean;
  onPress?: (store: StoreProfile) => void;
}

const PharmaVendorCard = memo(function PharmaVendorCard({
  store,
  selected,
  onPress,
}: PharmaVendorCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected]}
      onPress={() => onPress?.(store)}
      activeOpacity={0.94}
      accessibilityRole="button"
      accessibilityLabel={`${store.name}, ${store.distance}`}
    >
      <View style={styles.imageWrap}>
        <PharmaImage uri={store.coverImage} style={styles.image} />
        <View style={styles.distanceBadge}>
          <MapPin size={ms(9)} color="#FFFFFF" strokeWidth={2.4} />
          <AppText style={styles.distanceText}>{store.distance}</AppText>
        </View>
      </View>
      <View style={styles.body}>
        <AppText style={styles.name} numberOfLines={1}>
          {store.name}
        </AppText>
        <View style={styles.metaRow}>
          <View style={styles.ratingBadge}>
            <Star size={ms(10)} color="#FFFFFF" fill="#FFFFFF" strokeWidth={1.5} />
            <AppText style={styles.ratingText}>{store.rating}</AppText>
          </View>
          <View style={styles.timeRow}>
            <Clock size={ms(10)} color="#666666" strokeWidth={1.8} />
            <AppText style={styles.timeText}>{store.deliveryTime}</AppText>
          </View>
        </View>
        {store.offerTag ? (
          <AppText style={styles.offerText} numberOfLines={1}>
            {store.offerTag}
          </AppText>
        ) : null}
      </View>
      <TouchableOpacity
        style={styles.orderPill}
        onPress={() => onPress?.(store)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Order from ${store.name}`}
      >
        <AppText style={styles.orderPillText}>Order</AppText>
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

export default PharmaVendorCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: ms(12),
    padding: hs(10),
  },
  cardSelected: {
    borderColor: PHARMA_TEAL,
    borderWidth: 2,
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
    fontSize: ms(13),
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
    backgroundColor: PHARMA_TEAL,
    borderRadius: ms(4),
    paddingHorizontal: hs(6),
    paddingVertical: vs(2),
    gap: hs(3),
  },
  ratingText: {
    fontSize: ms(10),
    fontWeight: '800',
    color: '#FFFFFF',
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
  offerText: {
    fontSize: ms(9),
    fontWeight: '600',
    color: '#B45309',
  },
  orderPill: {
    marginLeft: hs(10),
    paddingHorizontal: hs(14),
    paddingVertical: vs(8),
    borderRadius: ms(8),
    backgroundColor: PHARMA_TEAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderPillText: {
    fontSize: ms(11),
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
