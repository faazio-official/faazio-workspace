import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { AppImage } from '@/components/shared/AppImage';
import { Plus, Minus, Check } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { brandTokens } from '@/theme/brandTokens';
import { useCartProductActions } from '@/components/shared/hooks';
import type { Product, AppBrand } from '@data/types';

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
 * line and the add / quantity stepper on the right. Cart wiring is local via
 * `useCartProductActions`, so add / increment / decrement behave exactly like the
 * other catalog cards. Tapping the row (outside the stepper) opens product detail.
 */
const ProductRowCard = memo(function ProductRowCard({
  product,
  appBrand,
  onPress,
}: ProductRowCardProps) {
  const cart = useCartProductActions(product);
  const tokens = brandTokens[appBrand];
  const discountPct = getDiscountPct(product.price, product.originalPrice);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(product)}
      activeOpacity={0.94}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ₹${product.price}`}
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
        <AppText style={styles.name} numberOfLines={2}>{product.name}</AppText>
        {product.desc ? (
          <AppText style={styles.desc} numberOfLines={1}>{product.desc}</AppText>
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

          <View style={styles.spacer} />

          {cart.quantity > 0 ? (
            <View style={[styles.stepper, { backgroundColor: tokens.btnAdded }]}>
              <TouchableOpacity onPress={cart.onDecrement} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Minus size={ms(12)} color="#ffffff" strokeWidth={3} />
              </TouchableOpacity>
              <AppText style={styles.stepperQty}>{cart.quantity}</AppText>
              <TouchableOpacity onPress={cart.onIncrement} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Plus size={ms(12)} color="#ffffff" strokeWidth={3} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: tokens.accent }]}
              onPress={cart.onAdd}
              activeOpacity={0.8}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityLabel={`Add ${product.name} to cart`}
            >
              {cart.isAdded ? (
                <Check size={ms(13)} color="#ffffff" strokeWidth={3} />
              ) : (
                <Plus size={ms(13)} color="#ffffff" strokeWidth={3} />
              )}
            </TouchableOpacity>
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
  spacer: {
    flex: 1,
  },
  addBtn: {
    width: ms(30),
    height: ms(30),
    borderRadius: ms(15),
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: ms(15),
    paddingHorizontal: hs(6),
    height: ms(30),
  },
  stepperQty: {
    fontSize: ms(12),
    fontWeight: '900',
    color: '#ffffff',
    marginHorizontal: hs(8),
    minWidth: ms(14),
    textAlign: 'center',
  },
});
