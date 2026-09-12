import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import MartImage from './MartImage';

interface MartDealCardProps {
  image: string;
  name: string;
  rating?: number;
  price: number;
  originalPrice?: number;
  /** Optional green claim line shown under the price (e.g. "Lowest price in 30 days"). */
  priceNote?: string;
  width?: number;
  onPress?: () => void;
}

/**
 * Minimal, presentational mart deal card — deliberately NOT threaded through
 * `ProductCardBase`. Pure tap target: portrait image, optional rating pill, 1-line
 * name, strikethrough-MRP-then-price row, optional green price note. No `+` button,
 * no badge, no heart. The whole card is the press area.
 */
const MartDealCard = memo(function MartDealCard({
  image,
  name,
  rating,
  price,
  originalPrice,
  priceNote,
  width,
  onPress,
}: MartDealCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, width ? { width } : null]}
      onPress={onPress}
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel={name}
    >
      <View style={styles.imageWrap}>
        <MartImage uri={image} style={styles.image} contentFit="cover" />
      </View>

      <View style={styles.body}>
        {rating !== undefined ? (
          <View style={styles.ratingChip}>
            <Star size={ms(11)} color="#111827" fill="#111827" strokeWidth={1.5} />
            <AppText style={styles.ratingText}>{rating}</AppText>
          </View>
        ) : null}

        <AppText style={styles.name} numberOfLines={1}>
          {name}
        </AppText>

        <View style={styles.priceRow}>
          {originalPrice !== undefined && originalPrice > price ? (
            <AppText style={styles.originalPrice}>₹{originalPrice}</AppText>
          ) : null}
          <AppText style={styles.price}>₹{price}</AppText>
        </View>

        {priceNote ? (
          <AppText style={styles.priceNote} numberOfLines={1}>
            {priceNote}
          </AppText>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

export default MartDealCard;

const styles = StyleSheet.create({
  card: {
    width: hs(150),
    marginRight: hs(8),
    backgroundColor: '#FFFFFF',
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: '#EFEFEF',
    overflow: 'hidden',
  },
  imageWrap: {
    aspectRatio: 3 / 4,
    width: '100%',
    backgroundColor: '#FAFAFA',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  body: {
    paddingHorizontal: hs(10),
    paddingVertical: vs(10),
    gap: vs(4),
  },
  ratingChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(3),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: ms(6),
    paddingHorizontal: hs(6),
    paddingVertical: vs(2),
  },
  ratingText: {
    fontSize: ms(11),
    fontWeight: '800',
    color: '#111827',
  },
  name: {
    fontSize: ms(13),
    fontWeight: '700',
    color: '#1E2022',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: hs(6),
  },
  originalPrice: {
    fontSize: ms(11),
    fontWeight: '600',
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  price: {
    fontSize: ms(15),
    fontWeight: '900',
    color: '#111827',
  },
  priceNote: {
    fontSize: ms(11),
    fontWeight: '700',
    color: '#16A34A',
  },
});
