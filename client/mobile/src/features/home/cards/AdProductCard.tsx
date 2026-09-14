import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { hs, vs, ms } from '@/utils/responsive';
import type { Product } from '@data/types';
import AdLabelBadge from '@/components/shared/AdLabelBadge';
import MartImage from '@/features/ecommerce/components/mart-home/MartImage';
import AppText from '@/components/AppText';

interface AdProductCardProps {
  product: Product;
  width?: number;
  onPress?: (product: Product) => void;
}

/**
 * Minimal, presentational ad product card — deliberately modeled on `MartDealCard`,
 * NOT `ProductCardBase`. Ad impressions: a big **square** image with only the 'AD'
 * pill (bottom-right), a 2-line title, slashed grey MRP + bold black price. No plus
 * button, no badge, no rating, no stepper. The whole card is the tap target. Stretches
 * to fill its row (`flex: 1`) unless a fixed `width` is supplied.
 */
const AdProductCard = memo(function AdProductCard({
  product,
  width,
  onPress,
}: AdProductCardProps) {
  const hasDiscount =
    product.originalPrice !== undefined && product.originalPrice > product.price;

  return (
    <TouchableOpacity
      style={[styles.card, width ? { width } : styles.cardFlex]}
      onPress={() => onPress?.(product)}
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel={product.name}
    >
      <View style={styles.imageWrap}>
        <MartImage uri={product.image} style={styles.image} contentFit="cover" />
        <View style={styles.adLabelWrap}>
          <AdLabelBadge />
        </View>
      </View>

      <AppText style={styles.name} numberOfLines={2}>
        {product.name}
      </AppText>

      <View style={styles.priceRow}>
        {hasDiscount ? (
          <AppText style={styles.originalPrice}>₹{product.originalPrice}</AppText>
        ) : null}
        <AppText style={styles.price}>₹{product.price}</AppText>
      </View>
    </TouchableOpacity>
  );
});

export default AdProductCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: ms(14),
    overflow: 'hidden',
    padding: hs(6),
  },
  cardFlex: {
    flex: 1,
  },
  imageWrap: {
    aspectRatio: 1,
    width: '100%',
    position: 'relative',
    borderRadius: ms(12),
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  adLabelWrap: {
    position: 'absolute',
    bottom: vs(6),
    right: hs(6),
  },
  name: {
    fontSize: ms(12),
    fontWeight: '700',
    color: '#1E2022',
    lineHeight: ms(15),
    marginTop: vs(8),
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: hs(5),
    marginTop: vs(6),
  },
  originalPrice: {
    fontSize: ms(11),
    fontWeight: '600',
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  price: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#111827',
  },
});
