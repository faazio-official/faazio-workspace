import React, { memo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Star, Plus, Minus, Check } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { brandTokens } from './brandTokens';
import { resolveBadgeBg, formatRating } from './format';
import type { Product, AppBrand } from '@data/types';
import type { CardVariant } from '@data/schema';

interface ProductCardBaseProps {
  product: Product;
  appBrand: AppBrand;
  variant?: Extract<CardVariant, 'grid2' | 'rail' | 'stack' | 'tile' | 'detail-row' | 'flash'>;
  quantity?: number;
  isFavorite?: boolean;
  isAdded?: boolean;
  onPress?: () => void;
  onAdd?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onFavorite?: () => void;
  width?: number;
  showRating?: boolean;
  showDescription?: boolean;
  showHeart?: boolean;
  showBadge?: boolean;
  originalPrice?: number;
}

const ProductCardBase = memo(function ProductCardBase({
  product, appBrand, variant = 'grid2',
  quantity = 0, isFavorite, isAdded, onPress, onAdd,
  onIncrement, onDecrement, onFavorite,
  width, showRating = true, showDescription = false,
  showHeart = false, showBadge = true, originalPrice,
}: ProductCardBaseProps) {
  const tokens = brandTokens[appBrand];
  const isRail = variant === 'rail' || variant === 'flash';

  const cardStyle = {
    width: width || (isRail ? hs(256) : '48%' as any),
    borderRadius: ms(16),
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: vs(12),
    overflow: 'hidden' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  };

  const imageH = isRail ? vs(100) : vs(120);

  return (
    <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: product.image }} style={[styles.image, { height: imageH }]} />
        {showBadge && product.badge && (
          <View style={[styles.badge, { backgroundColor: resolveBadgeBg(product.badgeBg) }]}>
            <Text style={styles.badgeText}>{product.badge}</Text>
          </View>
        )}
        {showHeart && (
          <TouchableOpacity style={styles.heartBtn} onPress={onFavorite} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <View style={{ width: ms(20), height: ms(20), borderRadius: ms(10), backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: ms(10) }}>{isFavorite ? '❤️' : '🤍'}</Text>
            </View>
          </TouchableOpacity>
        )}
        {variant === 'flash' && (
          <View style={styles.flashBadge}>
            <Text style={styles.flashText}>⚡ FLASH</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        {product.rating !== undefined && showRating && (
          <View style={styles.ratingRow}>
            <Star size={ms(9)} color="#f59e0b" fill="#f59e0b" />
            <Text style={styles.ratingText}>{formatRating(product.rating)}</Text>
          </View>
        )}
        <Text style={[styles.name, isRail && { fontSize: ms(9) }]} numberOfLines={2}>{product.name}</Text>
        {showDescription && product.desc && (
          <Text style={styles.desc} numberOfLines={1}>{product.desc}</Text>
        )}
        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: tokens.priceColor }]}>₹{product.price}</Text>
          {originalPrice !== undefined && originalPrice > product.price && (
            <Text style={styles.originalPrice}>₹{originalPrice}</Text>
          )}
          <View style={{ flex: 1 }} />
          {quantity > 0 ? (
            <View style={[styles.stepper, { backgroundColor: tokens.btnAdded }]}>
              <TouchableOpacity onPress={onDecrement} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Minus size={ms(10)} color="#ffffff" strokeWidth={3} />
              </TouchableOpacity>
              <Text style={styles.stepperQty}>{quantity}</Text>
              <TouchableOpacity onPress={onIncrement} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Plus size={ms(10)} color="#ffffff" strokeWidth={3} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: tokens.accent }]}
              onPress={onAdd}
              activeOpacity={0.8}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              {isAdded ? (
                <Check size={ms(10)} color="#ffffff" strokeWidth={3} />
              ) : (
                <Plus size={ms(10)} color="#ffffff" strokeWidth={3} />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default ProductCardBase;

const styles = StyleSheet.create({
  imageWrap: { position: 'relative' },
  image: { width: '100%', resizeMode: 'cover' },
  badge: { position: 'absolute', top: vs(6), left: hs(6), paddingHorizontal: hs(6), paddingVertical: vs(2), borderRadius: ms(4) },
  badgeText: { fontSize: ms(7), fontWeight: '900', color: '#ffffff' },
  flashBadge: { position: 'absolute', top: vs(6), right: hs(6), backgroundColor: '#ef4444', paddingHorizontal: hs(6), paddingVertical: vs(2), borderRadius: ms(4) },
  flashText: { fontSize: ms(7), fontWeight: '900', color: '#ffffff' },
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
