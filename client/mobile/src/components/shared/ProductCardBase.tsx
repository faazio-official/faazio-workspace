import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { AppImage } from './AppImage';
import { Star, Plus, Minus, Check } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { brandTokens } from '@/theme/brandTokens';
import { resolveBadgeBg, formatRating } from './format';
import AdLabelBadge from './AdLabelBadge';
import type { Product, AppBrand } from '@data/types';
import type { CardVariant } from '@data/schema';
import AppText from '@/components/AppText';

interface ProductCardBaseProps {
  product: Product;
  appBrand: AppBrand;
  variant?: Extract<CardVariant, 'grid2' | 'rail' | 'stack' | 'tile' | 'detail-row' | 'flash'>;
  quantity?: number;
  isFavorite?: boolean;
  isAdded?: boolean;
  onPress?: (product: Product) => void;
  onAdd?: (product: Product) => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onFavorite?: () => void;
  width?: number;
  showRating?: boolean;
  showDescription?: boolean;
  showHeart?: boolean;
  showBadge?: boolean;
  showAdLabel?: boolean;
  /** Hide the price row (name-only compact cards). */
  showPrice?: boolean;
  /** Hide the add-to-cart / stepper control. */
  showAddButton?: boolean;
  originalPrice?: number;
  roundedImageBottom?: boolean;
  /** Image aspect ratio for grid2/rail/flash variants. Default 3/4 portrait. */
  imageAspect?: number;
}

const ProductCardBase = memo(function ProductCardBase({
  product, appBrand, variant = 'grid2',
  quantity = 0, isFavorite, isAdded, onPress, onAdd,
  onIncrement, onDecrement, onFavorite,
  width, showRating = true, showDescription = false,
  showHeart = false, showBadge = true, showAdLabel = false, originalPrice,
  roundedImageBottom = false, imageAspect = 3 / 4,
  showPrice = true, showAddButton = true,
}: ProductCardBaseProps) {
  const tokens = brandTokens[appBrand];
  const isRail = variant === 'rail' || variant === 'flash';
  const isGrid2 = variant === 'grid2';

  const cardStyle = {
    width: width || (isRail ? hs(150) : '48%' as any),
    borderRadius: ms(16),
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ffffff',
    marginBottom: vs(12),
    ...(isRail ? { marginRight: hs(8) } : null),
    overflow: 'hidden' as const,
  };

  const imageH = isRail ? vs(100) : vs(120);

  return (
    <TouchableOpacity style={cardStyle} onPress={() => onPress?.(product)} activeOpacity={0.9}>
      <View style={styles.imageWrap}>
        <AppImage
          source={{ uri: product.image }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
          style={[styles.image, isGrid2 || isRail ? { aspectRatio: imageAspect } : { height: imageH }, roundedImageBottom && { borderBottomLeftRadius: ms(16), borderBottomRightRadius: ms(16) }]}
        />
        {showBadge && product.badge && (
          <View style={[styles.badge, { backgroundColor: resolveBadgeBg(product.badgeBg) }]}>
            <AppText style={styles.badgeText}>{product.badge}</AppText>
          </View>
        )}
        {showHeart && (
          <TouchableOpacity style={styles.heartBtn} onPress={onFavorite} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <View style={{ width: ms(20), height: ms(20), borderRadius: ms(10), backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
              <AppText style={{ fontSize: ms(10) }}>{isFavorite ? '❤️' : '🤍'}</AppText>
            </View>
          </TouchableOpacity>
        )}
        {variant === 'flash' && (
          <View style={styles.flashBadge}>
            <AppText style={styles.flashText}>⚡ FLASH</AppText>
          </View>
        )}
        {showAdLabel && (
          <View style={styles.adLabelWrap}>
            <AdLabelBadge />
          </View>
        )}
      </View>
      <View style={styles.body}>
        {product.rating !== undefined && showRating && (
          <View style={styles.ratingRow}>
            <Star size={ms(9)} color="#f59e0b" fill="#f59e0b" />
            <AppText style={styles.ratingText}>{formatRating(product.rating)}</AppText>
          </View>
        )}
        <AppText style={styles.name} numberOfLines={2}>{product.name}</AppText>
        {showDescription && product.desc && (
          <AppText style={styles.desc} numberOfLines={1}>{product.desc}</AppText>
        )}
        {(showPrice || showAddButton) && (
          <View style={styles.priceRow}>
            {showPrice && (
              <>
                <AppText style={[styles.price, { color: tokens.priceColor }]}>₹{product.price}</AppText>
                {originalPrice !== undefined && originalPrice > product.price && (
                  <AppText style={styles.originalPrice}>₹{originalPrice}</AppText>
                )}
              </>
            )}
            {showAddButton && <View style={{ flex: 1 }} />}
            {showAddButton && (quantity > 0 ? (
              <View style={[styles.stepper, { backgroundColor: tokens.btnAdded }]}>
                <TouchableOpacity onPress={onDecrement} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Minus size={ms(10)} color="#ffffff" strokeWidth={3} />
                </TouchableOpacity>
                <AppText style={styles.stepperQty}>{quantity}</AppText>
                <TouchableOpacity onPress={onIncrement} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Plus size={ms(10)} color="#ffffff" strokeWidth={3} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: tokens.btnBg }]}
                onPress={() => onAdd?.(product)}
                activeOpacity={0.8}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                {isAdded ? (
                  <Check size={ms(10)} color="#ffffff" strokeWidth={3} />
                ) : (
                  <Plus size={ms(10)} color="#ffffff" strokeWidth={3} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

export default ProductCardBase;

const styles = StyleSheet.create({
  imageWrap: { position: 'relative' },
  image: { width: '100%', backgroundColor: '#e2e8f0' },
  badge: { position: 'absolute', top: vs(6), left: hs(6), paddingHorizontal: hs(6), paddingVertical: vs(2), borderRadius: ms(4) },
  badgeText: { fontSize: ms(7), fontWeight: '900', color: '#ffffff' },
  flashBadge: { position: 'absolute', top: vs(6), right: hs(6), backgroundColor: '#ef4444', paddingHorizontal: hs(6), paddingVertical: vs(2), borderRadius: ms(4) },
  flashText: { fontSize: ms(7), fontWeight: '900', color: '#ffffff' },
  adLabelWrap: { position: 'absolute', bottom: vs(4), right: hs(4) },
  heartBtn: { position: 'absolute', top: vs(6), right: hs(6) },
  body: { padding: hs(8) },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(2) },
  ratingText: { fontSize: ms(8), fontWeight: '800', color: '#64748b', marginLeft: hs(3) },
  name: { fontSize: ms(10), fontWeight: '800', color: '#0f172a', minHeight: ms(22) },
  desc: { fontSize: ms(8), fontWeight: '600', color: '#94a3b8', marginTop: vs(2) },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: vs(4) },
  price: { fontSize: ms(11), fontWeight: '900' },
  originalPrice: { fontSize: ms(8), fontWeight: '700', color: '#94a3b8', textDecorationLine: 'line-through', marginLeft: hs(4) },
  addBtn: { width: ms(24), height: ms(24), borderRadius: ms(12), alignItems: 'center', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: ms(12), paddingHorizontal: hs(4), height: ms(24) },
  stepperQty: { fontSize: ms(10), fontWeight: '900', color: '#ffffff', marginHorizontal: hs(6), minWidth: ms(12), textAlign: 'center' },
});
