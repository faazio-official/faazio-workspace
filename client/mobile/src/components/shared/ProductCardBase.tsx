import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { AppImage } from './AppImage';
import { Star, Plus, Minus, Check, Heart, Zap } from 'lucide-react-native';
import { hs, vs, ms, SCREEN_W } from '@/utils/responsive';
import { PRODUCT_CARD_WIDTH } from '@/theme/cards';
import { brandTokens } from '@/theme/brandTokens';
import { resolveBadgeBg, formatRating } from './format';
import AdLabelBadge from './AdLabelBadge';
import type { Product, AppBrand } from '@data/types';
import type { CardVariant } from '@data/schema';
import AppText from '@/components/AppText';
import { localizedDesc, localizedName } from '@/lib/localizedText';
import { useLanguageStore } from '@/state/languageStore';

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
  /** Product name lines before truncating. Default 2. */
  nameLines?: number;
  /** Render the rating pill over the image (bottom-left) instead of in the body. */
  ratingOnImage?: boolean;
}

const ProductCardBase = memo(function ProductCardBase({
  product, appBrand, variant = 'grid2',
  quantity = 0, isFavorite, isAdded, onPress, onAdd,
  onIncrement, onDecrement, onFavorite,
  width, showRating = true, showDescription = false,
  showHeart = false, showBadge = true, showAdLabel = false, originalPrice,
  roundedImageBottom = false, imageAspect = 3 / 4, nameLines = 2,
  showPrice = true, showAddButton = true, ratingOnImage = false,
}: ProductCardBaseProps) {
  const tokens = brandTokens[appBrand];
  const language = useLanguageStore((s) => s.language);
  const displayName = localizedName(product, language);
  const displayDesc = localizedDesc(product, language);
  const isRail = variant === 'rail' || variant === 'flash';
  const isGrid2 = variant === 'grid2';

  const cardStyle = {
    width: width || (isRail ? PRODUCT_CARD_WIDTH : ((SCREEN_W - hs(32) - hs(12)) / 2) as any),
    borderRadius: ms(16),
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ffffff',
    marginBottom: isRail ? 0 : vs(12),
    ...(isRail ? { marginRight: hs(8) } : null),
    overflow: 'hidden' as const,
  };

  const imageH = isRail ? vs(100) : vs(120);

  return (
    <TouchableOpacity
      style={cardStyle}
      onPress={() => onPress?.(product)}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={
        showPrice ? `${displayName}, ₹${product.price}` : displayName
      }
      accessibilityHint={onPress ? 'Opens product details' : undefined}
    >
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
          <TouchableOpacity
            style={styles.heartBtn}
            onPress={onFavorite}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? `Remove ${displayName} from favourites` : `Add ${displayName} to favourites`}
            accessibilityState={{ selected: Boolean(isFavorite) }}
          >
            <View style={styles.heartCircle}>
              <Heart
                size={ms(15)}
                color={isFavorite ? '#e11d48' : '#64748b'}
                fill={isFavorite ? '#e11d48' : 'transparent'}
                strokeWidth={2}
              />
            </View>
          </TouchableOpacity>
        )}
        {variant === 'flash' && (
          <View style={styles.flashBadge}>
            <Zap size={ms(10)} color="#ffffff" fill="#ffffff" strokeWidth={2} />
            <AppText style={styles.flashText}>FLASH</AppText>
          </View>
        )}
        {showAdLabel && (
          <View style={styles.adLabelWrap}>
            <AdLabelBadge />
          </View>
        )}
        {ratingOnImage && showRating && product.rating !== undefined ? (
          <View style={styles.imageRating}>
            <Star size={ms(10)} color="#f59e0b" fill="#f59e0b" />
            <AppText style={styles.imageRatingText}>{formatRating(product.rating)}</AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        {!ratingOnImage && product.rating !== undefined && showRating && (
          <View style={styles.ratingRow}>
            <Star size={ms(11)} color="#f59e0b" fill="#f59e0b" />
            <AppText style={styles.ratingText}>{formatRating(product.rating)}</AppText>
          </View>
        )}
        <AppText
          style={[styles.name, nameLines === 1 && styles.nameSingleLine]}
          numberOfLines={nameLines}
        >
          {displayName}
        </AppText>
        {showDescription && displayDesc ? (
          <AppText style={styles.desc} numberOfLines={1}>{displayDesc}</AppText>
        ) : null}
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
                <TouchableOpacity
                  onPress={onDecrement}
                  style={styles.stepperBtn}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove one ${displayName}`}
                >
                  <Minus size={ms(12)} color="#ffffff" strokeWidth={3} />
                </TouchableOpacity>
                <AppText style={styles.stepperQty}>{quantity}</AppText>
                <TouchableOpacity
                  onPress={onIncrement}
                  style={styles.stepperBtn}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Add one more ${displayName}`}
                >
                  <Plus size={ms(12)} color="#ffffff" strokeWidth={3} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: tokens.btnBg }]}
                onPress={() => onAdd?.(product)}
                activeOpacity={0.8}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel={`Add ${displayName} to cart`}
              >
                {isAdded ? (
                  <Check size={ms(12)} color="#ffffff" strokeWidth={3} />
                ) : (
                  <Plus size={ms(12)} color="#ffffff" strokeWidth={3} />
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
  badgeText: { fontSize: ms(11), fontWeight: '600', color: '#ffffff' },
  flashBadge: { position: 'absolute', top: vs(6), right: hs(6), backgroundColor: '#ef4444', paddingHorizontal: hs(6), paddingVertical: vs(2), borderRadius: ms(4), flexDirection: 'row', alignItems: 'center', gap: 2 },
  flashText: { fontSize: ms(11), fontWeight: '600', color: '#ffffff' },
  adLabelWrap: { position: 'absolute', bottom: vs(4), right: hs(4) },
  imageRating: {
    position: 'absolute',
    bottom: vs(6),
    left: hs(6),
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(3),
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: ms(6),
    paddingHorizontal: hs(6),
    paddingVertical: vs(2),
  },
  imageRatingText: { fontSize: ms(10), fontWeight: '700', color: '#0f172a' },
  heartBtn: { position: 'absolute', top: vs(2), right: hs(2), width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  heartCircle: { width: ms(28), height: ms(28), borderRadius: ms(14), backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  body: { padding: hs(8) },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(2) },
  ratingText: { fontSize: ms(11), fontWeight: '500', color: '#64748b', marginLeft: hs(3) },
  name: { fontSize: ms(12), fontWeight: '500', color: '#0f172a', minHeight: ms(32) },
  nameSingleLine: { minHeight: 0 },
  desc: { fontSize: ms(11), fontWeight: '400', color: '#94a3b8', marginTop: vs(2) },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: vs(4) },
  price: { fontSize: ms(13), fontWeight: '600' },
  originalPrice: { fontSize: ms(11), fontWeight: '400', color: '#94a3b8', textDecorationLine: 'line-through', marginLeft: hs(4) },
  addBtn: { width: Math.max(32, ms(32)), height: Math.max(32, ms(32)), borderRadius: ms(16), alignItems: 'center', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: ms(16), paddingHorizontal: hs(6), height: Math.max(32, ms(32)) },
  stepperBtn: { width: Math.max(32, ms(32)), height: Math.max(32, ms(32)), alignItems: 'center', justifyContent: 'center' },
  stepperQty: { fontSize: ms(12), fontWeight: '600', color: '#ffffff', marginHorizontal: hs(6), minWidth: ms(12), textAlign: 'center' },
});
