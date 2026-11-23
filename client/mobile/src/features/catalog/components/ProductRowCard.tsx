import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { AppImage } from '@/components/shared/AppImage';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { brandTokens } from '@/theme/brandTokens';
import type { Product, AppBrand } from '@data/types';
import { localizedDesc, localizedName } from '@/lib/localizedText';
import { useLanguageStore } from '@/state/languageStore';

const IMG_SIZE = 96;
const GREEN = '#16A34A';

interface ProductRowCardProps {
  product: Product;
  appBrand: AppBrand;
  onPress: (product: Product) => void;
}

function getDiscountPct(price: number, originalPrice?: number): number | null {
  if (!originalPrice || originalPrice <= price) return null;
  return Math.round((1 - price / originalPrice) * 100);
}

/**
 * One-per-row horizontal product card for the category drill-in body, modeled on
 * the Mart vendor card: 96px square image on the left, name + description + price
 * line on the right. The row is browse-only — there is no inline add/stepper, so
 * the price line owns the full remaining width and the only action is opening
 * product detail, where the item is added to the cart.
 */
const ProductRowCard = memo(function ProductRowCard({
  product,
  appBrand,
  onPress,
}: ProductRowCardProps) {
  const tokens = brandTokens[appBrand];
  const language = useLanguageStore((s) => s.language);
  const displayName = localizedName(product, language);
  const displayDesc = localizedDesc(product, language);
  const discountPct = getDiscountPct(product.price, product.originalPrice);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(product)}
      activeOpacity={0.94}
      accessibilityRole="button"
      accessibilityLabel={`${displayName}, ₹${product.price}`}
    >
      <View style={styles.imageWrap}>
        <AppImage
          source={{ uri: product.image }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
          style={styles.image}
        />
      </View>

      <View style={styles.body}>
        <AppText style={styles.name} numberOfLines={2}>{displayName}</AppText>
        {displayDesc ? (
          <AppText style={styles.desc} numberOfLines={1}>{displayDesc}</AppText>
        ) : null}

        <View style={styles.priceRow}>
          <AppText style={[styles.price, { color: tokens.priceColor }]}>
            ₹{product.price.toLocaleString('en-IN')}
          </AppText>
          {product.originalPrice !== undefined && product.originalPrice > product.price && (
            <AppText style={styles.originalPrice}>
              ₹{product.originalPrice.toLocaleString('en-IN')}
            </AppText>
          )}
          {discountPct !== null && (
            <AppText style={styles.discount}>{discountPct}% off</AppText>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default ProductRowCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: ms(12),
    padding: hs(10),
  },
  imageWrap: {
    width: ms(IMG_SIZE),
    height: ms(IMG_SIZE),
    borderRadius: ms(10),
    backgroundColor: '#FAFAFA',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  body: {
    flex: 1,
    marginLeft: hs(12),
    gap: vs(4),
  },
  name: {
    fontSize: ms(14),
    fontWeight: '700',
    color: '#1E2022',
  },
  desc: {
    fontSize: ms(11),
    fontWeight: '500',
    color: '#94a3b8',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: hs(6),
    marginTop: vs(2),
  },
  price: {
    fontSize: ms(14),
    fontWeight: '900',
  },
  originalPrice: {
    fontSize: ms(11),
    fontWeight: '600',
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  discount: {
    fontSize: ms(11),
    fontWeight: '700',
    color: GREEN,
  },
});
