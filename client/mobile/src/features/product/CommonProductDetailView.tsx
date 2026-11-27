import React, { useEffect, useMemo, useState } from 'react';
import { neutral, semantic, semanticTint } from '@/theme/brandTokens';
import { categorical } from '@/theme/categorical';
import { parentRamp } from '@/theme/brandTokens';
import { SHADOW_COLOR } from '@/theme/tokens';
import { brandTokens } from '@/theme/brandTokens';
import { StyleSheet, View, ScrollView, TouchableOpacity, Image, Share } from 'react-native';
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
  Share2,
  Clock,
  Tag,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react-native';
import { hs, vs, ms, SCREEN_W } from '@/utils/responsive';
const CARD_GAP = hs(12);
const CARD_WIDTH = (SCREEN_W - hs(32) - CARD_GAP) / 2;
import { SPACE } from '@/theme/spacing';
import AppText from '@/components/AppText';
import { FaazioLogo } from '@/components/FaazioLogo';
import ProductCardBase from '@/components/shared/ProductCardBase';
import SurfaceCard from '@/components/shared/SurfaceCard';
import VegMark from '@/components/shared/VegMark';
import { formatRating } from '@/components/shared/format';
import { applyActiveDiscounts, useActiveDiscounts } from '@/services/pricing';
import { gateway } from '@/services/api/GatewayClient';
import type { Product, StoreProfile, ProductVariant } from '@data/types';
import type { ReviewRow } from '@data/reviews/reviews';
import type { StockRow } from '@data/inventory/stock';
import type { ProductReviewSummary, PublicCoupon, MenuDish } from '@/services/api/GatewayClient';
import { localizedDesc, localizedName } from '@/lib/localizedText';
import { useLanguageStore } from '@/state/languageStore';
import { useAddressesStore } from '@/state/addressesStore';
import { useThemeMode } from '@/hooks/useThemeMode';

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
  onViewVendor?: (storeId: string) => void;
  onViewRestaurant?: () => void;
  onOpenProduct?: (product: Product) => void;
  onSelectVariant?: (variantId: string) => void;
  restaurantId?: string;
  reviews?: ReviewRow[];
  onWriteReview?: () => void;
  stock?: StockRow;
  onRetry?: () => void;
  /** Server aggregate for the ratings histogram (`GET /product/{id}/reviews/summary`). */
  reviewSummary?: ProductReviewSummary;
  /** Shown only for an Rx product; opens the prescription capture flow. */
  onUploadPrescription?: () => void;
  /** The server-approved festival discount applied to this product, if any. */
  activeDiscountPercent?: number;
}

function discountPercent(price: number, original?: number): number {
  if (!original || original <= price) return 0;
  return Math.round(((original - price) / original) * 100);
}

/**
 * Map a restaurant menu dish (`GET /venues/{id}/menu`) onto the shared `Product` card shape so the
 * FOOD PDP can render a "Recommended" grid of sibling dishes without leaking into the Mart catalog.
 * The venue id is carried through so tapping a recommended dish loads that restaurant's menu again.
 */
function menuDishToProduct(dish: MenuDish, ctx: { storeId?: string; shop?: string }): Product {
  return {
    id: dish.id,
    app: 'FOOD',
    category: dish.cuisine ?? 'Featured',
    name: dish.name,
    price: dish.price,
    ...(dish.mrp !== undefined && dish.mrp > dish.price ? { originalPrice: dish.mrp } : {}),
    emoji: 'dining',
    rating: dish.rating ?? 0,
    desc: dish.description ?? '',
    image: dish.image ?? '',
    ...(ctx.shop ? { shop: ctx.shop } : {}),
    ...(ctx.storeId ? { storeId: ctx.storeId } : {}),
    ...(dish.nameTa ? { nameTa: dish.nameTa } : {}),
    ...(dish.descTa ? { descTa: dish.descTa } : {}),
    ...(dish.isVeg !== undefined ? { isVeg: dish.isVeg } : {}),
  };
}

function inr(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <AppText style={styles.infoLabel}>{label}</AppText>
      <AppText style={styles.infoValue}>{value}</AppText>
    </View>
  );
}

interface LegalMetrologyView {
  countryOfOrigin?: string;
  manufacturerName?: string;
  manufacturerAddress?: string;
  packerName?: string;
  packerAddress?: string;
  shelfLifeDays?: number;
  storage?: string;
  returnPolicy?: string;
}

const RETURN_LABELS: Record<string, string> = {
  '7_DAY_REPLACEMENT': '7-day replacement',
  NON_RETURNABLE: 'Non-returnable',
  NO_RETURN_FOOD: 'No return on food',
  MANUFACTURER_WARRANTY: 'Manufacturer warranty',
};

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
  onSelectVariant,
  restaurantId,
  reviews,
  onWriteReview,
  stock,
  onRetry,
  reviewSummary,
  onUploadPrescription,
  activeDiscountPercent,
}: ProductDetailViewProps) {
  const palette = useThemeMode().palette;
  const product = propProduct;
  const safePrice = Number(product?.price) || 0;
  const safeOriginal = Number(product?.originalPrice) || 0;
  const safeRating =
    product?.rating !== undefined && Number(product.rating) > 0 ? Number(product.rating) : undefined;
  const language = useLanguageStore((s) => s.language);
  const deliveryAddress = useAddressesStore(
    (s) => s.addresses.find((a) => a.isDefault) ?? s.addresses[0],
  );
  const displayName = product ? localizedName(product, language) : '';
  const safeDesc = product ? localizedDesc(product, language) : '';
  const discount = discountPercent(safePrice, safeOriginal);
  const tokens = product ? brandTokens[product.app] : brandTokens.MART;

  const [imageFailed, setImageFailed] = useState(false);
  const [foodImageFailed, setFoodImageFailed] = useState(false);
  const [storeImageFailed, setStoreImageFailed] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [showInfo, setShowInfo] = useState(true);
  const [coupons, setCoupons] = useState<PublicCoupon[]>([]);
  useEffect(() => {
    setImageFailed(false);
    setFoodImageFailed(false);
    setStoreImageFailed(false);
    setActiveImage(0);
  }, [product?.image]);

  const attributes = product?.attributes as
    | { brand?: unknown; highlights?: unknown; ingredients?: unknown; saltComposition?: unknown; legalMetrology?: unknown }
    | undefined;
  const brand =
    product?.brand ||
    (typeof attributes?.brand === 'string' ? attributes.brand : undefined) ||
    product?.shop ||
    '';
  const highlights = Array.isArray(attributes?.highlights)
    ? (attributes.highlights as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];
  const ingredients = typeof attributes?.ingredients === 'string' ? attributes.ingredients : undefined;
  const saltComposition = typeof attributes?.saltComposition === 'string' ? attributes.saltComposition : undefined;
  const legalMetrology = (attributes?.legalMetrology ?? undefined) as LegalMetrologyView | undefined;
  const isPrescription = product?.isPrescription === true || stock?.isPrescription === true;

  const gallery = useMemo(() => {
    if (!product) return [];
    const list = [product.image, ...(product.gallery ?? [])].filter((v): v is string => Boolean(v));
    return Array.from(new Set(list));
  }, [product]);
  useEffect(() => {
    if (activeImage >= gallery.length) setActiveImage(0);
  }, [activeImage, gallery.length]);

  useEffect(() => {
    if (!product || !gateway.remoteEnabled) {
      setCoupons([]);
      return;
    }
    let active = true;
    gateway
      .getCoupons(product.app)
      .then((rows) => {
        if (active) setCoupons(rows.slice(0, 2));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [product?.app, product?.id]);

  const isFavorite = product ? favorites.includes(product.id) : false;
  const cartItem = product ? cartItems.find((i) => i.id === product.id) : undefined;
  const cartQty = cartItem?.quantity ?? 0;

  const outOfStock = stock ? !stock.available || stock.inStockQty <= 0 : false;
  const lowStock = !outOfStock && stock?.available === true && stock.inStockQty > 0 && stock.inStockQty <= 5;
  const atStockLimit = stock?.available === true && stock.inStockQty > 0 && cartQty >= stock.inStockQty;
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
  const handleShare = () => {
    if (!product) return;
    void Share.share({
      message: `${displayName} — ${inr(safePrice)} on Faazio`,
    }).catch(() => undefined);
  };

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

  const store = useMemo<StoreProfile | undefined>(() => {
    if (!product?.storeId) return undefined;
    if (serverStore?.id === product.storeId) return serverStore.store;
    return undefined;
  }, [serverStore, product?.storeId]);

  const [serverRelated, setServerRelated] = useState<Product[] | null>(null);
  // Where the rail came from, so the subtitle never claims "same restaurant" for personalized rows.
  const [relatedSource, setRelatedSource] = useState<'store' | 'personal' | null>(null);
  useEffect(() => {
    setServerRelated(null);
    setRelatedSource(null);
    const app = product?.app;
    const storeId = product?.storeId;
    const selfId = product?.id;
    const shop = product?.shop;
    if (!app || !selfId) return;
    let active = true;
    const cap = 12;
    void (async () => {
      // 1) Same vendor / same restaurant — the reliable "Recommended" source for every sector.
      if (storeId) {
        try {
          if (app === 'FOOD') {
            // FOOD PDP ids are `directory.menus` dish ids; the venue id is the restaurant/store id.
            const dishes = await gateway.fetchMenu(storeId);
            const rows = dishes
              .filter((d) => d.id !== selfId)
              .slice(0, cap)
              .map((d) => menuDishToProduct(d, { storeId, shop }));
            if (active && rows.length > 0) {
              setServerRelated(rows);
              setRelatedSource('store');
              return;
            }
          } else {
            const rows = await gateway.getStoreProducts(storeId);
            const filtered = rows.filter((p) => p.id !== selfId).slice(0, cap);
            if (active && filtered.length > 0) {
              setServerRelated(filtered);
              setRelatedSource('store');
              return;
            }
          }
        } catch {
          /* fall through to personalized recommendations */
        }
      }
      // 2) Personalized fallback (same app, never the current item). Honest [] when unavailable.
      try {
        const recs = await gateway.getRecommendations();
        const filtered = recs.filter((p) => p.app === app && p.id !== selfId).slice(0, cap);
        if (active) {
          setServerRelated(filtered);
          setRelatedSource(filtered.length > 0 ? 'personal' : null);
        }
      } catch {
        if (active) setServerRelated([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [product?.app, product?.storeId, product?.id, product?.shop]);

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    if (serverRelated !== null) return serverRelated;
    return [];
  }, [serverRelated, product]);

  const relatedDiscounts = useActiveDiscounts(relatedProducts.map((p) => p.id));
  const pricedRelatedProducts = useMemo(
    () => applyActiveDiscounts(relatedProducts, relatedDiscounts),
    [relatedProducts, relatedDiscounts],
  );

  if (!product) {
    return (
      <SafeAreaView edges={['top']} style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn} activeOpacity={0.7}>
            <ArrowLeft size={ms(22)} color={neutral.ink} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
        <View style={styles.unavailable}>
          <View accessible accessibilityRole="image" accessibilityLabel="Faazio">
            <FaazioLogo size={32} variant="welcome" />
          </View>
          <AppText style={styles.unavailableTitle}>Product unavailable</AppText>
          <AppText style={styles.unavailableSub}>
            This item can’t be shown right now. Please try again from the store.
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  const eta = stock?.eta || store?.deliveryTime;
  const heroImage = gallery[activeImage];
  const offers: { key: string; icon: React.ReactNode; title: string; sub?: string }[] = [];
  if (activeDiscountPercent && activeDiscountPercent > 0) {
    offers.push({
      key: 'festival',
      icon: <Tag size={ms(14)} color={semantic.success} strokeWidth={2.2} />,
      title: `Extra ${activeDiscountPercent}% off`,
      sub: 'Applied to the price above',
    });
  }
  if (store?.offerTag) {
    offers.push({
      key: 'store',
      icon: <Tag size={ms(14)} color={semantic.info} strokeWidth={2.2} />,
      title: store.offerTag,
      sub: store.name,
    });
  }
  for (const c of coupons) {
    offers.push({
      key: `coupon-${c.code}`,
      icon: <Tag size={ms(14)} color={semantic.warning} strokeWidth={2.2} />,
      title: c.title?.trim() || `₹${c.maxDiscount} off`,
      sub: `${c.code}${c.minOrder > 0 ? ` · on orders above ₹${c.minOrder}` : ''}`,
    });
  }

  const infoRows: Array<[string, string | undefined]> = [
    ['Country of origin', legalMetrology?.countryOfOrigin],
    ['Manufacturer', legalMetrology?.manufacturerName],
    ['Manufacturer address', legalMetrology?.manufacturerAddress],
    ['Packer', legalMetrology?.packerName],
    ['Packer address', legalMetrology?.packerAddress],
    ['Net quantity', product.unit],
    ['Shelf life', legalMetrology?.shelfLifeDays ? `${legalMetrology.shelfLifeDays} days` : undefined],
    ['Storage', legalMetrology?.storage],
    ['Return policy', legalMetrology?.returnPolicy ? RETURN_LABELS[legalMetrology.returnPolicy] ?? legalMetrology.returnPolicy : undefined],
    ['Salt composition', saltComposition],
  ];
  const hasInfo = infoRows.some(([, value]) => Boolean(value));

  const variants: ProductVariant[] = product.variants ?? [];
  const showVariants = variants.length > 0;

  const ratings = reviewSummary;
  const distribution: number[] = ratings?.distribution ? [...ratings.distribution] : [0, 0, 0, 0, 0];
  const ratingCount = ratings?.count ?? product.reviewsCount ?? 0;
  const ratingAverage = ratings?.average ?? safeRating ?? 0;

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: palette.canvas }]}>
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
          <TouchableOpacity onPress={onSearch} style={styles.headerBtn} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Search">
            <Search size={ms(23)} color={neutral.ink} strokeWidth={2.2} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} style={styles.headerBtn} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Share product">
            <Share2 size={ms(20)} color={neutral.ink} strokeWidth={2.2} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onCart} style={styles.headerBtn} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Open cart">
            <ShoppingCart size={ms(20)} color={neutral.ink} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero + media gallery */}
        <SurfaceCard style={styles.heroCard}>
          <View style={styles.hero}>
            {heroImage && !imageFailed ? (
              <Image source={{ uri: heroImage }} style={styles.heroImage} resizeMode="cover" onError={() => setImageFailed(true)} />
            ) : (
              <View style={styles.heroEmojiTile}>
                <Package size={ms(56)} color={neutral.inkSubtle} strokeWidth={1.25} />
              </View>
            )}
            <TouchableOpacity
              onPress={handleToggleFavorite}
              style={styles.heartBtn}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
              accessibilityState={{ selected: isFavorite }}
            >
              <Heart size={ms(20)} color={isFavorite ? categorical.rose : neutral.inkMuted} fill={isFavorite ? categorical.rose : 'none'} />
            </TouchableOpacity>
          </View>
          {gallery.length > 1 ? (
            <View style={styles.dots} accessible accessibilityLabel={`Image ${activeImage + 1} of ${gallery.length}`}>
              {gallery.map((uri, index) => (
                <TouchableOpacity key={`${uri}-${index}`} onPress={() => setActiveImage(index)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <View style={[styles.dot, index === activeImage && styles.dotActive]} />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </SurfaceCard>

        {/* Buy box */}
        <SurfaceCard style={styles.sectionGap}>
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              {brand ? <AppText style={styles.brandText} numberOfLines={1}>{brand}</AppText> : null}
              <AppText style={styles.titleText} numberOfLines={2}>{displayName}</AppText>
            </View>
            {product.isVeg !== undefined ? <VegMark isVeg={product.isVeg !== false} /> : null}
          </View>

          {safeRating !== undefined ? (
            <View style={styles.ratingRow}>
              <View style={styles.ratingPill}>
                <AppText style={styles.ratingPillText}>{safeRating.toFixed(1)}</AppText>
                <Star size={ms(11)} color={categorical.amber} fill={categorical.amber} strokeWidth={1.5} />
              </View>
              {product.reviewsCount ? <AppText style={styles.ratingMeta}>{product.reviewsCount} ratings</AppText> : null}
            </View>
          ) : null}

          {showVariants ? (
            <View style={styles.variantWrap}>
              {variants.map((v) => {
                const selected = v.id === product.id;
                return (
                  <TouchableOpacity
                    key={v.id}
                    onPress={() => {
                      if (!selected) onSelectVariant?.(v.id);
                    }}
                    disabled={selected || !onSelectVariant}
                    style={[styles.variantChip, selected && styles.variantChipSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${v.label || 'Variant'}, ${inr(v.price)}`}
                  >
                    <AppText style={[styles.variantLabel, selected && styles.variantLabelSelected]}>{v.label || 'Default'}</AppText>
                    <AppText style={[styles.variantPrice, selected && styles.variantLabelSelected]}>{inr(v.price)}</AppText>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : product.unit ? (
            <View style={styles.singleVariantChip}>
              <AppText style={styles.singleVariantText}>{product.unit}</AppText>
            </View>
          ) : null}

          <View style={styles.priceRow}>
            <AppText style={styles.finalPrice}>{inr(safePrice)}</AppText>
            {safeOriginal > safePrice ? (
              <>
                <AppText style={styles.mrp}>{inr(safeOriginal)}</AppText>
                <AppText style={styles.discount}>{discount}% OFF</AppText>
              </>
            ) : null}
          </View>
          <AppText style={styles.inclTax}>Inclusive of all taxes</AppText>

          {eta || deliveryAddress ? (
            <View style={styles.etaBlock}>
              {eta ? (
                <View style={styles.etaRow}>
                  <Clock size={ms(14)} color={semantic.success} strokeWidth={2.2} />
                  <AppText style={styles.etaText}>Delivery in {eta}</AppText>
                </View>
              ) : null}
              {deliveryAddress ? (
                <View style={styles.etaRow}>
                  <MapPin size={ms(13)} color={neutral.inkSubtle} strokeWidth={2.2} />
                  <AppText style={styles.etaAddress} numberOfLines={1}>
                    Deliver to {deliveryAddress.tag} · {deliveryAddress.address.split(',')[0]}
                  </AppText>
                </View>
              ) : null}
            </View>
          ) : null}

          {isPrescription ? (
            <TouchableOpacity
              style={styles.rxBanner}
              activeOpacity={0.85}
              onPress={onUploadPrescription}
              disabled={!onUploadPrescription}
              accessibilityRole="button"
              accessibilityLabel="Prescription required. Upload it at checkout."
            >
              <FileText size={ms(16)} color={semantic.warning} strokeWidth={2.3} />
              <View style={styles.rxBannerText}>
                <AppText style={styles.rxTitle}>Prescription required</AppText>
                <AppText style={styles.rxSub}>{onUploadPrescription ? 'Upload Rx at checkout' : 'A pharmacist will verify your Rx'}</AppText>
              </View>
            </TouchableOpacity>
          ) : null}

          {outOfStock ? (
            <View style={styles.availabilityRow}>
              <AlertCircle size={ms(14)} color={semantic.danger} strokeWidth={2.2} />
              <AppText style={styles.outOfStockText}>Out of stock</AppText>
            </View>
          ) : lowStock ? (
            <View style={styles.availabilityRow}>
              <AlertCircle size={ms(14)} color={semantic.warning} strokeWidth={2.2} />
              <AppText style={styles.lowStockText}>Only {stock?.inStockQty} left in stock</AppText>
            </View>
          ) : null}

          {onRetry ? (
            <View style={styles.retryBanner}>
              <AppText style={styles.retryText}>Couldn’t refresh live price and stock.</AppText>
              <TouchableOpacity onPress={onRetry} style={styles.retryBtn} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Retry loading price and stock">
                <RefreshCw size={ms(13)} color={semantic.info} strokeWidth={2.4} />
                <AppText style={styles.retryBtnText}>Retry</AppText>
              </TouchableOpacity>
            </View>
          ) : null}
        </SurfaceCard>

        {/* Offers */}
        {offers.length > 0 ? (
          <SurfaceCard style={styles.sectionGap}>
            <AppText style={styles.sectionLabel}>Offers</AppText>
            <View style={styles.offerList}>
              {offers.map((o) => (
                <View key={o.key} style={styles.offerRow}>
                  <View style={styles.offerIcon}>{o.icon}</View>
                  <View style={styles.offerText}>
                    <AppText style={styles.offerTitle}>{o.title}</AppText>
                    {o.sub ? <AppText style={styles.offerSub}>{o.sub}</AppText> : null}
                  </View>
                </View>
              ))}
            </View>
          </SurfaceCard>
        ) : null}

        {/* Description + highlights */}
        {safeDesc || highlights.length > 0 ? (
          <SurfaceCard style={styles.sectionGap}>
            <AppText style={styles.sectionLabel}>Product details</AppText>
            {safeDesc ? <AppText style={styles.descText}>{safeDesc}</AppText> : null}
            {highlights.length > 0 ? (
              <View style={styles.highlightList}>
                {highlights.map((h) => (
                  <View key={h} style={styles.highlightItem}>
                    <View style={styles.bulletDot} />
                    <AppText style={styles.highlightText}>{h}</AppText>
                  </View>
                ))}
              </View>
            ) : null}
            {ingredients ? (
              <View style={styles.ingredientsBlock}>
                <AppText style={styles.ingredientsLabel}>Ingredients</AppText>
                <AppText style={styles.descText}>{ingredients}</AppText>
              </View>
            ) : null}
          </SurfaceCard>
        ) : null}

        {/* Product information / legal metrology */}
        {hasInfo ? (
          <SurfaceCard style={styles.sectionGap}>
            <TouchableOpacity style={styles.infoHeader} onPress={() => setShowInfo((v) => !v)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={showInfo ? 'Collapse product information' : 'Expand product information'}>
              <AppText style={styles.sectionLabel}>Product information</AppText>
              {showInfo ? <ChevronUp size={ms(16)} color={neutral.inkMuted} /> : <ChevronDown size={ms(16)} color={neutral.inkMuted} />}
            </TouchableOpacity>
            {showInfo ? <View>{infoRows.map(([label, value]) => <InfoRow key={label} label={label} value={value} />)}</View> : null}
          </SurfaceCard>
        ) : null}

        {/* Vendor */}
        {store && product.app !== 'FOOD' ? (
          <SurfaceCard style={styles.sectionGap}>
            <View style={styles.storeInfoRow}>
              <View style={styles.storeLogoContainer}>
                {store.coverImage && !storeImageFailed ? (
                  <Image source={{ uri: store.coverImage }} style={styles.storeCover} resizeMode="cover" onError={() => setStoreImageFailed(true)} />
                ) : (
                  <View style={[styles.storeCover, styles.storeCoverFallback]}>
                    <Package size={ms(24)} color={neutral.inkSubtle} strokeWidth={1.8} />
                  </View>
                )}
              </View>
              <View style={styles.storeDetails}>
                <View style={styles.storeNameRow}>
                  <AppText style={styles.storeName} numberOfLines={1}>{store.name}</AppText>
                  <ShieldCheck size={ms(15)} color={parentRamp.base} fill={semanticTint.info} />
                </View>
                <View style={styles.storeLocationRow}>
                  <MapPin size={ms(13)} color={neutral.inkSubtle} />
                  <AppText style={styles.storeLocationText} numberOfLines={1}>
                    {store.address ? `${store.address.split(',').slice(0, 2).join(',')} · ` : ''}
                    {store.distance} away
                  </AppText>
                </View>
              </View>
              {onViewVendor ? (
                <TouchableOpacity onPress={() => onViewVendor(store.id)} activeOpacity={0.7} accessibilityRole="link">
                  <AppText style={styles.viewVendorLink}>View</AppText>
                </TouchableOpacity>
              ) : null}
            </View>

            {relatedProducts.length > 0 ? (
              <>
                <AppText style={styles.relatedTitle}>Recommended</AppText>
                <AppText style={styles.relatedSubtitle}>
                  {relatedSource === 'personal' ? 'Picked for you' : `More from ${store.name}`}
                </AppText>
                <View style={styles.relatedGrid}>
                  {pricedRelatedProducts.map((p) => {
                    const qty = cartItems.find((i) => i.id === p.id)?.quantity ?? 0;
                    return (
                      <ProductCardBase
                        key={p.id}
                        product={p}
                        appBrand={product.app === 'PHARMA' ? 'PHARMA' : 'MART'}
                        variant="grid2"
                        width={CARD_WIDTH}
                        showDescription
                        nameLines={2}
                        showRating={product.app === 'PHARMA'}
                        showBadge={product.app === 'PHARMA'}
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
            ) : null}
          </SurfaceCard>
        ) : null}

        {/* Recommended when the store context is not available (personalized fallback) */}
        {!store && product.app !== 'FOOD' && pricedRelatedProducts.length > 0 ? (
          <SurfaceCard style={styles.sectionGap}>
            <AppText style={styles.sectionLabel}>Recommended</AppText>
            <AppText style={styles.relatedSubtitle}>Picked for you</AppText>
            <View style={styles.relatedGrid}>
              {pricedRelatedProducts.map((p) => {
                const qty = cartItems.find((i) => i.id === p.id)?.quantity ?? 0;
                return (
                  <ProductCardBase
                    key={p.id}
                    product={p}
                    appBrand={product.app === 'PHARMA' ? 'PHARMA' : 'MART'}
                    variant="grid2"
                    width={CARD_WIDTH}
                    showDescription
                    nameLines={2}
                    showRating={product.app === 'PHARMA'}
                    showBadge={product.app === 'PHARMA'}
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
          </SurfaceCard>
        ) : null}

        {/* Food restaurant */}
        {product.app === 'FOOD' && product.shop ? (
          <SurfaceCard style={styles.sectionGap}>
            <TouchableOpacity style={styles.storeInfoRow} activeOpacity={0.7} onPress={onViewRestaurant} disabled={!onViewRestaurant}>
              <View style={styles.storeLogoContainer}>
                {foodImageFailed || !product.image ? (
                  <View style={[styles.storeCover, styles.storeCoverFallback]}>
                    <Package size={ms(26)} color={neutral.inkSubtle} strokeWidth={1.25} />
                  </View>
                ) : (
                  <Image source={{ uri: product.image }} style={styles.storeCover} resizeMode="cover" onError={() => setFoodImageFailed(true)} />
                )}
              </View>
              <View style={styles.storeDetails}>
                <View style={styles.storeNameRow}>
                  <AppText style={styles.storeName} numberOfLines={1}>{product.shop}</AppText>
                  <ShieldCheck size={ms(15)} color={parentRamp.base} fill={semanticTint.info} />
                </View>
              </View>
              {onViewRestaurant ? <AppText style={styles.viewVendorLink}>View</AppText> : null}
            </TouchableOpacity>
          </SurfaceCard>
        ) : null}

        {/* Food recommended — sibling dishes from the same restaurant menu */}
        {product.app === 'FOOD' && pricedRelatedProducts.length > 0 ? (
          <SurfaceCard style={styles.sectionGap}>
            <AppText style={styles.sectionLabel}>Recommended</AppText>
            <AppText style={styles.relatedSubtitle}>
              {relatedSource === 'personal'
                ? 'Picked for you'
                : `More dishes from ${product.shop ?? 'this restaurant'}`}
            </AppText>
            <View style={styles.relatedGrid}>
              {pricedRelatedProducts.map((p) => (
                <ProductCardBase
                  key={p.id}
                  product={p}
                  appBrand="FOOD"
                  variant="grid2"
                  width={CARD_WIDTH}
                  showDescription
                  originalPrice={p.originalPrice}
                  onPress={onOpenProduct}
                  showAddButton={false}
                />
              ))}
            </View>
          </SurfaceCard>
        ) : null}

        {/* Ratings & reviews */}
        <SurfaceCard style={styles.sectionGap}>
          <AppText style={styles.sectionLabel}>Ratings & Reviews</AppText>
          {ratingCount > 0 ? (
            <View style={styles.ratingSummaryRow}>
              <View style={styles.ratingBig}>
                <AppText style={styles.ratingBigValue}>{ratingAverage.toFixed(1)}</AppText>
                <View style={styles.ratingStarsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} size={ms(12)} color={star <= Math.round(ratingAverage) ? categorical.amber : neutral.border} fill={star <= Math.round(ratingAverage) ? categorical.amber : 'transparent'} strokeWidth={1.5} />
                  ))}
                </View>
                <AppText style={styles.ratingMeta}>{ratingCount} ratings</AppText>
              </View>
              <View style={styles.histogram}>
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = distribution[star - 1] ?? 0;
                  const pct = ratingCount > 0 ? Math.round((count / ratingCount) * 100) : 0;
                  return (
                    <View key={star} style={styles.histogramRow}>
                      <AppText style={styles.histogramStar}>{star}</AppText>
                      <View style={styles.histogramTrack}>
                        <View style={[styles.histogramFill, { width: `${pct}%` }]} />
                      </View>
                      <AppText style={styles.histogramPct}>{pct}%</AppText>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.emptyRating}>
              <AppText style={styles.emptyRatingTitle}>Be the first to rate this product</AppText>
              <View style={styles.tapStars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={onWriteReview}
                    disabled={!onWriteReview}
                    accessibilityRole="button"
                    accessibilityLabel={`Rate ${star} star${star > 1 ? 's' : ''}`}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  >
                    <Star size={ms(26)} color={neutral.border} strokeWidth={1.6} />
                  </TouchableOpacity>
                ))}
              </View>
              <AppText style={styles.emptyRatingSub}>
                {onWriteReview ? 'Tap a star to rate this product' : 'Only verified buyers can rate this product'}
              </AppText>
            </View>
          )}

          {reviews !== undefined && reviews.length > 0 ? (
            <View style={styles.reviewList}>
              {reviews.map((review) => (
                <View key={review.id} style={styles.reviewRow}>
                  <View style={styles.reviewHeader}>
                    <AppText style={styles.reviewer} numberOfLines={1}>{review.user}</AppText>
                    <AppText style={styles.reviewDate}>{review.date}</AppText>
                  </View>
                  <View style={styles.reviewStars}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} size={ms(12)} color={star <= review.rating ? categorical.amber : neutral.border} fill={star <= review.rating ? categorical.amber : 'transparent'} strokeWidth={1.6} />
                    ))}
                  </View>
                  {review.comment ? <AppText style={styles.reviewComment}>{review.comment}</AppText> : null}
                </View>
              ))}
            </View>
          ) : null}

          {onWriteReview ? (
            <TouchableOpacity onPress={onWriteReview} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Write a review" style={styles.writeReviewBtn}>
              <AppText style={styles.writeReviewBtnText}>{ratingCount === 0 ? 'Be the first to review' : 'Write a review'}</AppText>
            </TouchableOpacity>
          ) : null}
        </SurfaceCard>
      </ScrollView>

      {/* Sticky footer: price on the left, one high-contrast CTA on the right */}
      <View style={styles.footer}>
        <View style={styles.footerPriceBlock}>
          <AppText style={styles.footerPrice}>{inr(safePrice)}</AppText>
          {safeOriginal > safePrice ? (
            <View style={styles.footerMrpRow}>
              <AppText style={styles.footerMrp}>{inr(safeOriginal)}</AppText>
              <AppText style={styles.footerDiscount}>{discount}% OFF</AppText>
            </View>
          ) : (
            <AppText style={styles.footerTax}>Inclusive of all taxes</AppText>
          )}
        </View>

        {cartQty === 0 ? (
          outOfStock ? (
            <View style={[styles.footerBtn, styles.ctaDisabled]} accessibilityRole="button" accessibilityState={{ disabled: true }} accessibilityLabel="Out of stock">
              <AppText style={[styles.ctaText, styles.ctaTextDisabled]}>Out of stock</AppText>
            </View>
          ) : (
            <TouchableOpacity onPress={handleAddToCart} style={[styles.footerBtn, { backgroundColor: tokens.btnBg }]} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`Add ${displayName} to cart`}>
              <AppText style={[styles.ctaText, { color: tokens.btnText }]}>Add to Cart</AppText>
            </TouchableOpacity>
          )
        ) : (
          <View style={styles.footerActions}>
            <View style={styles.stepper}>
              <TouchableOpacity onPress={handleDecrement} style={styles.stepBtn} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Decrease quantity">
                <Minus size={ms(16)} strokeWidth={2.5} color={neutral.ink} />
              </TouchableOpacity>
              <AppText style={styles.stepValue}>{cartQty}</AppText>
              <TouchableOpacity onPress={handleIncrement} style={styles.stepBtn} activeOpacity={0.8} disabled={!canAddMore} accessibilityRole="button" accessibilityState={{ disabled: !canAddMore }} accessibilityLabel="Increase quantity">
                <Plus size={ms(16)} strokeWidth={2.5} color={canAddMore ? neutral.ink : neutral.inkSubtle} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={onCart} style={[styles.goToCartBtn, { backgroundColor: tokens.btnBg }]} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Go to cart">
              <ShoppingCart size={ms(16)} color={tokens.btnText} strokeWidth={2.2} />
              <AppText style={[styles.goToCartText, { color: tokens.btnText }]}>Go to Cart</AppText>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: neutral.card },
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: hs(4) },
  headerBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  unavailable: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: hs(32), gap: vs(8) },
  unavailableTitle: { fontSize: ms(16), fontWeight: '600', color: neutral.ink },
  unavailableSub: { fontSize: ms(12), fontWeight: '500', color: neutral.inkSubtle, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: SPACE.LIST_BOTTOM },
  heroCard: { paddingHorizontal: 0, paddingVertical: 0, marginHorizontal: hs(12), marginTop: SPACE.BLOCK, borderRadius: ms(16), overflow: 'hidden' },
  hero: { width: '100%', aspectRatio: 1, backgroundColor: neutral.surface, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroEmojiTile: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: neutral.surface },
  heartBtn: {
    position: 'absolute',
    top: vs(12),
    right: hs(12),
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  dots: { flexDirection: 'row', alignSelf: 'center', gap: hs(6), paddingVertical: vs(10) },
  dot: { width: ms(6), height: ms(6), borderRadius: ms(3), backgroundColor: neutral.border },
  dotActive: { backgroundColor: neutral.ink, width: ms(16) },
  sectionGap: { marginHorizontal: hs(12), marginTop: SPACE.BLOCK },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: hs(8) },
  titleBlock: { flex: 1 },
  brandText: { fontSize: ms(13), color: neutral.inkMuted, fontWeight: '600', marginBottom: vs(2) },
  titleText: { fontSize: ms(20), fontWeight: '600', color: neutral.ink, lineHeight: ms(26) },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: vs(10), gap: hs(8) },
  ratingPill: { backgroundColor: semantic.success, borderRadius: ms(6), paddingVertical: vs(3), paddingHorizontal: hs(8), flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingPillText: { color: neutral.card, fontSize: ms(11), fontWeight: '600' },
  ratingMeta: { fontSize: ms(11), color: neutral.inkSubtle, fontWeight: '600' },
  variantWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: hs(8), marginTop: vs(12) },
  variantChip: { borderWidth: 1, borderColor: neutral.border, borderRadius: ms(10), paddingHorizontal: hs(12), paddingVertical: vs(8), backgroundColor: neutral.card },
  variantChipSelected: { borderColor: neutral.ink, backgroundColor: neutral.surfaceAlt },
  variantLabel: { fontSize: ms(13), fontWeight: '600', color: neutral.ink },
  variantLabelSelected: { color: neutral.ink },
  variantPrice: { fontSize: ms(11), color: neutral.inkSubtle, marginTop: vs(2) },
  singleVariantChip: { alignSelf: 'flex-start', borderWidth: 1, borderColor: neutral.border, borderRadius: ms(10), paddingHorizontal: hs(12), paddingVertical: vs(6), marginTop: vs(12) },
  singleVariantText: { fontSize: ms(12), fontWeight: '600', color: neutral.inkMuted },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: vs(12), gap: hs(8) },
  finalPrice: { fontSize: ms(26), fontWeight: '600', color: neutral.ink },
  mrp: { fontSize: ms(14), color: neutral.inkSubtle, textDecorationLine: 'line-through', fontWeight: '500' },
  discount: { fontSize: ms(14), color: semantic.success, fontWeight: '600' },
  inclTax: { fontSize: ms(11), color: semantic.success, fontWeight: '600', marginTop: vs(3) },
  etaBlock: { gap: vs(6), marginTop: vs(10) },
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: hs(6) },
  etaAddress: { flex: 1, fontSize: ms(11), color: neutral.inkSubtle },
  etaText: { fontSize: ms(12), fontWeight: '600', color: neutral.inkMuted },
  rxBanner: { flexDirection: 'row', alignItems: 'center', gap: hs(8), marginTop: SPACE.BLOCK, padding: hs(12), borderRadius: ms(12), backgroundColor: semanticTint.warning },
  rxBannerText: { flex: 1 },
  rxTitle: { fontSize: ms(13), fontWeight: '600', color: semantic.warning },
  rxSub: { fontSize: ms(11), color: neutral.inkMuted, marginTop: vs(2) },
  availabilityRow: { flexDirection: 'row', alignItems: 'center', gap: hs(6), marginTop: vs(10) },
  outOfStockText: { fontSize: ms(12), fontWeight: '600', color: semantic.danger },
  lowStockText: { fontSize: ms(12), fontWeight: '600', color: semantic.warning },
  retryBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: hs(10), marginTop: SPACE.BLOCK, paddingVertical: vs(10), paddingHorizontal: hs(12), borderRadius: ms(12), backgroundColor: semanticTint.warning },
  retryText: { flexShrink: 1, fontSize: ms(12), fontWeight: '500', color: neutral.ink },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: hs(4), paddingVertical: vs(4), paddingHorizontal: hs(8), borderRadius: ms(8), backgroundColor: neutral.card },
  retryBtnText: { fontSize: ms(12), fontWeight: '600', color: semantic.info },
  sectionLabel: { fontSize: ms(14), fontWeight: '600', color: neutral.ink, marginBottom: vs(8) },
  offerList: { gap: vs(10) },
  offerRow: { flexDirection: 'row', gap: hs(10), alignItems: 'flex-start' },
  offerIcon: { width: ms(26), height: ms(26), borderRadius: ms(13), backgroundColor: neutral.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  offerText: { flex: 1 },
  offerTitle: { fontSize: ms(13), fontWeight: '600', color: neutral.ink },
  offerSub: { fontSize: ms(11), color: neutral.inkSubtle, marginTop: vs(2) },
  descText: { fontSize: ms(13), color: neutral.inkMuted, fontWeight: '400', lineHeight: ms(19) },
  highlightList: { marginTop: vs(10), gap: vs(7) },
  highlightItem: { flexDirection: 'row', alignItems: 'center', gap: hs(8) },
  bulletDot: { width: ms(6), height: ms(6), borderRadius: ms(3), backgroundColor: semantic.success },
  highlightText: { fontSize: ms(12), color: neutral.inkMuted, fontWeight: '500', flex: 1 },
  ingredientsBlock: { marginTop: SPACE.BLOCK },
  ingredientsLabel: { fontSize: ms(12), fontWeight: '600', color: neutral.ink, marginBottom: vs(4) },
  infoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: hs(12), paddingVertical: vs(8), borderTopWidth: 1, borderTopColor: neutral.surfaceAlt },
  infoLabel: { flex: 1, fontSize: ms(12), color: neutral.inkSubtle },
  infoValue: { flex: 1.4, fontSize: ms(12), color: neutral.ink, textAlign: 'right' },
  storeInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: hs(10) },
  storeLogoContainer: { position: 'relative' },
  storeCover: { width: ms(48), height: ms(48), borderRadius: ms(10), borderWidth: 1, borderColor: neutral.border },
  storeCoverFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: neutral.surfaceAlt },
  storeDetails: { flex: 1 },
  storeNameRow: { flexDirection: 'row', alignItems: 'center', gap: hs(4) },
  storeName: { fontSize: ms(15), fontWeight: '600', color: neutral.ink, flexShrink: 1 },
  storeLocationRow: { flexDirection: 'row', alignItems: 'center', marginTop: vs(4) },
  storeLocationText: { fontSize: ms(11), color: neutral.inkMuted, marginLeft: hs(4), flexShrink: 1 },
  viewVendorLink: { fontSize: ms(12), fontWeight: '600', color: semantic.info, paddingVertical: vs(4), paddingHorizontal: hs(4) },
  relatedTitle: { fontSize: ms(13), fontWeight: '600', color: neutral.ink, marginTop: SPACE.BLOCK, marginBottom: SPACE.BLOCK },
  relatedSubtitle: { fontSize: ms(11), color: neutral.inkSubtle, marginTop: -SPACE.BLOCK / 2, marginBottom: SPACE.BLOCK },
  relatedGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%' },
  ratingSummaryRow: { flexDirection: 'row', gap: hs(16), alignItems: 'center' },
  ratingBig: { width: ms(84), alignItems: 'center' },
  ratingBigValue: { fontSize: ms(30), fontWeight: '600', color: neutral.ink },
  ratingStarsRow: { flexDirection: 'row', gap: 2, marginTop: vs(2) },
  histogram: { flex: 1, gap: vs(4) },
  histogramRow: { flexDirection: 'row', alignItems: 'center', gap: hs(6) },
  histogramStar: { width: ms(10), fontSize: ms(11), color: neutral.inkSubtle, fontWeight: '600' },
  histogramTrack: { flex: 1, height: ms(6), borderRadius: ms(3), backgroundColor: neutral.surfaceAlt, overflow: 'hidden' },
  histogramFill: { height: '100%', borderRadius: ms(3), backgroundColor: semantic.success },
  histogramPct: { width: ms(34), fontSize: ms(11), color: neutral.inkSubtle, textAlign: 'right' },
  emptyRating: { alignItems: 'center', paddingVertical: SPACE.BLOCK },
  emptyRatingTitle: { fontSize: ms(13), fontWeight: '600', color: neutral.ink },
  tapStars: { flexDirection: 'row', gap: hs(6), marginTop: vs(8) },
  emptyRatingSub: { fontSize: ms(11), color: neutral.inkSubtle, marginTop: vs(6), textAlign: 'center' },
  reviewList: { gap: SPACE.SECTION, marginTop: SPACE.BLOCK },
  reviewRow: { borderTopWidth: 1, borderTopColor: neutral.surfaceAlt, paddingTop: SPACE.BLOCK },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: hs(8) },
  reviewer: { flexShrink: 1, fontSize: ms(13), fontWeight: '600', color: neutral.ink },
  reviewDate: { marginLeft: 'auto', fontSize: ms(11), color: neutral.inkSubtle },
  reviewStars: { flexDirection: 'row', alignItems: 'center', gap: hs(2), marginTop: vs(4) },
  reviewComment: { marginTop: vs(6), fontSize: ms(13), color: neutral.inkMuted, lineHeight: ms(19) },
  writeReviewBtn: { alignSelf: 'flex-start', marginTop: SPACE.BLOCK, paddingVertical: vs(9), paddingHorizontal: hs(14), borderRadius: ms(10), borderWidth: 1, borderColor: semantic.success },
  writeReviewBtnText: { fontSize: ms(13), fontWeight: '600', color: semantic.success },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(12),
    paddingHorizontal: hs(16),
    paddingTop: vs(10),
    paddingBottom: vs(8),
    backgroundColor: neutral.card,
    borderTopWidth: 1,
    borderTopColor: neutral.surfaceAlt,
  },
  footerPriceBlock: { flex: 1 },
  footerPrice: { fontSize: ms(22), fontWeight: '600', color: neutral.ink },
  footerMrpRow: { flexDirection: 'row', alignItems: 'center', gap: hs(6), marginTop: vs(2) },
  footerMrp: { fontSize: ms(12), color: neutral.inkSubtle, textDecorationLine: 'line-through' },
  footerDiscount: { fontSize: ms(11), fontWeight: '600', color: semantic.success },
  footerTax: { fontSize: ms(11), color: semantic.success, fontWeight: '600', marginTop: vs(2) },
  footerBtn: { flex: 1.2, height: Math.max(48, vs(48)), borderRadius: ms(14), alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: ms(15), fontWeight: '600' },
  ctaDisabled: { backgroundColor: neutral.surfaceAlt },
  ctaTextDisabled: { color: neutral.inkSubtle },
  footerActions: { flex: 1.6, flexDirection: 'row', alignItems: 'center', gap: hs(8) },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: neutral.surfaceAlt, borderRadius: ms(14), padding: vs(3), minWidth: hs(108) },
  stepBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: neutral.card, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontSize: ms(15), fontWeight: '600', color: neutral.ink, minWidth: ms(24), textAlign: 'center' },
  goToCartBtn: { flex: 1, flexDirection: 'row', gap: hs(6), height: Math.max(48, vs(48)), borderRadius: ms(14), alignItems: 'center', justifyContent: 'center' },
  goToCartText: { fontSize: ms(14), fontWeight: '600' },
});
