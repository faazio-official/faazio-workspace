import React, { memo } from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Heart, Store, Plus, Minus, Check } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import AppText from '@/components/AppText';
import type { Product, AppBrand } from '@data/types';

const TEXT_DARK = '#111827';
const TEXT_MUTED = '#6B7280';
const GREEN = '#16A34A';

interface SearchProductRowCardProps {
  product: Product;
  appBrand: AppBrand;
  showFavorite?: boolean;
  isFavorite?: boolean;
  quantity?: number;
  onPress?: () => void;
  onAdd?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onFavorite?: () => void;
  /** Show a slim one-line vendor header above the row. Default true. */
  showStoreHeader?: boolean;
}

function getDiscountPct(price: number, originalPrice?: number): number | null {
  if (!originalPrice || originalPrice <= price) return null;
  return Math.round((1 - price / originalPrice) * 100);
}

/**
 * Resolve a human-readable seller name for a product. Server-owned only: the product's own `shop`
 * field when the catalog carries it, else the category label. No bundled store directory or default
 * outlet is consulted.
 */
function resolveStoreName(product: Product): string {
  if (product.shop) return product.shop;
  return product.category;
}

/**
 * Dense, one-per-row search result card. No outer horizontal padding/margin
 * (cards sit flush edge-to-edge); 3:4 portrait image on the left; title +
 * description; and a price line (offered price + strike-through list price +
 * discount) on its own row. A slim one-line vendor header (small bold name with
 * a tiny Store icon, hairline bottom divider) sits above the row when
 * `showStoreHeader` is on; the inline store name is otherwise removed from the
 * body. The favourite heart sits at the right end of the card, not over the
 * image. No Add to Cart button — the card is view-only (tap opens product
 * detail).
 */
const SearchProductRowCard = memo(function SearchProductRowCard({
  product,
  appBrand,
  showFavorite = false,
  isFavorite = false,
  quantity = 0,
  onPress,
  onAdd,
  onIncrement,
  onDecrement,
  onFavorite,
  showStoreHeader = true,
}: SearchProductRowCardProps) {
  const originalPrice = product.originalPrice;
  const discountPct = getDiscountPct(product.price, originalPrice);
  const storeName = resolveStoreName(product);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${storeName}, ₹${product.price}`}
    >
      {showStoreHeader && (
        <View style={styles.headerRow}>
          <Store size={ms(11)} color={TEXT_MUTED} strokeWidth={2} />
          <AppText style={styles.headerText} numberOfLines={1} ellipsizeMode="tail">
            {storeName}
          </AppText>
        </View>
      )}

      <View style={styles.row}>
        <View style={styles.imageWrap}>
          <Image source={{ uri: product.image }} style={styles.image} resizeMode="contain" />
        </View>

        <View style={styles.details}>
          <AppText style={styles.name} numberOfLines={1} ellipsizeMode="tail">
            {product.name}
          </AppText>

          <AppText style={styles.desc} numberOfLines={1} ellipsizeMode="tail">
            {product.desc}
          </AppText>

          <View style={styles.priceRow}>
            <AppText style={styles.price}>
              ₹{product.price.toLocaleString('en-IN')}
            </AppText>
            {originalPrice !== undefined && originalPrice > product.price && (
              <AppText style={styles.originalPrice}>₹{originalPrice.toLocaleString('en-IN')}</AppText>
            )}
            {discountPct !== null && (
              <AppText style={styles.discount}>{discountPct}% off</AppText>
            )}
            <View style={{ flex: 1 }} />
            {quantity > 0 ? (
              <View style={styles.stepper}>
                <TouchableOpacity
                  onPress={onDecrement}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove one ${product.name}`}
                >
                  <Minus size={ms(13)} color="#ffffff" strokeWidth={3} />
                </TouchableOpacity>
                <AppText style={styles.stepperQty}>{quantity}</AppText>
                <TouchableOpacity
                  onPress={onIncrement}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Add one more ${product.name}`}
                >
                  <Plus size={ms(13)} color="#ffffff" strokeWidth={3} />
                </TouchableOpacity>
              </View>
            ) : onAdd ? (
              <TouchableOpacity
                style={styles.addBtn}
                onPress={onAdd}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel={`Add ${product.name} to cart`}
              >
                <Check size={ms(14)} color="#ffffff" strokeWidth={3} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>

      {showFavorite && (
        <TouchableOpacity
          style={styles.heartBtn}
          onPress={onFavorite}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Toggle favourite for ${product.name}`}
          accessibilityState={{ selected: isFavorite }}
        >
          <Heart
            size={ms(15)}
            color={isFavorite ? '#ef4444' : '#9CA3AF'}
            fill={isFavorite ? '#ef4444' : 'none'}
            strokeWidth={2}
          />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
});

export default SearchProductRowCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    marginBottom: vs(12),
    paddingRight: hs(8),
    paddingVertical: vs(4),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(5),
    paddingLeft: hs(12),
    paddingRight: hs(32),
    paddingBottom: vs(6),
    marginBottom: vs(4),
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerText: {
    flex: 1,
    fontSize: ms(12),
    fontWeight: '700',
    color: TEXT_MUTED,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: hs(12),
  },
  imageWrap: {
    width: ms(90),
    aspectRatio: 3 / 4,
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
  details: {
    flex: 1,
    paddingLeft: hs(10),
    paddingRight: hs(20),
    gap: vs(3),
  },
  name: {
    fontSize: ms(14),
    fontWeight: '600',
    color: TEXT_DARK,
    lineHeight: ms(19),
  },
  desc: {
    fontSize: ms(11.5),
    fontWeight: '400',
    color: TEXT_MUTED,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
  },
  price: {
    fontSize: ms(14),
    fontWeight: '700',
    color: TEXT_DARK,
  },
  originalPrice: {
    fontSize: ms(11),
    fontWeight: '400',
    color: TEXT_MUTED,
    textDecorationLine: 'line-through',
  },
  discount: {
    fontSize: ms(11),
    fontWeight: '600',
    color: GREEN,
  },
  addBtn: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: ms(16),
    paddingHorizontal: hs(6),
    height: ms(32),
    backgroundColor: GREEN,
  },
  stepperQty: {
    fontSize: ms(12),
    fontWeight: '600',
    color: '#ffffff',
    marginHorizontal: hs(6),
    minWidth: ms(12),
    textAlign: 'center',
  },
});
