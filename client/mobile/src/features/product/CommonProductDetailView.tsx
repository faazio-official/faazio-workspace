import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Search,
  ShoppingCart,
  Heart,
  MapPin,
  BadgeCheck,
  RotateCcw,
  Truck,
  Plus,
  Minus,
} from 'lucide-react-native';
import { hs, vs, ms, SCREEN_W } from '@/utils/responsive';
import AppText from '@/components/AppText';
import type { Product } from '@data/types';

interface ProductDetailViewProps {
  product?: Product;
  onClose: () => void;
  onSearch?: () => void;
  onCart?: () => void;
  addToCart: (id: string, name: string, price: number, emoji: string) => void;
  cartItems: { id: string; name: string; price: number; quantity: number; emoji: string }[];
  updateCartQuantity: (id: string, delta: number) => void;
  favorites?: string[];
  toggleFavorite?: (productId: string) => void;
}

const FALLBACK_PRODUCT: Product = {
  id: 'demo-1',
  name: 'Wireless Noise Cancelling Earbuds',
  price: 204,
  originalPrice: 999,
  rating: 4.2,
  emoji: '🎧',
  image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?fm=jpg&fit=crop&q=80&w=600&h=600',
  desc: 'Premium sound with active noise cancellation, 30-hour battery life, and a sleek ergonomic fit. IPX5 water resistance for worry-free workouts.',
  app: 'MART',
  category: 'Electronics',
  attributes: { brand: 'SoundPro' },
  unit: '1 Pack',
};

const DELIVERY_TRUST = [
  { icon: 'cash', label: 'COD Available' },
  { icon: 'return', label: '10-Day Return' },
  { icon: 'assured', label: 'Assured' },
];

function discountPercent(price: number, original?: number): number {
  if (!original || original <= price) return 0;
  return Math.round(((original - price) / original) * 100);
}

export default function CommonProductDetailView({
  product: propProduct,
  onClose,
  onSearch,
  onCart,
  addToCart,
  cartItems,
  updateCartQuantity,
  favorites = [],
  toggleFavorite,
}: ProductDetailViewProps) {
  const product = propProduct ?? FALLBACK_PRODUCT;
  const safePrice = Number(product.price) || 0;
  const safeOriginal = Number(product.originalPrice) || 0;
  const safeRating = Number(product.rating) || 4.5;
  const safeEmoji = product.emoji ?? '🛍️';
  const safeDesc = product.desc ?? 'Premium quality product';
  const discount = discountPercent(safePrice, safeOriginal);

  const brand =
    (product.attributes?.brand as string | undefined) ||
    product.shop ||
    'Faazio';

  const variants = useMemo<string[]>(() => {
    const attrVar = product.attributes?.variants;
    if (Array.isArray(attrVar) && attrVar.length > 0) {
      return attrVar.map(String);
    }
    if (product.unit) return [product.unit];
    return ['500g', '1kg'];
  }, [product.unit, product.attributes]);

  const [selectedVariant, setSelectedVariant] = useState(variants[0]);

  const isFavorite = favorites.includes(product.id);
  const cartItem = cartItems.find((i) => i.id === product.id);
  const cartQty = cartItem?.quantity ?? 0;

  const handleToggleFavorite = () => {
    if (toggleFavorite) toggleFavorite(product.id);
  };

  const handleAddToCart = () => {
    addToCart(product.id, product.name, safePrice, safeEmoji);
  };

  const handleIncrement = () => {
    updateCartQuantity(product.id, 1);
  };

  const handleDecrement = () => {
    updateCartQuantity(product.id, -1);
  };

  const deliveryDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }, []);

  const heroImage = product.image ? (
    <Image
      source={{ uri: product.image }}
      style={styles.heroImage}
      resizeMode="cover"
    />
  ) : (
    <View style={styles.heroEmojiTile}>
      <AppText style={styles.heroEmoji}>{safeEmoji}</AppText>
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.headerBtn} activeOpacity={0.7}>
          <ArrowLeft size={ms(22)} color="#0f172a" strokeWidth={2.2} />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={onSearch} style={styles.headerBtn} activeOpacity={0.7}>
            <Search size={ms(20)} color="#0f172a" strokeWidth={2.2} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onCart} style={styles.headerBtn} activeOpacity={0.7}>
            <ShoppingCart size={ms(20)} color="#0f172a" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          {heroImage}
          <TouchableOpacity
            onPress={handleToggleFavorite}
            style={styles.heartBtn}
            activeOpacity={0.8}
          >
            <Heart
              size={ms(20)}
              color={isFavorite ? '#f43f5e' : '#334155'}
              fill={isFavorite ? '#f43f5e' : 'none'}
            />
          </TouchableOpacity>
        </View>

        {/* Core details */}
        <View style={styles.padded}>
          <AppText style={styles.brandText} numberOfLines={1}>{brand}</AppText>
          <AppText style={styles.titleText} numberOfLines={2}>{product.name}</AppText>

          <View style={styles.ratingRow}>
            <View style={styles.ratingPill}>
              <AppText style={styles.ratingPillText}>
                {safeRating.toFixed(1)} ★
              </AppText>
            </View>
            <AppText style={styles.ratingMeta}>
              {product.reviewsCount ? `${product.reviewsCount} ratings` : '4.5k ratings'}
            </AppText>
          </View>

          <View style={styles.priceRow}>
            <AppText style={styles.finalPrice}>
              ₹{safePrice.toLocaleString('en-IN')}
            </AppText>
            {safeOriginal > safePrice && (
              <>
                <AppText style={styles.mrp}>
                  ₹{safeOriginal.toLocaleString('en-IN')}
                </AppText>
                <AppText style={styles.discount}>{discount}% OFF</AppText>
              </>
            )}
          </View>
          <AppText style={styles.inclTax}>Inclusive of all taxes</AppText>
        </View>

        {/* Variant selector */}
        <View style={styles.padded}>
          <AppText style={styles.sectionLabel}>Select Variant</AppText>
          <View style={styles.variantRow}>
            {variants.map((v) => {
              const selected = v === selectedVariant;
              return (
                <TouchableOpacity
                  key={v}
                  onPress={() => setSelectedVariant(v)}
                  style={[styles.variantPill, selected && styles.variantPillActive]}
                  activeOpacity={0.8}
                >
                  <AppText
                    style={[styles.variantPillText, selected && styles.variantPillTextActive]}
                  >
                    {v}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Delivery & trust */}
        <View style={[styles.padded, styles.trustBlock]}>
          <View style={styles.deliveryRow}>
            <MapPin size={ms(16)} color="#334155" strokeWidth={2} />
            <AppText style={styles.deliveryText}>
              Free Delivery by <AppText style={styles.deliveryBold}>{deliveryDate}</AppText>
            </AppText>
          </View>
          <View style={styles.trustRow}>
            {DELIVERY_TRUST.map((t) => (
              <View key={t.label} style={styles.trustItem}>
                {t.icon === 'cash' ? (
                  <Truck size={ms(16)} color="#059669" strokeWidth={2} />
                ) : t.icon === 'return' ? (
                  <RotateCcw size={ms(16)} color="#059669" strokeWidth={2} />
                ) : (
                  <BadgeCheck size={ms(16)} color="#059669" strokeWidth={2} />
                )}
                <AppText style={styles.trustLabel}>{t.label}</AppText>
              </View>
            ))}
          </View>
        </View>

        {/* Product details */}
        <View style={styles.padded}>
          <AppText style={styles.sectionLabel}>Product Details</AppText>
          <AppText style={styles.descText}>{safeDesc}</AppText>
          <View style={styles.highlightList}>
            <View style={styles.highlightItem}>
              <View style={styles.bulletDot} />
              <AppText style={styles.highlightText}>100% genuine, sealed retail unit</AppText>
            </View>
            <View style={styles.highlightItem}>
              <View style={styles.bulletDot} />
              <AppText style={styles.highlightText}>Free & fast delivery to your doorstep</AppText>
            </View>
            <View style={styles.highlightItem}>
              <View style={styles.bulletDot} />
              <AppText style={styles.highlightText}>Hassle-free returns & easy replacement</AppText>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky footer */}
      <View style={styles.footer}>
        {cartQty === 0 ? (
          <TouchableOpacity
            onPress={handleAddToCart}
            style={[styles.footerBtn, styles.addToCartBtn]}
            activeOpacity={0.85}
          >
            <AppText style={styles.addToCartText}>Add to Cart</AppText>
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.stepper}>
              <TouchableOpacity onPress={handleDecrement} style={styles.stepBtn} activeOpacity={0.8}>
                <Minus size={ms(18)} strokeWidth={2.5} color="#0f172a" />
              </TouchableOpacity>
              <AppText style={styles.stepValue}>{cartQty}</AppText>
              <TouchableOpacity onPress={handleIncrement} style={styles.stepBtn} activeOpacity={0.8}>
                <Plus size={ms(18)} strokeWidth={2.5} color="#0f172a" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={onCart}
              style={[styles.footerBtn, styles.goToCartBtn]}
              activeOpacity={0.85}
            >
              <ShoppingCart size={ms(18)} color="#ffffff" strokeWidth={2.2} />
              <AppText style={styles.goToCartText}>Go to Cart</AppText>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: hs(12),
    paddingVertical: vs(6),
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
  },
  headerBtn: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: vs(24),
  },
  hero: {
    width: SCREEN_W,
    height: SCREEN_W,
    backgroundColor: '#f8fafc',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroEmojiTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  heroEmoji: {
    fontSize: ms(80),
  },
  heartBtn: {
    position: 'absolute',
    top: vs(12),
    right: hs(12),
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  padded: {
    paddingHorizontal: hs(16),
    paddingTop: vs(14),
  },
  brandText: {
    fontSize: ms(13),
    color: '#64748b',
    fontWeight: '600',
    marginBottom: vs(2),
  },
  titleText: {
    fontSize: ms(20),
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: ms(26),
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(10),
    gap: hs(8),
  },
  ratingPill: {
    backgroundColor: '#059669',
    borderRadius: ms(6),
    paddingVertical: vs(3),
    paddingHorizontal: hs(8),
  },
  ratingPillText: {
    color: '#ffffff',
    fontSize: ms(11),
    fontWeight: '800',
  },
  ratingMeta: {
    fontSize: ms(11),
    color: '#94a3b8',
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: vs(10),
    gap: hs(8),
  },
  finalPrice: {
    fontSize: ms(26),
    fontWeight: '900',
    color: '#0f172a',
  },
  mrp: {
    fontSize: ms(14),
    color: '#94a3b8',
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  discount: {
    fontSize: ms(14),
    color: '#16a34a',
    fontWeight: '800',
  },
  inclTax: {
    fontSize: ms(11),
    color: '#16a34a',
    fontWeight: '600',
    marginTop: vs(3),
  },
  sectionLabel: {
    fontSize: ms(13),
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: vs(8),
  },
  variantRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: hs(8),
  },
  variantPill: {
    paddingVertical: vs(7),
    paddingHorizontal: hs(14),
    borderRadius: ms(20),
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  variantPillActive: {
    borderColor: '#0f172a',
    backgroundColor: '#0f172a',
  },
  variantPillText: {
    fontSize: ms(12),
    fontWeight: '700',
    color: '#334155',
  },
  variantPillTextActive: {
    color: '#ffffff',
  },
  trustBlock: {
    backgroundColor: '#f8fafc',
    borderRadius: ms(14),
    marginHorizontal: hs(16),
    marginTop: vs(16),
    paddingBottom: vs(14),
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
  },
  deliveryText: {
    fontSize: ms(12),
    color: '#334155',
    fontWeight: '500',
  },
  deliveryBold: {
    fontWeight: '800',
    color: '#0f172a',
  },
  trustRow: {
    flexDirection: 'row',
    marginTop: vs(12),
    gap: hs(12),
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(5),
    flex: 1,
  },
  trustLabel: {
    fontSize: ms(10),
    color: '#475569',
    fontWeight: '600',
    flexShrink: 1,
  },
  descText: {
    fontSize: ms(13),
    color: '#475569',
    fontWeight: '500',
    lineHeight: ms(19),
  },
  highlightList: {
    marginTop: vs(10),
    gap: vs(7),
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
  },
  bulletDot: {
    width: ms(6),
    height: ms(6),
    borderRadius: ms(3),
    backgroundColor: '#059669',
  },
  highlightText: {
    fontSize: ms(12),
    color: '#334155',
    fontWeight: '500',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: hs(12),
    paddingHorizontal: hs(16),
    paddingTop: vs(12),
    paddingBottom: vs(8),
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  footerBtn: {
    flex: 1,
    height: Math.max(48, vs(48)),
    borderRadius: ms(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  addToCartBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#0f172a',
  },
  addToCartText: {
    color: '#0f172a',
    fontSize: ms(14),
    fontWeight: '800',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f1f5f9',
    borderRadius: ms(14),
    padding: vs(4),
    minWidth: hs(120),
  },
  stepBtn: {
    width: ms(38),
    height: ms(38),
    borderRadius: ms(12),
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  stepValue: {
    fontSize: ms(15),
    fontWeight: '800',
    color: '#0f172a',
    minWidth: ms(28),
    textAlign: 'center',
  },
  goToCartBtn: {
    flexDirection: 'row',
    gap: hs(8),
    backgroundColor: '#0f172a',
  },
  goToCartText: {
    color: '#ffffff',
    fontSize: ms(14),
    fontWeight: '800',
  },
});
