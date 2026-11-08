import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Search, ChevronLeft,
  ClipboardList, CloudOff, Pill, Receipt, FileText,
} from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import PharmaProductCard from '@/features/pharma/cards/PharmaProductCard';
import AppTextInput from '@/components/AppTextInput';
import AppText from '@/components/AppText';
import { PHARMA_PRODUCTS_DB } from '@data/pharma/products';
import type { Product, StoreProfile } from '@data/types';
import type { PharmaDBItem } from '@data/pharma/products';
import { PHARMA_RECENT_ORDERS } from '@data/pharma/recentOrders';
import type { PharmaRecentOrder } from '@data/pharma/recentOrders';
import type { RootStackParamList } from '@/navigation/types';

import type { PharmaPopularMedicine, PharmaQuickReorderItem } from './mocks/pharmaHomeFeed';
import { quickReorderToProduct } from './mocks/pharmaHomeFeed';

import PharmaHeroBanner from './components/pharma-home/PharmaHeroBanner';
import CampaignHero from '@/components/shared/CampaignHero';
import { openHeroTarget } from '@/services/adsTarget';
import { gateway, type HeroAd, type ProductView } from '@/services/api/GatewayClient';
import { effectivePrice, useActiveDiscounts, withActiveDiscounts } from '@/services/pricing';
import QuickReorderRail from './components/pharma-home/QuickReorderRail';
import TopOffersRail from './components/pharma-home/TopOffersRail';
import PopularMedicinesRail from './components/pharma-home/PopularMedicinesRail';
import HealthEssentialsRail from './components/pharma-home/HealthEssentialsRail';
import FeaturedBrandsRail from './components/pharma-home/FeaturedBrandsRail';
import HealthCornerRail from './components/pharma-home/HealthCornerRail';
import LocalMedicalsRail from './components/pharma-home/LocalMedicalsRail';
import UploadPrescriptionFAB from './components/pharma-home/UploadPrescriptionFAB';
import { usePharmaFeed } from './hooks/usePharmaFeed';
import { usePharmaStores } from './hooks/usePharmaStores';
import PharmaHomeSkeleton from './components/skeletons/PharmaHomeSkeleton';
import { DonorDashboard } from './blood-donor/DonorDashboard';
import { useOrdersStore, type PlacedOrder } from '@/state/ordersStore';
import { brandRamp } from '@/theme/brandTokens';
import { neutral, semantic } from '@/theme/brandTokens';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "12 Aug 2026" without Hermes' optional Intl (locale-independent, bounded). */
function formatPlacedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** A real checkout/Rx order relevant to Pharma (contains a ph-* line, or a prescription order). */
function isPharmaOrder(o: PlacedOrder): boolean {
  if (o.kind === 'prescription') return true;
  return (o.items ?? []).some((i) => i.id.startsWith('ph-'));
}

/**
 * Overlay the authoritative batch row onto an authored category card. `/products/batch` is a slim
 * projection (no desc/attributes), so authored copy (desc/bullets) is preserved while money, stock
 * signals, rating and imagery come from the server.
 */
function overlayCategoryProduct(authored: PharmaDBItem, row: ProductView): PharmaDBItem {
  return {
    ...authored,
    category: row.category || authored.category,
    name: row.name || authored.name,
    price: row.price,
    originalPrice: row.originalPrice ?? null,
    discountBadge: row.badge ?? null,
    rating: row.rating,
    reviewsCount: row.reviewsCount ?? authored.reviewsCount,
    image: row.image || authored.image,
    emoji: row.emoji || authored.emoji,
  };
}

interface PharmaScreenProps {
  addToCart?: (id: string, name: string, price: number, emoji: string) => void;
  cartItems?: { id: string; name: string; price: number; quantity: number; emoji: string }[];
  setCartItems?: React.Dispatch<React.SetStateAction<{ id: string; name: string; price: number; quantity: number; emoji: string }[]>>;
  updateCartQuantity?: (id: string, delta: number) => void;
  onProductClick?: (product: any) => void;
  onSearchPress?: (query?: string) => void;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  searchQuery?: string;
}

export function PharmaScreen({
  addToCart,
  cartItems,
  setCartItems,
  updateCartQuantity,
  onProductClick,
  onSearchPress,
  activeTab,
  setActiveTab,
  searchQuery = '',
}: PharmaScreenProps) {
  const [currentView, setCurrentView] = useState<'HOME' | 'CATEGORY_PRODUCTS'>('HOME');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [addedAnimationId, setAddedAnimationId] = useState<string | null>(null);
  const [feedAddedIds, setFeedAddedIds] = useState<Set<string>>(new Set());
  const [categorySource, setCategorySource] = useState<'idle' | 'loading' | 'live' | 'error'>('idle');
  const [categoryServerById, setCategoryServerById] = useState<Record<string, ProductView> | null>(null);
  const [categoryReloadNonce, setCategoryReloadNonce] = useState(0);

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const feed = usePharmaFeed();
  const { stores, source: storesSource } = usePharmaStores();

  // History tab: real orders (in-session + durable `GET /orders`) filtered to Pharma, newest first.
  // The `@data` fixture is only a mock-mode stand-in so an offline demo never blanks.
  const sessionOrders = useOrdersStore((s) => s.orders);
  const serverOrders = useOrdersStore((s) => s.serverOrders);
  const historyOrders = useMemo(() => {
    const byId = new Map<string, PlacedOrder>();
    for (const o of sessionOrders) byId.set(o.orderId, o);
    for (const o of serverOrders) byId.set(o.orderId, o); // durable history wins on a shared id
    return [...byId.values()]
      .filter(isPharmaOrder)
      .sort((a, b) => Date.parse(b.placedAt) - Date.parse(a.placedAt));
  }, [sessionOrders, serverOrders]);
  const showFixtureHistory = historyOrders.length === 0 && !gateway.remoteEnabled;

  // Approved festival discounts for the active category (server authority: `GET /promo/active-discounts`).
  // The inline category grid + in-screen PDP use the authored `PHARMA_PRODUCTS_DB` rows, so the
  // shopper price must be overlaid here too — otherwise the shown price would diverge from the price
  // `internal/checkout` settles through `contracts.DiscountReader`.
  const categoryProductIds = useMemo(
    () => PHARMA_PRODUCTS_DB.filter(p => p.category === selectedCategoryId).map(p => p.id),
    [selectedCategoryId],
  );

  // The authored `ph-*` list is curation (ids + copy); the gateway batch is the price/rating/
  // availability authority. Online: never render authored prices while the batch is in flight or
  // after it answers (delisted ids drop out). Offline/HTTP error: authored rows keep the grid usable.
  useEffect(() => {
    if (!selectedCategoryId || categoryProductIds.length === 0) {
      setCategoryServerById(null);
      setCategorySource('idle');
      return;
    }
    let active = true;
    setCategoryServerById(null);
    setCategorySource('loading');
    gateway
      .getProductsByIds(categoryProductIds)
      .then((rows) => {
        if (!active) return;
        setCategoryServerById(Object.fromEntries(rows.map((row) => [row.id, row])));
        setCategorySource('live');
      })
      .catch(() => {
        if (!active) return;
        setCategoryServerById(null);
        setCategorySource('error');
      });
    return () => {
      active = false;
    };
  }, [selectedCategoryId, categoryProductIds, categoryReloadNonce]);
  const categoryDiscounts = useActiveDiscounts(categoryProductIds);
  const discountFor = (id: string) => categoryDiscounts[id]?.discountPercent ?? 0;
  const displayPrice = (p: { id: string; price: number }) => effectivePrice(p.price, discountFor(p.id));
  const displayBadge = (id: string, authored: string | null) => {
    const percent = discountFor(id);
    return percent > 0 ? `${percent}% OFF` : authored ?? undefined;
  };
  const displayOriginal = (p: PharmaDBItem) => {
    const eff = displayPrice(p);
    if (p.originalPrice && p.originalPrice > eff) return p.originalPrice;
    return eff < p.price ? p.price : undefined;
  };

  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (addedTimer.current) clearTimeout(addedTimer.current);
    },
    [],
  );

  const handleAddWithFeedback = (id: string, name: string, price: number, emoji: string) => {
    if (addToCart) addToCart(id, name, price, emoji);
    setAddedAnimationId(id);
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAddedAnimationId(null), 1200);
  };

  const goBack = () => {
    setCurrentView('HOME');
  };

  const homeSearchNormalized = searchQuery.trim().toLowerCase();

  // Header search is server-backed (FTS on the gateway, local catalog mirror offline) with approved
  // festival discounts overlaid — the same pipeline as Mart and the first-class Search route, so the
  // header never shows a fixture-only result set divergent from the Search tab.
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchError, setSearchError] = useState(false);
  useEffect(() => {
    if (!homeSearchNormalized) {
      setSearchResults([]);
      setSearchError(false);
      return;
    }
    let active = true;
    setSearchError(false);
    gateway
      .searchProducts(searchQuery.trim(), 'PHARMA')
      .then((rows) => withActiveDiscounts(rows))
      .then((rows) => {
        if (active) setSearchResults(rows);
      })
      .catch(() => {
        if (active) {
          setSearchResults([]);
          setSearchError(true);
        }
      });
    return () => {
      active = false;
    };
  }, [homeSearchNormalized, searchQuery]);

  const searchedProducts = homeSearchNormalized ? searchResults : [];

  const filteredCategoryProducts = useMemo(() => {
    const q = categorySearchQuery.trim().toLowerCase();
    const authored = PHARMA_PRODUCTS_DB.filter(
      (p) => p.category === selectedCategoryId && (q === '' || p.name.toLowerCase().includes(q)),
    );
    if (categorySource === 'live' && categoryServerById) {
      return authored.flatMap((p) => {
        const row = categoryServerById[p.id];
        return row ? [overlayCategoryProduct(p, row)] : [];
      });
    }
    // Authored rows are the explicit offline shell only. Online, a failed read shows an honest
    // error/empty — never authored prices pretending to be live.
    if (!gateway.remoteEnabled) return authored;
    return [];
  }, [selectedCategoryId, categorySearchQuery, categorySource, categoryServerById]);

  const handleFeedAdd = (item: PharmaQuickReorderItem | PharmaPopularMedicine) => {
    if (addToCart) addToCart(item.id, item.name, item.price, 'pharma');
    setFeedAddedIds(prev => new Set(prev).add(item.id));
  };

  const handlePopularPress = (item: PharmaPopularMedicine) => {
    onProductClick?.({
      id: item.id,
      name: item.name,
      price: item.price,
      emoji: 'pharma',
      image: item.imageUrl,
      desc: item.details,
      rating: item.rating,
      app: 'PHARMA',
      category: 'medicine',
    });
  };

  const handleQuickReorderPress = (item: PharmaQuickReorderItem) => {
    onProductClick?.(quickReorderToProduct(item));
  };

  const handleHealthEssentialPress = (item: { title: string }) => {
    onSearchPress?.(item.title);
  };

  const handleFeaturedBrandPress = (item: { name: string }) => {
    onSearchPress?.(item.name);
  };

  const handleMedicalPress = (store: StoreProfile) => {
    navigation.navigate('MedicalShopDetails', { storeId: store.id });
  };

  /** Paid PHARMA_HERO tap-through — product → PDP, store → medical shop. */
  const handlePharmaHeroPress = (ad: HeroAd) => {
    void openHeroTarget(ad, {
      onProduct: (product) => {
        if (onProductClick) onProductClick(product);
        else navigation.navigate('ProductDetail', { product });
      },
      onStore: (store) => navigation.navigate('MedicalShopDetails', { storeId: store.id }),
      onVenue: (store) => navigation.navigate('MedicalShopDetails', { storeId: store.id }),
    });
  };

  const searchView = (
    <View style={styles.searchContainer}>
      <View style={styles.searchHeaderRow}>
        <AppText style={styles.searchTitle}>Search Results</AppText>
        <AppText style={styles.searchCount}>{searchedProducts.length} items</AppText>
      </View>
      {searchedProducts.length === 0 ? (
        <View style={styles.emptyWrap}>
          <AppText style={styles.emptyText}>
            {searchError
              ? 'Could not reach search. Check your connection and try again.'
              : `No medicines found for "${searchQuery}"`}
          </AppText>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.searchContent}
        >
          <View style={styles.productsGrid}>
            {searchedProducts.map(product => {
              const qty = cartItems?.find(i => i.id === product.id)?.quantity ?? 0;
              return (
                <PharmaProductCard
                  key={product.id}
                  product={product}
                  quantity={qty}
                  isAdded={qty > 0}
                  onPress={() => onProductClick && onProductClick(product)}
                  onAdd={() => addToCart && addToCart(product.id, product.name, product.price, product.emoji)}
                  onIncrement={() => updateCartQuantity && updateCartQuantity(product.id, 1)}
                  onDecrement={() => updateCartQuantity && updateCartQuantity(product.id, -1)}
                />
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );

  const feedView = feed ? (
    <View style={styles.feedWrap}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        <CampaignHero placement="PHARMA_HERO" app="PHARMA" onPress={handlePharmaHeroPress} />
        <PharmaHeroBanner
          banner={feed.heroBanners[0]}
          couponCode={feed.heroCouponCode}
          onOrderNow={() => { setSelectedCategoryId('vitamin'); setCurrentView('CATEGORY_PRODUCTS'); }}
        />
        <QuickReorderRail
          items={feed.quickReorder}
          onPress={handleQuickReorderPress}
          onAdd={handleFeedAdd}
        />
        {feed.topOffers.length > 0 ? (
          <TopOffersRail offers={feed.topOffers} />
        ) : null}
        <PopularMedicinesRail
          items={feed.popularMedicines}
          addedIds={feedAddedIds}
          onPress={handlePopularPress}
          onAdd={handleFeedAdd}
        />
        <HealthEssentialsRail
          items={feed.healthEssentials}
          onPress={handleHealthEssentialPress}
        />
        <FeaturedBrandsRail
          brands={feed.featuredBrands}
          onPress={handleFeaturedBrandPress}
        />
        <HealthCornerRail items={feed.healthCorner} />
        {storesSource !== 'live' ? (
          <View style={styles.offlineChip}>
            <CloudOff size={ms(13)} color="#64748b" strokeWidth={2.2} />
            <AppText style={styles.offlineChipText}>
              {storesSource === 'empty-authoritative'
                ? 'No pharmacies are listed near you yet'
                : 'Could not load pharmacies — check your connection'}
            </AppText>
          </View>
        ) : null}
        <LocalMedicalsRail stores={stores} onMedicalPress={handleMedicalPress} />
      </ScrollView>
      <UploadPrescriptionFAB onPress={() => navigation.navigate('PrescriptionFlow')} />
    </View>
  ) : (
    <PharmaHomeSkeleton />
  );

  const categoryProductsView = (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack} activeOpacity={0.8}>
          <ChevronLeft size={ms(16)} color="#0f172a" strokeWidth={3} />
        </TouchableOpacity>
        <AppText style={styles.topTitle}>CATEGORIES</AppText>
        <View style={{ width: ms(32) }} />
      </View>

      <View style={styles.searchFilter}>
        <Search size={ms(15)} color="#94a3b8" strokeWidth={2.5} />
        <AppTextInput
          style={styles.searchFilterInput}
          placeholder="Search products..."
          placeholderTextColor="#94a3b8"
          value={categorySearchQuery}
          onChangeText={setCategorySearchQuery}
        />
      </View>

      {categorySource === 'loading' ? (
        <View style={styles.categoryLoading}>
          <ActivityIndicator color={brandRamp.PHARMA.deep} />
        </View>
      ) : categorySource === 'error' ? (
        <View style={styles.emptyStateCard}>
          <CloudOff size={ms(36)} color={brandRamp.PHARMA.deep} strokeWidth={1.5} style={styles.emptyStateIcon} />
          <AppText style={styles.emptyStateTitle}>Could not load products</AppText>
          <TouchableOpacity
            onPress={() => setCategoryReloadNonce((n) => n + 1)}
            activeOpacity={0.8}
            accessibilityRole="button"
            style={{ marginTop: vs(10) }}
          >
            <AppText style={{ fontSize: ms(12), fontWeight: '700', color: brandRamp.PHARMA.deep }}>
              Try again
            </AppText>
          </TouchableOpacity>
        </View>
      ) : filteredCategoryProducts.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <Pill size={ms(36)} color={brandRamp.PHARMA.deep} strokeWidth={1.5} style={styles.emptyStateIcon} />
          <AppText style={styles.emptyStateTitle}>No products found</AppText>
        </View>
      ) : (
        <View style={styles.catProductsGrid}>
          {filteredCategoryProducts.map(product => {
            const cardProduct = {
              id: product.id,
              name: product.name,
              price: displayPrice(product),
              emoji: product.emoji,
              image: product.image,
              desc: product.desc,
              rating: product.rating,
              app: 'PHARMA' as const,
              category: product.category,
              badge: displayBadge(product.id, product.discountBadge),
            };
            return (
              <PharmaProductCard
                key={product.id}
                product={cardProduct}
                originalPrice={displayOriginal(product)}
                isAdded={addedAnimationId === product.id}
                onPress={() => onProductClick?.(cardProduct)}
                onAdd={() => handleAddWithFeedback(product.id, product.name, displayPrice(product), product.emoji)}
              />
            );
          })}
        </View>
      )}
      <View style={{ height: vs(24) }} />
    </ScrollView>
  );

  const historyView = (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.historyHeader}>
        <ClipboardList size={ms(18)} color={brandRamp.PHARMA.deep} strokeWidth={2} />
        <AppText style={styles.historyTitle}>Recently Ordered</AppText>
        <AppText style={styles.historySubtitle}>Your latest medicine orders</AppText>
      </View>

      {historyOrders.map((order) => {
        const rx = order.kind === 'prescription';
        const firstLine = order.items?.find((i) => i.id.startsWith('ph-')) ?? order.items?.[0];
        const name = rx ? 'Prescription order' : firstLine?.name ?? order.vendorName;
        const qty = rx
          ? `${order.pages ?? 0} page${order.pages === 1 ? '' : 's'}`
          : `${firstLine?.quantity ?? 1}×`;
        return (
          <TouchableOpacity
            key={order.orderId}
            style={styles.historyCard}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('MyOrders', { highlightOrderId: order.orderId })}
          >
            <View style={styles.historyRow}>
              <View style={styles.historyOrderIcon}>
                {rx ? (
                  <FileText size={ms(20)} color={brandRamp.PHARMA.deep} strokeWidth={1.5} />
                ) : (
                  <Pill size={ms(20)} color={brandRamp.PHARMA.deep} strokeWidth={1.5} />
                )}
              </View>
              <View style={styles.historyOrderDetails}>
                <AppText style={styles.historyOrderName} numberOfLines={1}>
                  {name}
                </AppText>
                <AppText style={styles.historyMetaText}>
                  {qty} · {order.orderId} · {formatPlacedDate(order.placedAt)}
                </AppText>
              </View>
              <View style={styles.historyOrderRight}>
                <AppText style={styles.historyOrderAmount}>₹{order.total}</AppText>
                <View
                  style={[
                    styles.historyStatusPill,
                    order.status === 'Delivered' ? styles.historyStatusDelivered : styles.historyStatusShipped,
                  ]}
                >
                  <AppText style={styles.historyStatusText}>{order.status}</AppText>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}

      {showFixtureHistory
        ? PHARMA_RECENT_ORDERS.map((order) => (
            <View key={order.id} style={styles.historyCard}>
              <View style={styles.historyRow}>
                <View style={styles.historyOrderIcon}>
                  <Pill size={ms(20)} color={brandRamp.PHARMA.deep} strokeWidth={1.5} />
                </View>
                <View style={styles.historyOrderDetails}>
                  <AppText style={styles.historyOrderName} numberOfLines={1}>
                    {order.name}
                  </AppText>
                  <AppText style={styles.historyMetaText}>
                    {order.qty} · {order.orderId} · {order.date}
                  </AppText>
                </View>
                <View style={styles.historyOrderRight}>
                  <AppText style={styles.historyOrderAmount}>₹{order.amount}</AppText>
                  <View
                    style={[
                      styles.historyStatusPill,
                      order.status === 'Delivered' ? styles.historyStatusDelivered : styles.historyStatusShipped,
                    ]}
                  >
                    <AppText style={styles.historyStatusText}>{order.status}</AppText>
                  </View>
                </View>
              </View>
            </View>
          ))
        : null}

      {!showFixtureHistory && historyOrders.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <Receipt size={ms(36)} color={brandRamp.PHARMA.deep} strokeWidth={1.5} style={styles.emptyStateIcon} />
          <AppText style={styles.emptyStateTitle}>No pharmacy orders yet</AppText>
        </View>
      ) : null}

      <View style={styles.historyDirectiveBox}>
        <AppText style={styles.historyDirectiveText}>
          {!showFixtureHistory && historyOrders.length === 0
            ? 'Your medicine and prescription orders will appear here once you place one.'
            : 'Reorder medicines you use regularly for faster checkout next time.'}
        </AppText>
      </View>

      <View style={{ height: vs(24) }} />
    </ScrollView>
  );

  if (activeTab === 'History') return historyView;
  if (activeTab === 'Donor') return <DonorDashboard />;
  switch (currentView) {
    case 'HOME':
      return homeSearchNormalized ? searchView : feedView;
    case 'CATEGORY_PRODUCTS': return categoryProductsView;
    default: return feedView;
  }
}

const styles = StyleSheet.create({
  feedWrap: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  offlineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
    alignSelf: 'flex-start',
    marginHorizontal: hs(16),
    marginBottom: vs(8),
    backgroundColor: '#F1F5F9',
    borderRadius: ms(999),
    paddingHorizontal: hs(10),
    paddingVertical: vs(5),
  },
  offlineChipText: {
    fontSize: ms(10.5),
    fontWeight: '700',
    color: '#64748b',
  },
  searchContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  searchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingTop: vs(12),
    paddingBottom: vs(10),
  },
  searchTitle: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#1E2022',
  },
  searchCount: {
    fontSize: ms(10),
    fontWeight: '600',
    color: '#94a3b8',
  },
  searchContent: {
    paddingHorizontal: hs(16),
    paddingBottom: SPACE.SECTION,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emptyWrap: {
    paddingTop: vs(60),
    alignItems: 'center',
  },
  emptyText: {
    fontSize: ms(13),
    fontWeight: '600',
    color: neutral.inkMuted,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: hs(20),
    marginBottom: vs(12),
  },
  sectionTitle: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#0f172a',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingTop: vs(12),
    paddingBottom: vs(8),
  },  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  topTitle: {
    fontSize: ms(13),
    fontWeight: '600',
    color: '#0f172a',
  },
  searchFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: ms(12),
    marginHorizontal: hs(16),
    paddingHorizontal: hs(12),
    height: 44,
    gap: hs(6),
    marginBottom: vs(12),
  },
  searchFilterInput: {
    flex: 1,
    fontSize: ms(12),
    color: '#0f172a',
    fontWeight: '600',
    padding: 0,
  },
  catProductsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: hs(16),
    gap: hs(12),
  },
  categoryLoading: {
    paddingVertical: vs(60),
    alignItems: 'center',
  },
  emptyStateCard: {
    marginHorizontal: hs(20),
    backgroundColor: '#ffffff',
    borderRadius: ms(20),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: hs(40),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  emptyStateEmoji: {
    fontSize: ms(32),
    marginBottom: vs(8),
  },
  emptyStateIcon: {
    marginBottom: vs(8),
  },
  emptyStateTitle: {
    fontSize: ms(12),
    fontWeight: '900',
    color: '#64748b',
  },
  historyHeader: {
    paddingHorizontal: hs(20),
    paddingTop: vs(16),
    paddingBottom: vs(12),
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: hs(8),
  },
  historyTitle: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#0f172a',
  },
  historySubtitle: {
    fontSize: ms(9.5),
    fontWeight: '600',
    color: '#94a3b8',
    width: '100%',
    marginTop: vs(4),
  },
  historyCard: {
    marginHorizontal: hs(20),
    backgroundColor: '#ffffff',
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: hs(16),
    marginBottom: vs(12),
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(12),
  },
  historyOrderIcon: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(12),
    backgroundColor: '#FFF0E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyOrderEmoji: {
    fontSize: ms(18),
  },
  historyOrderDetails: {
    flex: 1,
    gap: vs(2),
  },
  historyOrderName: {
    fontSize: ms(12),
    fontWeight: '900',
    color: '#0f172a',
  },
  historyMetaText: {
    fontSize: ms(9),
    fontWeight: '600',
    color: '#64748b',
  },
  historyOrderRight: {
    alignItems: 'flex-end',
    gap: vs(4),
  },
  historyOrderAmount: {
    fontSize: ms(13),
    fontWeight: '900',
    color: '#0f172a',
  },
  historyStatusPill: {
    paddingVertical: vs(2),
    paddingHorizontal: hs(8),
    borderRadius: ms(6),
  },
  historyStatusDelivered: {
    backgroundColor: '#DCFCE7',
  },
  historyStatusShipped: {
    backgroundColor: '#FEF3C7',
  },
  historyStatusText: {
    fontSize: ms(8),
    fontWeight: '900',
    color: brandRamp.PHARMA.deep,
  },
  historyDirectiveBox: {
    marginHorizontal: hs(20),
    backgroundColor: '#f8fafc',
    borderRadius: ms(12),
    padding: hs(14),
    marginBottom: vs(12),
  },
  historyDirectiveText: {
    fontSize: ms(9),
    fontWeight: '600',
    color: '#94a3b8',
    lineHeight: vs(13),
  },
});
