import React, { memo } from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Heart } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { getStoreById, getStoresByApp } from '@data/directory/stores';
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
}

function getDiscountPct(price: number, originalPrice?: number): number | null {
  if (!originalPrice || originalPrice <= price) return null;
  return Math.round((1 - price / originalPrice) * 100);
}

/**
 * Resolve a human-readable seller name for a product. Resolution order mirrors
 * the cart pickup-resolver: `storeId` → store-directory name; else `shop`;
 * else the app's single default outlet; else the category label. Store names
 * come from the enterprise-controlled `@data` directory (no secrets / PII).
 */
function resolveStoreName(product: Product): string {
  if (product.storeId) {
    const store = getStoreById(product.storeId);
    if (store?.name) return store.name;
  }
  if (product.shop) return product.shop;
  const defaultOutlet = getStoresByApp(product.app)[0];
  if (defaultOutlet?.name) return defaultOutlet.name;
  return product.category;
}

/**
 * Dense, one-per-row search result card. No outer horizontal padding/margin
 * (cards sit flush edge-to-edge); 3:4 portrait image on the left; title +
 * description; the store name as bold text (no "Sold by" prefix); and a price
 * line (offered price + strike-through list price + discount) on its own row.
 * The favourite heart sits at the right end of the card, not over the image.
 * No Add to Cart button — the card is view-only (tap opens product detail).
 */
const SearchProductRowCard = memo(function SearchProductRowCard({
  product,
  appBrand,
  showFavorite = false,
  isFavorite = false,
  onPress,
  onFavorite,
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

        <AppText style={styles.store} numberOfLines={1}>
          {storeName}
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
        </View>
      </View>

      {showFavorite && (
        <TouchableOpacity
          style={styles.heartBtn}
          onPress={onFavorite}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Toggle favourite for ${product.name}`}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: hs(12),
    paddingRight: hs(8),
    paddingVertical: vs(8),
    backgroundColor: '#FFFFFF',
    marginBottom: vs(12),
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
  store: {
    fontSize: ms(12),
    fontWeight: '700',
    color: TEXT_DARK,
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
    fontWeight: '700',
    color: GREEN,
  },
});
