import React, { memo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ChevronRight, Clock, MapPin, Star } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import type { StoreProfile } from '@data/types';
import { PHARMA_TEAL } from '../../mocks/pharmaHomeFeed';
import PharmaImage from './PharmaImage';

const IMG_SIZE = 96;

interface LocalMedicalCardProps {
  store: StoreProfile;
  onPress?: (store: StoreProfile) => void;
}

const LocalMedicalCard = memo(function LocalMedicalCard({ store, onPress }: LocalMedicalCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(store)}
      activeOpacity={0.94}
      accessibilityRole="button"
      accessibilityLabel={`${store.name}, ${store.distance}`}
    >
      <View style={styles.imageWrap}>
        <PharmaImage uri={store.coverImage} style={styles.image} contentFit="cover" />
        <View style={styles.distanceBadge}>
          <MapPin size={ms(9)} color="#FFFFFF" strokeWidth={2.4} />
          <AppText style={styles.distanceText}>{store.distance}</AppText>
        </View>
      </View>

      <View style={styles.body}>
        <AppText style={styles.name} numberOfLines={1}>{store.name}</AppText>
        <View style={styles.metaRow}>
          <View style={styles.ratingBadge}>
            <Star size={ms(10)} color="#FFFFFF" fill="#FFFFFF" strokeWidth={1.5} />
            <AppText style={styles.ratingText}>{store.rating}</AppText>
          </View>
          <View style={styles.timeRow}>
            <Clock size={ms(10)} color="#64748B" strokeWidth={1.8} />
            <AppText style={styles.timeText}>{store.deliveryTime}</AppText>
          </View>
        </View>
        {store.offerTag ? (
          <AppText style={styles.offerText} numberOfLines={1}>{store.offerTag}</AppText>
        ) : null}
        <View style={styles.ctaRow}>
          <AppText style={styles.ctaText}>Visit Store</AppText>
          <ChevronRight size={ms(14)} color={PHARMA_TEAL} strokeWidth={2.6} />
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default LocalMedicalCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: hs(16),
    padding: hs(10),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6F2F1',
    borderRadius: ms(12),
  },
  imageWrap: {
    width: IMG_SIZE,
    height: IMG_SIZE,
    borderRadius: ms(10),
    backgroundColor: '#F1FAF9',
    overflow: 'hidden',
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  distanceBadge: {
    position: 'absolute',
    bottom: vs(6),
    left: hs(6),
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(2),
    paddingHorizontal: hs(6),
    paddingVertical: vs(2),
    borderRadius: ms(6),
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  distanceText: { fontSize: ms(9), fontWeight: '700', color: '#FFFFFF' },
  body: { flex: 1, marginLeft: hs(12), gap: vs(6) },
  name: { fontSize: ms(14), fontWeight: '800', color: '#12312F' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: hs(10) },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(3),
    paddingHorizontal: hs(6),
    paddingVertical: vs(2),
    borderRadius: ms(4),
    backgroundColor: PHARMA_TEAL,
  },
  ratingText: { fontSize: ms(10), fontWeight: '800', color: '#FFFFFF' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: hs(3) },
  timeText: { fontSize: ms(10), fontWeight: '600', color: '#64748B' },
  offerText: { fontSize: ms(10), fontWeight: '700', color: PHARMA_TEAL },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: hs(2) },
  ctaText: { fontSize: ms(10), fontWeight: '900', color: PHARMA_TEAL },
});
