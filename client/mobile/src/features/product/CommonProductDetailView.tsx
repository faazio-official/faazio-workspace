import React, { useEffect, useMemo, useState } from 'react';
import { neutral } from '@/theme/brandTokens';
import { semanticTint } from '@/theme/brandTokens';
import { categorical } from '@/theme/categorical';
import { parentRamp } from '@/theme/brandTokens';
import { SHADOW_COLOR } from '@/theme/tokens';
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
  Package,
  Star,
  Plus,
  Minus,
  AlertCircle,
  RefreshCw,
} from 'lucide-react-native';
import { hs, vs, ms, SCREEN_W } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import AppText from '@/components/AppText';
import ProductCardBase from '@/components/shared/ProductCardBase';
import { applyActiveDiscounts, useActiveDiscounts } from '@/services/pricing';
import { gateway } from '@/services/api/GatewayClient';
import type { Product, StoreProfile } from '@data/types';
import type { ReviewRow } from '@data/reviews/reviews';
import type { StockRow } from '@data/inventory/stock';
import { semantic } from '@/theme/brandTokens';

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
  /**
   * Product reviews from `GET /product/{id}/reviews`. `undefined` = not loaded
   * (offline / remote disabled) so no section is shown; `[]` = the server really
   * has no reviews (honest empty state).
   */
  reviews?: ReviewRow[];
  /** Live stock row from the canonical `GET /product/{id}` read. Gates add-to-cart. */
  stock?: StockRow;
  /** Shown only when the canonical price/stock read failed; re-runs that read. */
  onRetry?: () => void;
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
  reviews,
  stock,
  onRetry,
}: ProductDetailViewProps) {
  const product = propProduct;
  const safePrice = Number(product?.price) || 0;
  const safeOriginal = Number(product?.originalPrice) || 0;
  // Never invent social proof: show a rating only when the product actually has one.
  const safeRating =
    product?.rating !== undefined && Number(product.rating) > 0
      ? Number(product.rating)
      : undefined;
  const safeDesc = product?.desc ?? '';
  const discount = discountPercent(safePrice, safeOriginal);

  const [imageFailed, setImageFailed] = useState(false);
  const [foodImageFailed, setFoodImageFailed] = useState(false);
  const [storeImageFailed, setStoreImageFailed] = useState(false);
  useEffect(() => {
    setImageFailed(false);
    setFoodImageFailed(false);
    setStoreImageFailed(false);
  }, [product?.image]);

  const brand =
    (product?.attributes?.brand as string | undefined) ||
    product?.shop ||
    'Faazio';

  const isFavorite = product ? favorites.includes(product.id) : false;
  const cartItem = product ? cartItems.find((i) => i.id === product.id) : undefined;
  const cartQty = cartItem?.quantity ?? 0;

  // Stock is only known once the canonical read answers; never guess. `available: false`
  // (or a zero quantity) blocks adding and caps the stepper at the remaining stock.
  const outOfStock = stock ? !stock.available || stock.inStockQty <= 0 : false;
  const lowStock =
    !outOfStock && stock?.available === true && stock.inStockQty > 0 && stock.inStockQty <= 5;
  const atStockLimit =
    stock?.available === true && stock.inStockQty > 0 && cartQty >= stock.inStockQty;
  const canAddMore = !outOfStock && !atStockLimit;

  const handleToggleFavorite = () => {
    if (toggleFavorite && product) toggleFavorite(product.id);
  };

  const confirmAdd = (p: Product) => {
    addToCart(p.id, p.name, Number(p.price) || 0, p.emoji ?? 'dining', restaurantId);
  };

  const handleAddToCart = () => {
    if (product && canAddMore) confirmAdd(product);
  };

  const handleIncrement = () => {
    if (product && canAddMore) updateCartQuantity(product.id, 1);
  };

  const handleDecrement = () => {
    if (product) updateCartQuantity(product.id, -1);
  };

  // Store resolution is server-first: `GET /store/{id}` is the same directory that backs the
  // vendor/medical-shop pages, so the PDP block never shows stale authored copy while online.
  // Fixtures remain the offline/error fallback only (no answer → authored row).
  const [serverStore, setServerStore] = useState<{ id: string; store: StoreProfile } | null>(null);
  useEffect(() => {
    setServerStore(null);
    const storeId = product?.storeId;
    if (!storeId) return;
    let active = true;
    gateway
      .getStore(storeId)
      .then((row) => {
        if (active && row) setServerStore({ id: storeId, store: row as StoreProfile });
      })
      .catch(() => {
        if (active) setServerStore(null);
      });
    return () => {
      active = false;
    };
  }, [product?.storeId]);

  // The store block is server-backed (`GET /store/:id`). No bundled store directory is consulted —
  // a failed/absent read simply leaves the block off the PDP.
  const store = useMemo<StoreProfile | undefined>(() => {
    if (!product?.storeId) return undefined;
    if (serverStore?.id === product.storeId) return serverStore.store;
    return undefined;
  }, [serverStore, product?.storeId]);

// "More from store": server-backed (`catalog.products` by store_id + ACTIVE). A failed/not-loaded
  // read leaves the rail empty — there is no bundled product pool to substitute. `null` = no
  // authoritative answer (offline/error/not loaded); `[]` = the store really has no other ACTIVE
  // products.
  const [serverRelated, setServerRelated] = useState<Product[] | null>(null);
  useEffect(() => {
    setServerRelated(null);
    if ((product?.app !== 'MART' && product?.app !== 'PHARMA') || !product.storeId) {
      return;
    }
    let active = true;
    gateway
      .getStoreProducts(product.storeId)
      .then((rows) => {
        if (active) setServerRelated(rows.filter((p) => p.id !== product.id));
      })
      .catch(() => {
        if (active) setServerRelated(null);
      });
    return () => {
      active = false;
    };
  }, [product?.app, product?.storeId, product?.id]);

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    if (serverRelated !== null) return serverRelated;
    return [];
  }, [serverRelated, product]);

  // Overlay approved festival discounts on the "More from store" rail (no-op offline / none apply).
  const relatedDiscounts = useActiveDiscounts(relatedProducts.map((p) => p.id));
  const pricedRelatedProducts = useMemo(
    () => applyActiveDiscounts(relatedProducts, relatedDiscounts),
    [relatedProducts, relatedDiscounts],
  );

  // No product to render: an honest empty state beats a fabricated demo row (which could show an
  // invented price). Placed after every hook so the hook order stays stable across renders.
  if (!product) {
    return (
      <SafeAreaView edges={['top']} style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn} activeOpacity={0.7}>
            <ArrowLeft size={ms(22)} color={neutral.ink} strokeWidth={2.2} />
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
            {store.coverImage && !storeImageFailed ? (
              <Image
                source={{ uri: store.coverImage }}
                style={styles.storeCover}
                resizeMode="cover"
                onError={() => setStoreImageFailed(true)}
              />
            ) : (
              <View style={[styles.storeCover, styles.storeCoverFallback]}>
                <Package size={ms(26)} color={neutral.inkSubtle} strokeWidth={1.8} />
              </View>
            )}
            <View style={styles.storeRatingBadge}>
              <AppText style={styles.storeRatingText}>{store.rating}</AppText>
            </View>
          </View>
          <View style={styles.storeDetails}>
            <View style={styles.storeNameRow}>
              <AppText style={styles.storeName} numberOfLines={1}>{store.name}</AppText>
              <ShieldCheck size={ms(16)} color={parentRamp.base} fill={semanticTint.info} />
            </View>
            <View style={styles.storeLocationRow}>
              <MapPin size={ms(14)} color={neutral.inkSubtle} />
              <AppText style={styles.storeLocationText} numberOfLines={1}>
                {store.address ? `${store.address.split(',').slice(0, 2).join(',')} · ` : ''}
                {store.distance} away
              </AppText>
            </View>
            {store.hours ? (
              <View style={styles.storeTimeRow}>
                <AppText style={styles.storeCloseText}>{store.hours}</AppText>
              </View>
            ) : null}
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
                    appBrand={product.app === 'PHARMA' ? 'PHARMA' : 'MART'}
                    variant="grid2"
                    width={cardWidth}
                    showDescription
                    originalPrice={p.originalPrice}
                    quantity={qty}
                    isAdded={qty > 0}
                    onPress={onOpenProduct}
                    onAdd={() => addToCart(p.id, p.name, Number(p.price) || 0, p.emoji ?? 'mart')}
                    onIncrement={() => updateCartQuantity(p.id, 1)}
                    onDecrement={() => updateCartQuantity(p.id, -1)}
                  />
                );
              })}
            </View>
          </>
        )}

        {onViewVendor ? (
          <TouchableOpacity
            style={styles.viewVendorBtn}
            activeOpacity={0.85}
            onPress={() => onViewVendor(store.id)}
          >
            <AppText style={styles.viewVendorBtnText}>View Vendor</AppText>
          </TouchableOpacity>
        ) : null}
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
              {foodImageFailed || !product.image ? (
                <View style={[styles.storeCover, styles.storeCoverFallback]}>
                  <Package size={ms(28)} color={neutral.inkSubtle} strokeWidth={1.25} />
                </View>
              ) : (
                <Image
                  source={{ uri: product.image }}
                  style={styles.storeCover}
                  resizeMode="cover"
                  onError={() => setFoodImageFailed(true)}
                />
              )}
            </View>
            <View style={styles.storeDetails}>
              <View style={styles.storeNameRow}>
                <AppText style={styles.storeName} numberOfLines={1}>{product.shop}</AppText>
                <ShieldCheck size={ms(16)} color={parentRamp.base} fill={semanticTint.info} />
              </View>
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

        </View>
      </View>
    ) : null;

  const heroImage = product.image && !imageFailed ? (
    <Image
      source={{ uri: product.image }}
      style={styles.heroImage}
      resizeMode="cover"
      onError={() => setImageFailed(true)}
    />
  ) : (
    <View style={styles.heroEmojiTile}>
      <Package size={ms(64)} color={neutral.inkSubtle} strokeWidth={1.25} />
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onClose}
          style={styles.headerBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Close product details"
        >
          <ArrowLeft size={ms(22)} color={neutral.ink} strokeWidth={2.2} />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={onSearch}
            style={styles.headerBtn}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Search"
          >
            <Search size={ms(23)} color={neutral.ink} strokeWidth={2.2} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onCart}
            style={styles.headerBtn}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open cart"
          >
            <ShoppingCart size={ms(20)} color={neutral.ink} strokeWidth={2.2} />
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
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
            accessibilityState={{ selected: isFavorite }}
          >
            <Heart
              size={ms(20)}
              color={isFavorite ? categorical.rose : neutral.inkMuted}
              fill={isFavorite ? categorical.rose : 'none'}
            />
          </TouchableOpacity>
        </View>

        {/* Core details */}
        <View style={styles.padded}>
          <AppText style={styles.brandText} numberOfLines={1}>{brand}</AppText>
          <AppText style={styles.titleText} numberOfLines={2}>{product.name}</AppText>

          {safeRating !== undefined ? (
            <View style={styles.ratingRow}>
              <View style={styles.ratingPill}>
                <AppText style={styles.ratingPillText}>{safeRating.toFixed(1)}</AppText>
                <Star size={ms(11)} color={categorical.amber} fill={categorical.amber} strokeWidth={1.5} />
              </View>
              {product.reviewsCount ? (
                <AppText style={styles.ratingMeta}>{product.reviewsCount} ratings</AppText>
              ) : null}
            </View>
          ) : null}

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

          {outOfStock ? (
            <View style={styles.availabilityRow}>
              <AlertCircle size={ms(14)} color={semantic.danger} strokeWidth={2.2} />
              <AppText style={styles.outOfStockText}>Out of stock</AppText>
            </View>
          ) : lowStock ? (
            <View style={styles.availabilityRow}>
              <AlertCircle size={ms(14)} color={semantic.warning} strokeWidth={2.2} />
              <AppText style={styles.lowStockText}>
                Only {stock?.inStockQty} left in stock
              </AppText>
            </View>
          ) : null}

          {onRetry ? (
            <View style={styles.retryBanner}>
              <AppText style={styles.retryText}>
                Couldn’t refresh live price and stock.
              </AppText>
              <TouchableOpacity
                onPress={onRetry}
                style={styles.retryBtn}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Retry loading price and stock"
              >
                <RefreshCw size={ms(13)} color={semantic.info} strokeWidth={2.4} />
                <AppText style={styles.retryBtnText}>Retry</AppText>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* Product details — only render the block when there is real content. */}
        {safeDesc || product.unit ? (
          <View style={styles.padded}>
            <AppText style={styles.sectionLabel}>Product details</AppText>
            {safeDesc ? <AppText style={styles.descText}>{safeDesc}</AppText> : null}
            {product.unit ? (
              <AppText style={styles.unitText}>Pack size: {product.unit}</AppText>
            ) : null}
          </View>
        ) : null}

        {reviews !== undefined ? (
          <View style={styles.padded}>
            <AppText style={styles.sectionLabel}>Ratings & Reviews</AppText>
            {reviews.length === 0 ? (
              <AppText style={styles.reviewsEmpty}>No reviews yet.</AppText>
            ) : (
              <View style={styles.reviewList}>
                {reviews.map((review) => (
                  <View key={review.id} style={styles.reviewRow}>
                    <View style={styles.reviewHeader}>
                      <AppText style={styles.reviewer} numberOfLines={1}>
                        {review.user}
                      </AppText>
                      <AppText style={styles.reviewDate}>{review.date}</AppText>
                    </View>
                    <View style={styles.reviewStars}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={ms(12)}
                          color={star <= review.rating ? categorical.amber : neutral.border}
                          fill={star <= review.rating ? categorical.amber : 'transparent'}
                          strokeWidth={1.6}
                        />
                      ))}
                    </View>
                    {review.comment ? (
                      <AppText style={styles.reviewComment}>{review.comment}</AppText>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}

        {storeSection}
        {foodSection}
      </ScrollView>

      {/* Sticky footer */}
      <View style={styles.footer}>
        {cartQty === 0 ? (
          outOfStock ? (
            <View
              style={[styles.footerBtn, styles.addToCartBtn, styles.addToCartBtnDisabled]}
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              accessibilityLabel="Out of stock"
            >
              <AppText style={[styles.addToCartText, styles.addToCartTextDisabled]}>
                Out of stock
              </AppText>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleAddToCart}
              style={[styles.footerBtn, styles.addToCartBtn]}
              activeOpacity={0.85}
            >
              <AppText style={styles.addToCartText}>Add to Cart</AppText>
            </TouchableOpacity>
          )
        ) : (
          <>
            <View style={styles.stepper}>
              <TouchableOpacity onPress={handleDecrement} style={styles.stepBtn} activeOpacity={0.8}>
                <Minus size={ms(18)} strokeWidth={2.5} color={neutral.ink} />
              </TouchableOpacity>
              <AppText style={styles.stepValue}>{cartQty}</AppText>
              <TouchableOpacity
                onPress={handleIncrement}
                style={styles.stepBtn}
                activeOpacity={0.8}
                disabled={!canAddMore}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canAddMore }}
                accessibilityLabel="Increase quantity"
              >
                <Plus
                  size={ms(18)}
                  strokeWidth={2.5}
                  color={canAddMore ? neutral.ink : neutral.inkSubtle}
                />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={onCart}
              style={[styles.footerBtn, styles.goToCartBtn]}
              activeOpacity={0.85}
            >
              <ShoppingCart size={ms(18)} color={neutral.card} strokeWidth={2.2} />
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
    backgroundColor: neutral.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: hs(12),
    paddingVertical: vs(6),
    backgroundColor: neutral.card,
    borderBottomWidth: 1,
    borderBottomColor: neutral.surfaceAlt,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    fontWeight: '600',
    color: neutral.ink,
  },
  unavailableSub: {
    fontSize: ms(12),
    fontWeight: '500',
    color: neutral.inkSubtle,
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
    height: Math.min(SCREEN_W, vs(320)),
    backgroundColor: neutral.surface,
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
    backgroundColor: neutral.surface,
  },
  heroEmoji: {
    fontSize: ms(80),
  },
  heartBtn: {
    position: 'absolute',
    top: vs(12),
    right: hs(12),
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: SHADOW_COLOR,
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
    color: neutral.inkMuted,
    fontWeight: '600',
    marginBottom: vs(2),
  },
  titleText: {
    fontSize: ms(20),
    fontWeight: '600',
    color: neutral.ink,
    lineHeight: ms(26),
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(10),
    gap: hs(8),
  },
  ratingPill: {
    backgroundColor: semantic.success,
    borderRadius: ms(6),
    paddingVertical: vs(3),
    paddingHorizontal: hs(8),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingPillText: {
    color: neutral.card,
    fontSize: ms(11),
    fontWeight: '600',
  },
  ratingMeta: {
    fontSize: ms(11),
    color: neutral.inkSubtle,
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
    fontWeight: '600',
    color: neutral.ink,
  },
  mrp: {
    fontSize: ms(14),
    color: neutral.inkSubtle,
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  discount: {
    fontSize: ms(14),
    color: semantic.success,
    fontWeight: '600',
  },
  inclTax: {
    fontSize: ms(11),
    color: semantic.success,
    fontWeight: '600',
    marginTop: vs(3),
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
    marginTop: vs(10),
  },
  outOfStockText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: semantic.danger,
  },
  lowStockText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: semantic.warning,
  },
  retryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: hs(10),
    marginTop: SPACE.BLOCK,
    paddingVertical: vs(10),
    paddingHorizontal: hs(12),
    borderRadius: ms(12),
    backgroundColor: semanticTint.warning,
  },
  retryText: {
    flexShrink: 1,
    fontSize: ms(12),
    fontWeight: '500',
    color: neutral.ink,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    paddingVertical: vs(4),
    paddingHorizontal: hs(8),
    borderRadius: ms(8),
    backgroundColor: neutral.card,
  },
  retryBtnText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: semantic.info,
  },
  reviewsEmpty: {
    fontSize: ms(13),
    color: neutral.inkSubtle,
  },
  reviewList: {
    gap: SPACE.SECTION,
  },
  reviewRow: {
    borderTopWidth: 1,
    borderTopColor: neutral.surfaceAlt,
    paddingTop: SPACE.BLOCK,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
  },
  reviewer: {
    flexShrink: 1,
    fontSize: ms(13),
    fontWeight: '600',
    color: neutral.ink,
  },
  reviewDate: {
    marginLeft: 'auto',
    fontSize: ms(11),
    color: neutral.inkSubtle,
  },
  reviewStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(2),
    marginTop: vs(4),
  },
  reviewComment: {
    marginTop: vs(6),
    fontSize: ms(13),
    color: neutral.inkMuted,
    lineHeight: ms(19),
  },
  sectionLabel: {
    fontSize: ms(13),
    fontWeight: '600',
    color: neutral.ink,
    marginBottom: vs(8),
  },
  descText: {
    fontSize: ms(13),
    color: neutral.inkMuted,
    fontWeight: '400',
    lineHeight: ms(19),
  },
  unitText: {
    fontSize: ms(13),
    color: neutral.inkMuted,
    fontWeight: '500',
    marginTop: vs(8),
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
    backgroundColor: semantic.success,
  },
  highlightText: {
    fontSize: ms(12),
    color: neutral.inkMuted,
    fontWeight: '500',
    flex: 1,
  },
  storeCard: {
    backgroundColor: neutral.card,
    borderWidth: 1,
    borderColor: neutral.surfaceAlt,
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
    borderColor: neutral.border,
  },
  storeCoverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: neutral.surfaceAlt,
  },
  storeRatingBadge: {
    position: 'absolute',
    bottom: vs(-8),
    alignSelf: 'center',
    backgroundColor: semantic.success,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: hs(6),
    paddingVertical: vs(2),
    borderRadius: ms(8),
  },
  storeRatingText: {
    color: neutral.card,
    fontSize: ms(10),
    fontWeight: '600',
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
    fontWeight: '600',
    color: neutral.ink,
    flexShrink: 1,
  },
  storeLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(6),
  },
  storeLocationText: {
    fontSize: ms(12),
    color: neutral.inkMuted,
    marginLeft: hs(4),
    flexShrink: 1,
  },
  storeTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(4),
  },
  storeOpenBadge: {
    backgroundColor: semanticTint.success,
    paddingHorizontal: hs(6),
    paddingVertical: vs(2),
    borderRadius: ms(4),
  },
  storeOpenText: {
    color: semantic.success,
    fontSize: ms(10),
    fontWeight: '600',
  },
  storeCloseText: {
    fontSize: ms(12),
    color: neutral.inkSubtle,
  },
  relatedTitle: {
    fontSize: ms(14),
    fontWeight: '600',
    color: neutral.ink,
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
    backgroundColor: categorical.amber,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACE.BLOCK,
  },
  viewVendorBtnText: {
    color: neutral.card,
    fontSize: ms(14),
    fontWeight: '600',
  },
  viewRestaurantBtn: {
    height: Math.max(46, vs(46)),
    borderRadius: ms(12),
    backgroundColor: categorical.amber,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACE.BLOCK,
  },
  viewRestaurantBtnText: {
    color: neutral.card,
    fontSize: ms(14),
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: hs(12),
    paddingHorizontal: hs(16),
    paddingTop: vs(12),
    paddingBottom: vs(8),
    backgroundColor: neutral.card,
    borderTopWidth: 1,
    borderTopColor: neutral.surfaceAlt,
  },
  footerBtn: {
    flex: 1,
    height: Math.max(48, vs(48)),
    borderRadius: ms(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  addToCartBtn: {
    backgroundColor: neutral.card,
    borderWidth: 1.5,
    borderColor: neutral.ink,
  },
  addToCartBtnDisabled: {
    borderColor: neutral.border,
    backgroundColor: neutral.surfaceAlt,
  },
  addToCartText: {
    color: neutral.ink,
    fontSize: ms(14),
    fontWeight: '600',
  },
  addToCartTextDisabled: {
    color: neutral.inkSubtle,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: neutral.surfaceAlt,
    borderRadius: ms(14),
    padding: vs(4),
    minWidth: hs(120),
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: neutral.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  stepValue: {
    fontSize: ms(15),
    fontWeight: '600',
    color: neutral.ink,
    minWidth: ms(28),
    textAlign: 'center',
  },
  goToCartBtn: {
    flexDirection: 'row',
    gap: hs(8),
    backgroundColor: neutral.ink,
  },
  goToCartText: {
    color: neutral.card,
    fontSize: ms(14),
    fontWeight: '600',
  },
});
