import React, { useEffect, useMemo, useState } from 'react';
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
  ShieldCheck,
  Plus,
  Minus,
} from 'lucide-react-native';
import { hs, vs, ms, SCREEN_W } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import AppText from '@/components/AppText';
import ProductCardBase from '@/components/shared/ProductCardBase';
import { applyActiveDiscounts, useActiveDiscounts } from '@/services/pricing';
import { gateway } from '@/services/api/GatewayClient';
import { martStores } from '@data/mart/stores';
import { martProducts } from '@data/mart/products';
import { foodStores } from '@data/food/stores';
import { TODAYS_SPECIALS, dishToProduct } from '@data/food/specials';
import type { Product, StoreProfile } from '@data/types';

interface ProductDetailViewProps {
  product?: Product;
  onClose: () => void;
  onSearch?: () => void;
  onCart?: () => void;
  addToCart: (id: string, name: string, price: number, emoji: string, restaurantId?: string) => void;
  cartItems: { id: string; name: string; price: number; quantity: number; emoji: string }[];
  updateCartQuantity: (id: string, delta: number) => void;
  favorites?: string[];
  toggleFavorite?: (productId: string) => void;
  /** Optional callback to open a store/vendor page for MART products. */
  onViewVendor?: (storeId: string) => void;
  /** Optional callback to open the FOOD restaurant's profile page. */
  onViewRestaurant?: () => void;
  /** Optional callback to open another product's detail page (FOOD related dishes). */
  onOpenProduct?: (product: Product) => void;
  /**
   * Owning restaurant when this FOOD product belongs to one. Threaded into the
   * cart line so a PDP add lands in the restaurant's isolated slice (visible to
   * the restaurant cart pill/filter) instead of the common cart.
   */
  restaurantId?: string;
}

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
  onViewVendor,
  onViewRestaurant,
  onOpenProduct,
  restaurantId,
}: ProductDetailViewProps) {
  const product = propProduct;
  const safePrice = Number(product?.price) || 0;
  const safeOriginal = Number(product?.originalPrice) || 0;
  const safeRating = Number(product?.rating) || 4.5;
  const safeEmoji = product?.emoji ?? '🛍️';
  const safeDesc = product?.desc ?? 'Premium quality product';
  const discount = discountPercent(safePrice, safeOriginal);

  const brand =
    (product?.attributes?.brand as string | undefined) ||
    product?.shop ||
    'Faazio';

  const variants = useMemo<string[]>(() => {
    const attrVar = product?.attributes?.variants;
    if (Array.isArray(attrVar) && attrVar.length > 0) {
      return attrVar.map(String);
    }
    if (product?.unit) return [product.unit];
    return ['500g', '1kg'];
  }, [product?.unit, product?.attributes]);

  const [selectedVariant, setSelectedVariant] = useState(variants[0]);

  const isFavorite = product ? favorites.includes(product.id) : false;
  const cartItem = product ? cartItems.find((i) => i.id === product.id) : undefined;
  const cartQty = cartItem?.quantity ?? 0;

  const handleToggleFavorite = () => {
    if (toggleFavorite && product) toggleFavorite(product.id);
  };

  const confirmAdd = (p: Product) => {
    addToCart(p.id, p.name, Number(p.price) || 0, p.emoji ?? '🍽️', restaurantId);
  };

  const handleAddToCart = () => {
    if (product) confirmAdd(product);
  };

  const handleIncrement = () => {
    if (product) updateCartQuantity(product.id, 1);
  };

  const handleDecrement = () => {
    if (product) updateCartQuantity(product.id, -1);
  };

  const store = useMemo<StoreProfile | undefined>(() => {
    if (product?.app !== 'MART' || !product.storeId) return undefined;
    return martStores.find((s) => s.id === product.storeId);
  }, [product?.app, product?.storeId]);

  // "More from store": server-backed (`catalog.products` by store_id + ACTIVE) with the local
  // `@data` pool kept as the offline fallback, so the rail never regresses when the gateway is off.
  const [serverRelated, setServerRelated] = useState<Product[]>([]);
  useEffect(() => {
    if (product?.app !== 'MART' || !product.storeId) {
      setServerRelated([]);
      return;
    }
    let active = true;
    gateway
      .getStoreProducts(product.storeId)
      .then((rows) => {
        if (active) setServerRelated(rows.filter((p) => p.id !== product.id));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [product?.app, product?.storeId, product?.id]);

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    if (serverRelated.length > 0) return serverRelated;
    if (!store) return [];
    return martProducts.filter((p) => p.storeId === store.id && p.id !== product.id);
  }, [store, serverRelated, product]);

  // Overlay approved festival discounts on the "More from store" rail (no-op offline / none apply).
  const relatedDiscounts = useActiveDiscounts(relatedProducts.map((p) => p.id));
  const pricedRelatedProducts = useMemo(
    () => applyActiveDiscounts(relatedProducts, relatedDiscounts),
    [relatedProducts, relatedDiscounts],
  );

  const foodStore = useMemo<StoreProfile | undefined>(() => {
    if (product?.app !== 'FOOD' || !product.shop) return undefined;
    return foodStores.find((s) => s.app === 'FOOD' && s.name === product.shop);
  }, [product?.app, product?.shop]);

  const relatedDishes = useMemo<Product[]>(() => {
    if (product?.app !== 'FOOD' || !product.shop) return [];
    return TODAYS_SPECIALS.filter(
      (d) => d.restaurant === product.shop && d.id !== product.id,
    ).map(dishToProduct);
  }, [product?.app, product?.shop, product?.id]);

  // No product to render: an honest empty state beats a fabricated demo row (which could show an
  // invented price). Placed after every hook so the hook order stays stable across renders.
  if (!product) {
    return (
      <SafeAreaView edges={['top']} style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn} activeOpacity={0.7}>
            <ArrowLeft size={ms(22)} color="#0f172a" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
        <View style={styles.unavailable}>
          <AppText style={styles.unavailableTitle}>Product unavailable</AppText>
          <AppText style={styles.unavailableSub}>
            This item can’t be shown right now. Please try again from the store.
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  const cardWidth = (SCREEN_W - hs(32) - hs(12)) / 2;

  const storeSection = store ? (
    <View style={styles.padded}>
      <View style={styles.storeCard}>
        <View style={styles.storeInfoRow}>
          <View style={styles.storeLogoContainer}>
            <Image source={{ uri: store.coverImage }} style={styles.storeCover} resizeMode="cover" />
            <View style={styles.storeRatingBadge}>
              <AppText style={styles.storeRatingText}>{store.rating}</AppText>
            </View>
          </View>
          <View style={styles.storeDetails}>
            <View style={styles.storeNameRow}>
              <AppText style={styles.storeName} numberOfLines={1}>{store.name}</AppText>
              <ShieldCheck size={ms(16)} color="#3B82F6" fill="#DBEAFE" />
            </View>
            <View style={styles.storeLocationRow}>
              <MapPin size={ms(14)} color="#94a3b8" />
              <AppText style={styles.storeLocationText}>
                Anna Nagar, Chennai · {store.distance} away
              </AppText>
            </View>
            <View style={styles.storeTimeRow}>
              <View style={styles.storeOpenBadge}>
                <AppText style={styles.storeOpenText}>Open now</AppText>
              </View>
              <AppText style={styles.storeCloseText}> · Closes at 10:00 PM</AppText>
            </View>
          </View>
        </View>

        {relatedProducts.length > 0 && (
          <>
            <AppText style={styles.relatedTitle}>More from {store.name}</AppText>
            <View style={styles.relatedGrid}>
              {pricedRelatedProducts.map((p) => {
                const qty = cartItems.find((i) => i.id === p.id)?.quantity ?? 0;
                return (
                  <ProductCardBase
                    key={p.id}
                    product={p}
                    appBrand="MART"
                    variant="grid2"
                    width={cardWidth}
                    showDescription
                    originalPrice={p.originalPrice}
                    quantity={qty}
                    isAdded={qty > 0}
                    onAdd={() => addToCart(p.id, p.name, Number(p.price) || 0, p.emoji ?? '🛍️')}
                    onIncrement={() => updateCartQuantity(p.id, 1)}
                    onDecrement={() => updateCartQuantity(p.id, -1)}
                  />
                );
              })}
            </View>
          </>
        )}

        <TouchableOpacity
          style={styles.viewVendorBtn}
          activeOpacity={0.85}
          onPress={() => onViewVendor?.(store.id)}
        >
          <AppText style={styles.viewVendorBtnText}>View Vendor</AppText>
        </TouchableOpacity>
      </View>
    </View>
  ) : null;

  const foodSection =
    product.app === 'FOOD' && product.shop ? (
      <View style={styles.padded}>
        <View style={styles.storeCard}>
          <TouchableOpacity
            style={styles.storeInfoRow}
            activeOpacity={0.7}
            onPress={onViewRestaurant}
            disabled={!onViewRestaurant}
          >
            <View style={styles.storeLogoContainer}>
              <Image
                source={{ uri: foodStore?.coverImage ?? product.image }}
                style={styles.storeCover}
                resizeMode="cover"
              />
              {foodStore ? (
                <View style={styles.storeRatingBadge}>
                  <AppText style={styles.storeRatingText}>{foodStore.rating}</AppText>
                </View>
              ) : null}
            </View>
            <View style={styles.storeDetails}>
              <View style={styles.storeNameRow}>
                <AppText style={styles.storeName} numberOfLines={1}>{product.shop}</AppText>
                <ShieldCheck size={ms(16)} color="#3B82F6" fill="#DBEAFE" />
              </View>
              <View style={styles.storeLocationRow}>
                <MapPin size={ms(14)} color="#94a3b8" />
                <AppText style={styles.storeLocationText}>
                  {foodStore?.desc ?? 'Restaurant verified'}
                </AppText>
              </View>
              {foodStore ? (
                <View style={styles.storeTimeRow}>
                  <View style={styles.storeOpenBadge}>
                    <AppText style={styles.storeOpenText}>Open now</AppText>
                  </View>
                  <AppText style={styles.storeCloseText}>
                    {' '}
                    · {foodStore.distance} · {foodStore.deliveryTime}
                  </AppText>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>

          {onViewRestaurant ? (
            <TouchableOpacity
              style={styles.viewRestaurantBtn}
              activeOpacity={0.85}
              onPress={onViewRestaurant}
            >
              <AppText style={styles.viewRestaurantBtnText}>View Restaurant</AppText>
            </TouchableOpacity>
          ) : null}

          {relatedDishes.length > 0 && (
            <>
              <AppText style={styles.relatedTitle}>More from {product.shop}</AppText>
              <View style={styles.relatedGrid}>
                {relatedDishes.map((p) => {
                  const qty = cartItems.find((i) => i.id === p.id)?.quantity ?? 0;
                  return (
                    <ProductCardBase
                      key={p.id}
                      product={p}
                      appBrand="FOOD"
                      variant="grid2"
                      width={cardWidth}
                      quantity={qty}
                      isAdded={qty > 0}
                      onPress={onOpenProduct}
                      onAdd={() => confirmAdd(p)}
                      onIncrement={() => updateCartQuantity(p.id, 1)}
                      onDecrement={() => updateCartQuantity(p.id, -1)}
                    />
                  );
                })}
              </View>
            </>
          )}
        </View>
      </View>
    ) : null;

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
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.headerBtn} activeOpacity={0.7}>
          <ArrowLeft size={ms(22)} color="#0f172a" strokeWidth={2.2} />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={onSearch} style={styles.headerBtn} activeOpacity={0.7}>
            <Search size={ms(23)} color="#0f172a" strokeWidth={2.2} />
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

        {storeSection}
        {foodSection}
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
  unavailable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(32),
    gap: vs(8),
  },
  unavailableTitle: {
    fontSize: ms(16),
    fontWeight: '800',
    color: '#0f172a',
  },
  unavailableSub: {
    fontSize: ms(12),
    fontWeight: '500',
    color: '#94a3b8',
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACE.LIST_BOTTOM,
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
    paddingTop: SPACE.SECTION,
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
  storeCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: ms(16),
    padding: hs(14),
  },
  storeInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  storeLogoContainer: {
    position: 'relative',
    marginRight: hs(12),
  },
  storeCover: {
    width: ms(64),
    height: ms(64),
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#eee',
  },
  storeRatingBadge: {
    position: 'absolute',
    bottom: vs(-8),
    alignSelf: 'center',
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: hs(6),
    paddingVertical: vs(2),
    borderRadius: ms(8),
  },
  storeRatingText: {
    color: '#ffffff',
    fontSize: ms(10),
    fontWeight: '800',
  },
  storeDetails: {
    flex: 1,
  },
  storeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
  },
  storeName: {
    fontSize: ms(16),
    fontWeight: '800',
    color: '#0f172a',
    flexShrink: 1,
  },
  storeLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(6),
  },
  storeLocationText: {
    fontSize: ms(12),
    color: '#475569',
    marginLeft: hs(4),
    flexShrink: 1,
  },
  storeTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(4),
  },
  storeOpenBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: hs(6),
    paddingVertical: vs(2),
    borderRadius: ms(4),
  },
  storeOpenText: {
    color: '#059669',
    fontSize: ms(10),
    fontWeight: '700',
  },
  storeCloseText: {
    fontSize: ms(12),
    color: '#94a3b8',
  },
  relatedTitle: {
    fontSize: ms(14),
    fontWeight: '800',
    color: '#0f172a',
    marginTop: SPACE.BLOCK,
    marginBottom: SPACE.BLOCK,
  },
  relatedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  viewVendorBtn: {
    height: Math.max(46, vs(46)),
    borderRadius: ms(12),
    backgroundColor: '#B45309',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACE.BLOCK,
  },
  viewVendorBtnText: {
    color: '#ffffff',
    fontSize: ms(14),
    fontWeight: '800',
  },
  viewRestaurantBtn: {
    height: Math.max(46, vs(46)),
    borderRadius: ms(12),
    backgroundColor: '#B45309',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACE.BLOCK,
  },
  viewRestaurantBtnText: {
    color: '#ffffff',
    fontSize: ms(14),
    fontWeight: '800',
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
