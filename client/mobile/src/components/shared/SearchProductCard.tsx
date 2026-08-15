import React, { memo } from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Star, Heart, Minus, Plus } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { brandTokens } from '@/theme/brandTokens';
import AppText from '@/components/AppText';
import type { Product, AppBrand } from '@data/types';

const BORDER = '#E5E7EB';
const TEXT_DARK = '#111827';
const TEXT_MUTED = '#6B7280';
const GREEN = '#16A34A';
const BLUE = '#2563EB';

interface SearchProductCardProps {
  product: Product;
  appBrand: AppBrand;
  /** 0 = left column (renders the vertical divider), 1 = right column. */
  columnIndex: number;
  showFavorite?: boolean;
  showSponsored?: boolean;
  isFavorite?: boolean;
  quantity?: number;
  onPress?: () => void;
  onAdd?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onFavorite?: () => void;
}

function getDiscountPct(price: number, originalPrice?: number): number | null {
  if (!originalPrice || originalPrice <= price) return null;
  return Math.round((1 - price / originalPrice) * 100);
}

/** Presentational-only: deterministic "Delivery by DD Mon" for mart items. */
function deliveryLabel(): string {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  const day = d.getDate();
  const mon = d.toLocaleString('en-IN', { month: 'short' });
  return `Delivery by ${day} ${mon}`;
}

/**
 * Dense, flush e-commerce grid card (Flipkart/Amazon style) used ONLY on the
 * common search page. Cells are edge-to-edge at 50% width separated by 1px
 * borders — the left column carries the vertical divider. Renders square
 * contain-fit imagery, ratings, a discount/MRP/final pricing row and a
 * full-width "Add to Cart" CTA that swaps to a quantity stepper once added.
 * Deliberately separate from ProductCardBase so the rest of the app keeps its
 * floating-card look.
 */
const SearchProductCard = memo(function SearchProductCard({
  product,
  appBrand,
  columnIndex,
  showFavorite = false,
  showSponsored = false,
  isFavorite = false,
  quantity = 0,
  onPress,
  onAdd,
  onIncrement,
  onDecrement,
  onFavorite,
}: SearchProductCardProps) {
  const tokens = brandTokens[appBrand];
  const originalPrice = product.originalPrice;
  const discountPct = getDiscountPct(product.price, originalPrice);
  const filledStars = Math.round(product.rating);
  const reviewCount = product.reviewsCount ?? (product as { reviews?: number }).reviews;

  return (
    <View style={[styles.cell, columnIndex === 0 && styles.cellLeft]}>
      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
        <View style={styles.imageWrap}>
          <Image source={{ uri: product.image }} style={styles.image} resizeMode="contain" />
          {showFavorite && (
            <TouchableOpacity
              style={styles.heartBtn}
              onPress={onFavorite}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Heart
                size={ms(16)}
                color={isFavorite ? '#ef4444' : '#9CA3AF'}
                fill={isFavorite ? '#ef4444' : 'none'}
                strokeWidth={2}
              />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.body}>
          {showSponsored && (
            <AppText style={styles.sponsored}>Sponsored</AppText>
          )}

          <AppText style={styles.name} numberOfLines={2}>
            {product.name}
          </AppText>

          <View style={styles.ratingRow}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Star
                key={i}
                size={ms(11)}
                color={i < filledStars ? GREEN : '#E5E7EB'}
                fill={i < filledStars ? GREEN : '#E5E7EB'}
              />
            ))}
            {reviewCount !== undefined && (
              <AppText style={styles.ratingCount}>({reviewCount})</AppText>
            )}
          </View>

          <View style={styles.priceRow}>
            {discountPct !== null && (
              <AppText style={styles.discount}>↓{discountPct}%</AppText>
            )}
            {originalPrice !== undefined && originalPrice > product.price && (
              <AppText style={styles.originalPrice}>₹{originalPrice}</AppText>
            )}
          </View>
          <AppText style={[styles.price, { color: tokens.priceColor }]}>
            ₹{product.price}
          </AppText>
          {showSponsored && (
            <AppText style={styles.delivery}>{deliveryLabel()}</AppText>
          )}
        </View>

        {quantity > 0 ? (
          <View style={[styles.stepper, { backgroundColor: tokens.btnAdded }]}>
            <TouchableOpacity onPress={onDecrement} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Minus size={ms(14)} color="#ffffff" strokeWidth={3} />
            </TouchableOpacity>
            <AppText style={styles.stepperQty}>{quantity}</AppText>
            <TouchableOpacity onPress={onIncrement} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Plus size={ms(14)} color="#ffffff" strokeWidth={3} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={onAdd}
            activeOpacity={0.8}
          >
            <AppText style={styles.addBtnText}>Add to Cart</AppText>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </View>
  );
});

export default SearchProductCard;

const styles = StyleSheet.create({
  cell: {
    width: '50%',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  cellLeft: {
    borderRightWidth: 1,
    borderRightColor: BORDER,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  imageWrap: {
    position: 'relative',
    aspectRatio: 1,
    backgroundColor: '#FFFFFF',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  heartBtn: {
    position: 'absolute',
    top: vs(8),
    right: hs(8),
    zIndex: 2,
  },
  body: {
    paddingHorizontal: hs(8),
    paddingTop: vs(4),
  },
  sponsored: {
    fontSize: ms(10),
    color: '#9CA3AF',
    marginBottom: vs(2),
  },
  name: {
    fontSize: ms(14),
    fontWeight: '400',
    color: TEXT_DARK,
    lineHeight: ms(19),
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(4),
  },
  ratingCount: {
    fontSize: ms(11),
    color: TEXT_MUTED,
    marginLeft: hs(4),
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(4),
  },
  discount: {
    fontSize: ms(12),
    fontWeight: '700',
    color: GREEN,
    marginRight: hs(6),
  },
  originalPrice: {
    fontSize: ms(12),
    fontWeight: '400',
    color: TEXT_MUTED,
    textDecorationLine: 'line-through',
  },
  price: {
    fontSize: ms(18),
    fontWeight: '700',
    color: TEXT_DARK,
    marginTop: vs(1),
  },
  delivery: {
    fontSize: ms(12),
    color: '#4B5563',
    marginTop: vs(2),
  },
  addBtn: {
    marginHorizontal: hs(8),
    marginTop: vs(8),
    marginBottom: vs(8),
    height: vs(34),
    borderWidth: 1,
    borderColor: BLUE,
    borderRadius: ms(4),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  addBtnText: {
    fontSize: ms(14),
    fontWeight: '700',
    color: BLUE,
  },
  stepper: {
    marginHorizontal: hs(8),
    marginTop: vs(8),
    marginBottom: vs(8),
    height: vs(34),
    borderRadius: ms(4),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(10),
  },
  stepperQty: {
    fontSize: ms(14),
    fontWeight: '800',
    color: '#ffffff',
  },
});
