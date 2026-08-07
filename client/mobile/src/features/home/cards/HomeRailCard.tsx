import React, { memo } from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Plus, Check, Star } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { resolveBadgeBg } from '@/components/shared/format';
import type { AppBrand } from '@data/types';
import AppText from '@/components/AppText';

interface HomeRailCardProps {
  name: string;
  price: number;
  imageUrl: string;
  emoji?: string;
  badge?: string;
  badgeBg?: string;
  rating?: number | string;
  appBrand?: AppBrand;
  isAdded?: boolean;
  onPress?: () => void;
  onAdd?: () => void;
}

const HomeRailCard = memo(function HomeRailCard({
  name, price, imageUrl, emoji, badge, badgeBg,
  rating, isAdded, onPress, onAdd,
}: HomeRailCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: imageUrl }} style={styles.image} />
        {badge && (
          <View style={[styles.badge, { backgroundColor: resolveBadgeBg(badgeBg) }]}>
            <AppText style={styles.badgeText}>{badge}</AppText>
          </View>
        )}
        {emoji && (
          <View style={styles.emojiOverlay}>
            <AppText style={{ fontSize: ms(14) }}>{emoji}</AppText>
          </View>
        )}
      </View>
      <View style={styles.body}>
        {rating !== undefined && (
          <View style={styles.ratingRow}>
            <Star size={ms(8)} color="#f59e0b" fill="#f59e0b" />
            <AppText style={styles.ratingText}>{rating}</AppText>
          </View>
        )}
        <AppText style={styles.name} numberOfLines={1}>{name}</AppText>
        <View style={styles.bottomRow}>
          <AppText style={styles.price}>₹{price}</AppText>
          {onAdd && (
            <TouchableOpacity style={styles.addBtn} onPress={onAdd} activeOpacity={0.8}>
              {isAdded ? <Check size={ms(10)} color="#ffffff" strokeWidth={3} /> : <Plus size={ms(10)} color="#ffffff" strokeWidth={3} />}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default HomeRailCard;

const styles = StyleSheet.create({
  card: {
    width: hs(160),
    backgroundColor: '#ffffff',
    borderRadius: ms(14),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginRight: hs(8),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  imageWrap: { position: 'relative', height: vs(90) },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  badge: { position: 'absolute', bottom: vs(4), left: hs(4), paddingHorizontal: hs(5), paddingVertical: vs(1), borderRadius: ms(3) },
  badgeText: { fontSize: ms(6), fontWeight: '900', color: '#ffffff' },
  emojiOverlay: { position: 'absolute', top: vs(4), right: hs(4) },
  body: { padding: hs(8) },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(2) },
  ratingText: { fontSize: ms(7), fontWeight: '800', color: '#64748b', marginLeft: hs(2) },
  name: { fontSize: ms(9), fontWeight: '800', color: '#0f172a' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: vs(4) },
  price: { fontSize: ms(10), fontWeight: '900', color: '#0f172a' },
  addBtn: { width: ms(20), height: ms(20), borderRadius: ms(10), backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
});
