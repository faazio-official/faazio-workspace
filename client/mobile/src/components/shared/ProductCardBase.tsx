import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { AppImage } from './AppImage';
import { Star, Heart, Zap, Package } from 'lucide-react-native';
import AddToCartControl from './AddToCartControl';
import { hs, vs, ms, SCREEN_W } from '@/utils/responsive';
import { PRODUCT_CARD_WIDTH } from '@/theme/cards';
import { brandTokens, neutral } from '@/theme/brandTokens';
import { categorical } from '@/theme/categorical';
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
  /** Home feed cards: smaller, ink-black price (no brand price colour). */
  compactPrice?: boolean;
  /** Render this instead of the numeric price (e.g. Pharma's "Price on prescription"). */
  priceLabel?: string;
}

const ProductCardBase = memo(function ProductCardBase({
  product, appBrand, variant = 'grid2',
  quantity = 0, isFavorite, onPress, onAdd,
  onIncrement, onDecrement, onFavorite,
  width, showRating = true, showDescription = false,
  showHeart = false, showBadge = true, showAdLabel = false, originalPrice,
  roundedImageBottom = false, imageAspect = 3 / 4, nameLines = 2,
  showPrice = true, showAddButton = true, ratingOnImage = false, compactPrice = false,
  priceLabel,
}: ProductCardBaseProps) {
  const tokens = brandTokens[appBrand];
  const language = useLanguageStore((s) => s.language);
  const displayName = localizedName(product, language);
  const displayDesc = localizedDesc(product, language);
  const isRail = variant === 'rail' || variant === 'flash';
  const isGrid2 = variant === 'grid2';
  // Item cards share one body order: unit + Add under the image, then price, then name.
  const usesUnderImageBody = isGrid2 || isRail;
  const unitText =
    product.unit?.trim() ||
    (product.netQty !== undefined && product.netUnit ? `${product.netQty} ${product.netUnit}` : '');

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
        showPrice ? `${displayName}, ${priceLabel ?? `₹${product.price}`}` : displayName
      }
      accessibilityHint={onPress ? 'Opens product details' : undefined}
    >
      <View style={styles.imageWrap}>
        {product.image ? (
          <AppImage
            source={{ uri: product.image }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={120}
            style={[styles.image, isGrid2 || isRail ? { aspectRatio: imageAspect } : { height: imageH }, roundedImageBottom && { borderBottomLeftRadius: ms(16), borderBottomRightRadius: ms(16) }]}
          />
        ) : (
          <View
            style={[
              styles.image,
              styles.imageFallback,
              isGrid2 || isRail ? { aspectRatio: imageAspect } : { height: imageH },
              roundedImageBottom && { borderBottomLeftRadius: ms(16), borderBottomRightRadius: ms(16) },
            ]}
          >
            <Package size={ms(22)} color={neutral.inkSubtle} strokeWidth={1.5} />
          </View>
        )}
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
            <Star size={ms(10)} color={categorical.amber} fill={categorical.amber} />
            <AppText style={styles.imageRatingText}>{formatRating(product.rating)}</AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        {usesUnderImageBody ? (
          <>
            {(unitText.length > 0 || showAddButton) && (
              <View style={styles.gridMetaRow}>
                {unitText.length > 0 ? (
                  <AppText style={styles.unitText} numberOfLines={1}>{unitText}</AppText>
                ) : null}
                {showAddButton && (
                  <AddToCartControl
                    quantity={quantity}
                    onAdd={() => onAdd?.(product)}
                    onIncrement={onIncrement}
                    onDecrement={onDecrement}
                    accent={tokens.btnBg}
                    onAccent={tokens.btnText}
                    addedAccent={tokens.btnAdded}
                    compact
                    label={displayName}
                    style={styles.gridAdd}
                  />
                )}
              </View>
            )}
            {showPrice && (
              <View style={styles.gridPriceRow}>
                {priceLabel ? (
                  <AppText numberOfLines={1} style={[styles.price, compactPrice ? styles.priceCompact : { color: tokens.priceColor }]}>{priceLabel}</AppText>
                ) : (
                  <>
                    <AppText numberOfLines={1} style={[styles.price, compactPrice ? styles.priceCompact : { color: tokens.priceColor }]}>₹{product.price}</AppText>
                    {originalPrice !== undefined && originalPrice > product.price && (
                      <AppText numberOfLines={1} style={styles.originalPrice}>₹{originalPrice}</AppText>
                    )}
                  </>
                )}
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
            {!ratingOnImage && product.rating !== undefined && showRating && (
              <View style={styles.gridRatingRow}>
                <Star size={ms(11)} color="#f59e0b" fill="#f59e0b" />
                <AppText style={styles.ratingText}>{formatRating(product.rating)}</AppText>
              </View>
            )}
          </>
        ) : (
          <>
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
                    {priceLabel ? (
                      <AppText numberOfLines={1} style={[styles.price, compactPrice ? styles.priceCompact : { color: tokens.priceColor }]}>{priceLabel}</AppText>
                    ) : (
                      <>
                        <AppText numberOfLines={1} style={[styles.price, compactPrice ? styles.priceCompact : { color: tokens.priceColor }]}>₹{product.price}</AppText>
                        {originalPrice !== undefined && originalPrice > product.price && (
                          <AppText numberOfLines={1} style={styles.originalPrice}>₹{originalPrice}</AppText>
                        )}
                      </>
                    )}
                  </>
                )}
                {showAddButton && <View style={{ flex: 1 }} />}
                {showAddButton && (
                  <AddToCartControl
                    quantity={quantity}
                    onAdd={() => onAdd?.(product)}
                    onIncrement={onIncrement}
                    onDecrement={onDecrement}
                    accent={tokens.btnBg}
                    onAccent={tokens.btnText}
                    addedAccent={tokens.btnAdded}
                    compact
                    label={displayName}
                  />
                )}
              </View>
            )}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
});

export default ProductCardBase;

const styles = StyleSheet.create({
  imageWrap: { position: 'relative' },
  image: { width: '100%', backgroundColor: '#e2e8f0' },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
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
  imageRatingText: { fontSize: ms(11), fontWeight: '600', color: neutral.ink },
  heartBtn: { position: 'absolute', top: vs(2), right: hs(2), width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  heartCircle: { width: ms(28), height: ms(28), borderRadius: ms(14), backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  body: { padding: hs(8) },
  gridMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: ms(28),
    marginBottom: vs(2),
  },
  unitText: {
    flexShrink: 1,
    marginRight: hs(6),
    fontSize: ms(10.5),
    fontWeight: '500',
    color: neutral.inkMuted,
  },
  gridAdd: { marginLeft: 'auto' },
  gridPriceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(2) },
  gridRatingRow: { flexDirection: 'row', alignItems: 'center', marginTop: vs(2) },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(2) },
  ratingText: { fontSize: ms(11), fontWeight: '500', color: '#64748b', marginLeft: hs(3) },
  name: { fontSize: ms(12), fontWeight: '500', color: '#0f172a', minHeight: ms(32) },
  nameSingleLine: { minHeight: 0 },
  desc: { fontSize: ms(11), fontWeight: '400', color: '#94a3b8', marginTop: vs(2) },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: vs(4) },
  price: { fontSize: ms(13), fontWeight: '600', flexShrink: 1 },
  priceCompact: { fontSize: ms(12), fontWeight: '600', color: neutral.ink },
  originalPrice: { fontSize: ms(11), fontWeight: '400', color: '#94a3b8', textDecorationLine: 'line-through', marginLeft: hs(4), flexShrink: 1 },
});
