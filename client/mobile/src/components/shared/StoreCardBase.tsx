import React, { memo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Star, Clock, MapPin, ChevronRight } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { brandTokens } from './brandTokens';
import type { StoreProfile } from '@data/types';

interface StoreCardBaseProps {
  store: StoreProfile;
  variant?: 'vendor' | 'food';
  onPress?: () => void;
}

const StoreCardBase = memo(function StoreCardBase({ store, variant = 'vendor', onPress }: StoreCardBaseProps) {
  const tokens = brandTokens[store.app];
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.coverWrap}>
        <Image source={{ uri: store.coverImage }} style={styles.cover} />
        <View style={[styles.gradientOverlay, { backgroundColor: tokens.accent }]} />
        <View style={styles.emojiCircle}>
          <Text style={{ fontSize: ms(20) }}>{store.emoji}</Text>
        </View>
        <Text style={styles.storeName}>{store.name}</Text>
        {store.isVeg !== undefined && (
          <View style={styles.vegBadge}>
            <Text style={styles.vegText}>{store.isVeg ? '🟢 VEG' : '🔴 NON-VEG'}</Text>
          </View>
        )}
      </View>
      <View style={styles.meta}>
        <View style={styles.ratingRow}>
          <Star size={ms(10)} color="#f59e0b" fill="#f59e0b" />
          <Text style={styles.ratingText}>{store.rating}</Text>
          {store.reviewsCount && <Text style={styles.reviewText}>({store.reviewsCount.toLocaleString('en-IN')})</Text>}
        </View>
        <View style={styles.infoRow}>
          <Clock size={ms(9)} color="#64748b" />
          <Text style={styles.infoText}>{store.deliveryTime}</Text>
          <MapPin size={ms(9)} color="#64748b" style={{ marginLeft: hs(8) }} />
          <Text style={styles.infoText}>{store.distance}</Text>
        </View>
        {store.offerTag && (
          <View style={styles.offerChip}>
            <Text style={styles.offerText}>{store.offerTag}</Text>
          </View>
        )}
        <View style={styles.descRow}>
          <Text style={styles.desc} numberOfLines={2}>{store.desc}</Text>
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
    borderColor: '#f1f5f9',
    marginBottom: vs(12),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  coverWrap: { height: vs(120), position: 'relative', justifyContent: 'flex-end', padding: hs(12) },
  cover: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', resizeMode: 'cover' },
  gradientOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%', opacity: 0.8 },
  emojiCircle: {
    width: ms(36), height: ms(36), borderRadius: ms(18), backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center', position: 'absolute', top: vs(10), left: hs(12),
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  storeName: { fontSize: ms(16), fontWeight: '900', color: '#ffffff', marginTop: vs(4) },
  vegBadge: { position: 'absolute', top: vs(10), right: hs(12) },
  vegText: { fontSize: ms(8), fontWeight: '900', color: '#ffffff' },
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
  offerText: { fontSize: ms(8), fontWeight: '800', color: '#d97706' },
  descRow: { flexDirection: 'row', alignItems: 'center' },
  desc: { flex: 1, fontSize: ms(8), fontWeight: '600', color: '#64748b' },
});
