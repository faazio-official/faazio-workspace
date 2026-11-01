import React, { memo } from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Star, Clock, MapPin, ChevronRight } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { brandTokens, semantic } from '@/theme/brandTokens';
import AdLabelBadge from './AdLabelBadge';
import type { StoreProfile } from '@data/types';
import AppText from '@/components/AppText';

interface StoreCardBaseProps {
  store: StoreProfile;
  variant?: 'vendor' | 'food' | 'rail';
  width?: number;
  showAdLabel?: boolean;
  onPress?: () => void;
}

const StoreCardBase = memo(function StoreCardBase({ store, variant = 'vendor', width, showAdLabel = false, onPress }: StoreCardBaseProps) {
  const tokens = brandTokens[store.app];
  const isRail = variant === 'rail';

  if (isRail) {
    return (
      <TouchableOpacity style={[styles.railCard, { width: width || hs(256) }]} onPress={onPress} activeOpacity={0.9}>
        <View style={styles.coverWrap}>
          <Image source={{ uri: store.coverImage }} style={styles.cover} />
          {showAdLabel && (
            <View style={styles.railAdLabelWrap}>
              <AdLabelBadge size="md" />
            </View>
          )}
        </View>
        <View style={styles.meta}>
          <AppText style={styles.railStoreName} numberOfLines={1}>{store.name}</AppText>
          <View style={styles.ratingRow}>
            <Star size={ms(10)} color="#f59e0b" fill="#f59e0b" />
            <AppText style={styles.ratingText}>{store.rating}</AppText>
            {store.reviewsCount && <AppText style={styles.reviewText}>({store.reviewsCount.toLocaleString('en-IN')})</AppText>}
          </View>
          <View style={styles.infoRow}>
            <Clock size={ms(9)} color="#64748b" />
            <AppText style={styles.infoText}>{store.deliveryTime}</AppText>
            <MapPin size={ms(9)} color="#64748b" style={{ marginLeft: hs(8) }} />
            <AppText style={styles.infoText}>{store.distance}</AppText>
          </View>
          {store.offerTag && (
            <View style={styles.offerChip}>
              <AppText style={styles.offerText} numberOfLines={1}>{store.offerTag}</AppText>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.vendorCoverWrap}>
        <Image source={{ uri: store.coverImage }} style={styles.cover} />
        <View style={[styles.gradientOverlay, { backgroundColor: tokens.accent }]} />
        {showAdLabel && (
          <View style={styles.adLabelWrap}>
            <AdLabelBadge size="md" />
          </View>
        )}
        <View style={styles.emojiCircle}>
          <AppText style={{ fontSize: ms(20) }}>{store.emoji}</AppText>
        </View>
        <AppText style={styles.storeName}>{store.name}</AppText>
        {store.isVeg !== undefined && (
          <View style={styles.vegBadge}>
            <AppText style={styles.vegText}>{store.isVeg ? '🟢 VEG' : '🔴 NON-VEG'}</AppText>
          </View>
        )}
      </View>
      <View style={styles.meta}>
        <View style={styles.ratingRow}>
          <Star size={ms(10)} color="#f59e0b" fill="#f59e0b" />
          <AppText style={styles.ratingText}>{store.rating}</AppText>
          {store.reviewsCount && <AppText style={styles.reviewText}>({store.reviewsCount.toLocaleString('en-IN')})</AppText>}
        </View>
        <View style={styles.infoRow}>
          <Clock size={ms(9)} color="#64748b" />
          <AppText style={styles.infoText}>{store.deliveryTime}</AppText>
          <MapPin size={ms(9)} color="#64748b" style={{ marginLeft: hs(8) }} />
          <AppText style={styles.infoText}>{store.distance}</AppText>
        </View>
        {store.offerTag && (
          <View style={styles.offerChip}>
            <AppText style={styles.offerText}>{store.offerTag}</AppText>
          </View>
        )}
        <View style={styles.descRow}>
          <AppText style={styles.desc} numberOfLines={2}>{store.desc}</AppText>
          <ChevronRight size={ms(14)} color="#94a3b8" />
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default StoreCardBase;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: '#ffffff',
    marginBottom: vs(12),
    overflow: 'hidden',
  },
  railCard: {
    backgroundColor: '#ffffff',
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: '#ffffff',
    marginRight: hs(12),
    overflow: 'hidden',
  },
  coverWrap: { aspectRatio: 4 / 3, position: 'relative', padding: hs(8) },
  vendorCoverWrap: { height: vs(120), position: 'relative', justifyContent: 'flex-end', padding: hs(12) },
  cover: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', resizeMode: 'cover', borderRadius: ms(12) },
  gradientOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%', opacity: 0.8 },
  emojiCircle: {
    width: ms(36), height: ms(36), borderRadius: ms(18), backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center', position: 'absolute', top: vs(10), left: hs(12),
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  storeName: { fontSize: ms(15), fontWeight: '900', color: '#ffffff', marginTop: vs(4) },
  vegBadge: { position: 'absolute', top: vs(10), right: hs(12) },
  vegText: { fontSize: ms(8), fontWeight: '900', color: '#ffffff' },
  adLabelWrap: { position: 'absolute', bottom: vs(4), right: hs(4) },
  railAdLabelWrap: { position: 'absolute', bottom: vs(4), right: hs(4) },
  railStoreName: { fontSize: ms(14), fontWeight: '900', color: '#0f172a', marginBottom: vs(6) },
  meta: { padding: hs(12) },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(4) },
  ratingText: { fontSize: ms(10), fontWeight: '900', color: '#0f172a', marginLeft: hs(3) },
  reviewText: { fontSize: ms(8), fontWeight: '700', color: '#94a3b8', marginLeft: hs(3) },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(6) },
  infoText: { fontSize: ms(8), fontWeight: '700', color: '#64748b', marginLeft: hs(4) },
  offerChip: {
    alignSelf: 'flex-start', backgroundColor: '#fef3c7', paddingHorizontal: hs(8),
    paddingVertical: vs(3), borderRadius: ms(6), marginBottom: vs(6),
  },
  offerText: { fontSize: ms(8), fontWeight: '800', color: semantic.warning },
  descRow: { flexDirection: 'row', alignItems: 'center' },
  desc: { flex: 1, fontSize: ms(8), fontWeight: '600', color: '#64748b' },
});
