import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { PRODUCT_CARD_WIDTH } from '@/theme/cards';
import MartImage from './MartImage';
import AddToCartControl from '@/components/shared/AddToCartControl';
import { brandRamp, neutral } from '@/theme/brandTokens';

interface MartDealCardProps {
  image: string;
  name: string;
  price: number;
  originalPrice?: number;
  /** Pack size shown directly under the image (e.g. "500 g", "Pack of 6"). */
  unit?: string;
  width?: number;
  quantity?: number;
  onPress?: () => void;
  onAdd?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
}

/**
 * Minimal, presentational mart deal card — deliberately NOT threaded through
 * `ProductCardBase`. Square image, then pack size + Add on one row, the
 * strikethrough-MRP-then-price row, and a 2-line name. No rating pill, no
 * badge/tag label, no heart. Tapping the card still opens the item.
 */
const MartDealCard = memo(function MartDealCard({
  image,
  name,
  price,
  originalPrice,
  unit,
  width,
  quantity = 0,
  onPress,
  onAdd,
  onIncrement,
  onDecrement,
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
        <View style={styles.metaRow}>
          {unit ? (
            <AppText style={styles.unit} numberOfLines={1}>{unit}</AppText>
          ) : null}
          {onAdd ? (
            <AddToCartControl
              quantity={quantity}
              onAdd={onAdd}
              onIncrement={onIncrement}
              onDecrement={onDecrement}
              accent={brandRamp.MART.deep}
              onAccent={brandRamp.MART.onDeep}
              compact
              label={name}
              style={styles.addControl}
            />
          ) : null}
        </View>

        <View style={styles.priceRow}>
          {originalPrice !== undefined && originalPrice > price ? (
            <AppText style={styles.originalPrice}>₹{originalPrice}</AppText>
          ) : null}
          <AppText style={styles.price}>₹{price}</AppText>
        </View>

        <AppText style={styles.name} numberOfLines={2}>
          {name}
        </AppText>
      </View>
    </TouchableOpacity>
  );
});

export default MartDealCard;

const styles = StyleSheet.create({
  card: {
    width: PRODUCT_CARD_WIDTH,
    marginRight: hs(8),
    backgroundColor: '#FFFFFF',
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: '#EFEFEF',
    overflow: 'hidden',
  },
  imageWrap: {
    aspectRatio: 1,
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: ms(28),
  },
  unit: {
    flexShrink: 1,
    marginRight: hs(6),
    fontSize: ms(10.5),
    fontWeight: '500',
    color: neutral.inkMuted,
  },
  addControl: { marginLeft: 'auto' },
  name: {
    fontSize: ms(13),
    fontWeight: '700',
    color: '#1E2022',
    minHeight: ms(34),
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
});
