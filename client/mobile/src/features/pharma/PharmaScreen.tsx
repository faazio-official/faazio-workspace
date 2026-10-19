import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, ScrollView, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Heart, CheckCircle, Search, ChevronLeft,
  Star, Minus, Plus, ClipboardList, CloudOff,
} from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { hs, vs, ms, SCREEN_W } from '@/utils/responsive';
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
import { gateway, type HeroAd } from '@/services/api/GatewayClient';
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
  const [currentView, setCurrentView] = useState<'HOME' | 'CATEGORY_PRODUCTS' | 'PRODUCT_DETAIL'>('HOME');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<PharmaDBItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [addedAnimationId, setAddedAnimationId] = useState<string | null>(null);
  const [feedAddedIds, setFeedAddedIds] = useState<Set<string>>(new Set());
  const [localFavorites, setLocalFavorites] = useState<string[]>(['ph-t1', 'ph-f1']);

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

  const toggleLocalFavorite = (id: string) => {
    setLocalFavorites(prev =>
      prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
  };

  const handleAddWithFeedback = (id: string, name: string, price: number, emoji: string) => {
    if (addToCart) addToCart(id, name, price, emoji);
    setAddedAnimationId(id);
    setTimeout(() => setAddedAnimationId(null), 1200);
  };

  const handleAddMultipleToCart = (product: PharmaDBItem, qty: number) => {
    const unit = effectivePrice(product.price, discountFor(product.id));
    if (setCartItems) {
      setCartItems((prev: any) => {
        const existing = prev.find((item: any) => item.id === product.id);
        if (existing) {
          return prev.map((item: any) =>
            item.id === product.id ? { ...item, quantity: item.quantity + qty } : item
          );
        }
        return [...prev, { id: product.id, name: product.name, price: unit, quantity: qty, emoji: product.emoji }];
      });
    } else if (addToCart) {
      for (let i = 0; i < qty; i++) {
        addToCart(product.id, product.name, unit, product.emoji);
      }
    }
  };

  const goBack = () => {
    if (currentView === 'PRODUCT_DETAIL') {
      setCurrentView(selectedCategoryId ? 'CATEGORY_PRODUCTS' : 'HOME');
    } else {
      setCurrentView('HOME');
    }
  };

  const homeSearchNormalized = searchQuery.trim().toLowerCase();

  // Header search is server-backed (FTS on the gateway, local catalog mirror offline) with approved
  // festival discounts overlaid — the same pipeline as Mart and the first-class Search route, so the
  // header never shows a fixture-only result set divergent from the Search tab.
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  useEffect(() => {
    if (!homeSearchNormalized) {
      setSearchResults([]);
      return;
    }
    let active = true;
    gateway
      .searchProducts(searchQuery.trim(), 'PHARMA')
      .then((rows) => withActiveDiscounts(rows))
      .then((rows) => {
        if (active) setSearchResults(rows);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [homeSearchNormalized, searchQuery]);

  const searchedProducts = homeSearchNormalized ? searchResults : [];

  const filteredCategoryProducts = PHARMA_PRODUCTS_DB.filter(p =>
    p.category === selectedCategoryId &&
    (categorySearchQuery === '' || p.name.toLowerCase().includes(categorySearchQuery.toLowerCase()))
  );

  const renderStars = (rating: number, size: number = 10) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} size={ms(size)} color={i < Math.floor(rating) ? '#FF7A59' : '#E2E8F0'} fill={i < Math.floor(rating) ? '#FF7A59' : 'none'} strokeWidth={1.5} />
    ));
  };

  const handleFeedAdd = (item: PharmaQuickReorderItem | PharmaPopularMedicine) => {
    if (addToCart) addToCart(item.id, item.name, item.price, '💊');
    setFeedAddedIds(prev => new Set(prev).add(item.id));
  };

  const handlePopularPress = (item: PharmaPopularMedicine) => {
    onProductClick?.({
      id: item.id,
      name: item.name,
      price: item.price,
      emoji: '💊',
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
          <AppText style={styles.emptyText}>No medicines found for "{searchQuery}"</AppText>
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
                ? 'No pharmacies listed yet — showing sample outlets'
                : 'Showing sample pharmacies — offline'}
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

      {filteredCategoryProducts.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <AppText style={styles.emptyStateEmoji}>💊</AppText>
          <AppText style={styles.emptyStateTitle}>No products found</AppText>
        </View>
      ) : (
        <View style={styles.catProductsGrid}>
          {filteredCategoryProducts.map(product => (
            <PharmaProductCard
              key={product.id}
              product={{ id: product.id, name: product.name, price: displayPrice(product), emoji: product.emoji, image: product.image, desc: product.desc, rating: product.rating, app: 'PHARMA', category: product.category, badge: displayBadge(product.id, product.discountBadge) }}
              originalPrice={displayOriginal(product)}
              isAdded={addedAnimationId === product.id}
              onPress={() => { setSelectedProduct(product); setCurrentView('PRODUCT_DETAIL'); }}
              onAdd={() => handleAddWithFeedback(product.id, product.name, displayPrice(product), product.emoji)}
            />
          ))}
        </View>
      )}
      <View style={{ height: vs(24) }} />
    </ScrollView>
  );

  const productDetailView = selectedProduct && (
    <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
      <View style={styles.detailHero}>
        <Svg width={SCREEN_W} height={vs(320)} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="detailGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFF2EE" />
              <Stop offset="1" stopColor="#FFF7F4" />
            </LinearGradient>
          </Defs>
          <Rect width={SCREEN_W} height={vs(320)} fill="url(#detailGrad)" rx={ms(36)} />
        </Svg>
        <View style={styles.detailTopBar}>
          <TouchableOpacity style={styles.detailBackBtn} onPress={goBack} activeOpacity={0.8}>
            <ChevronLeft size={ms(16)} color="#ffffff" strokeWidth={3} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.detailHeartBtn} onPress={() => toggleLocalFavorite(selectedProduct.id)}>
            <Heart size={ms(14)} color={localFavorites.includes(selectedProduct.id) ? '#e11d48' : '#94a3b8'} fill={localFavorites.includes(selectedProduct.id) ? '#e11d48' : 'none'} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        <View style={styles.detailImageContainer}>
          <Image source={{ uri: selectedProduct.image }} style={styles.detailImage} />
        </View>
      </View>

      <View style={styles.detailContent}>
        <AppText style={styles.detailName}>{selectedProduct.name}</AppText>

        <View style={styles.detailStarsRow}>
          {renderStars(selectedProduct.rating, 12)}
          <AppText style={styles.detailReviewCount}>({selectedProduct.reviewsCount} Reviews)</AppText>
        </View>

        <View style={styles.quantityRow}>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => setQuantity(Math.max(1, quantity - 1))}
            activeOpacity={0.8}
          >
            <Minus size={ms(11)} color="#0f172a" strokeWidth={3} />
          </TouchableOpacity>
          <AppText style={styles.qtyValue}>{quantity}</AppText>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => setQuantity(quantity + 1)}
            activeOpacity={0.8}
          >
            <Plus size={ms(11)} color="#0f172a" strokeWidth={3} />
          </TouchableOpacity>
        </View>

        <AppText style={styles.detailDesc}>{selectedProduct.desc}</AppText>

        <View style={styles.bulletsContainer}>
          {selectedProduct.bullets?.map((bullet: string, idx: number) => (
            <View key={idx} style={styles.bulletRow}>
              <View style={styles.bulletCircle}>
                <CheckCircle size={ms(8)} color="#FF7A59" strokeWidth={4} />
              </View>
              <AppText style={styles.bulletText}>{bullet}</AppText>
            </View>
          ))}
        </View>

        <View style={styles.totalBar}>
          <View>
            <AppText style={styles.totalLabel}>TOTAL AMOUNT</AppText>
            <AppText style={styles.totalAmount}>₹{displayPrice(selectedProduct) * quantity}</AppText>
          </View>
          <TouchableOpacity
            style={[styles.addToCartBtn, addedAnimationId === selectedProduct.id && styles.addToCartBtnAdded]}
            onPress={() => {
              handleAddMultipleToCart(selectedProduct, quantity);
              setAddedAnimationId(selectedProduct.id);
              setTimeout(() => setAddedAnimationId(null), 1200);
            }}
            activeOpacity={0.9}
          >
            <AppText style={styles.addToCartBtnText}>
              {addedAnimationId === selectedProduct.id ? 'Added to Cart!' : 'Add to Cart'}
            </AppText>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: vs(24) }} />
    </ScrollView>
  );

  const historyView = (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.historyHeader}>
        <ClipboardList size={ms(18)} color="#FF7A59" strokeWidth={2} />
        <AppText style={styles.historyTitle}>Recently Ordered</AppText>
        <AppText style={styles.historySubtitle}>Your latest medicine orders</AppText>
      </View>

      {historyOrders.map((order) => {
        const rx = order.kind === 'prescription';
        const firstLine = order.items?.find((i) => i.id.startsWith('ph-')) ?? order.items?.[0];
        const emoji = rx ? '📄' : firstLine?.emoji ?? '💊';
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
                <AppText style={styles.historyOrderEmoji}>{emoji}</AppText>
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
                  <AppText style={styles.historyOrderEmoji}>{order.emoji}</AppText>
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
          <AppText style={styles.emptyStateEmoji}>🧾</AppText>
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
    case 'PRODUCT_DETAIL': return productDetailView;
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
    color: '#666666',
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
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
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
    fontSize: ms(12),
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  searchFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: ms(12),
    marginHorizontal: hs(16),
    paddingHorizontal: hs(12),
    height: vs(36),
    gap: hs(6),
    marginBottom: vs(12),
  },
  searchFilterInput: {
    flex: 1,
    fontSize: ms(10),
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
  emptyStateTitle: {
    fontSize: ms(12),
    fontWeight: '900',
    color: '#64748b',
  },
  detailHero: {
    height: vs(320),
    position: 'relative',
  },
  detailTopBar: {
    position: 'absolute',
    top: vs(48),
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: hs(20),
  },
  detailBackBtn: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailHeartBtn: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailImageContainer: {
    position: 'absolute',
    top: vs(80),
    left: 0,
    right: 0,
    alignItems: 'center',
    height: vs(192),
    justifyContent: 'center',
  },
  detailImage: {
    width: ms(192),
    height: ms(192),
    resizeMode: 'contain',
  },
  detailContent: {
    paddingHorizontal: hs(20),
    paddingTop: SPACE.BLOCK,
  },
  detailName: {
    fontSize: ms(18),
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: vs(8),
  },
  detailStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    marginBottom: vs(16),
  },
  detailReviewCount: {
    fontSize: ms(10),
    fontWeight: '600',
    color: '#94a3b8',
    marginLeft: hs(4),
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(12),
    marginBottom: vs(16),
  },
  qtyBtn: {
    width: ms(30),
    height: ms(30),
    borderRadius: ms(15),
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  qtyValue: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#0f172a',
    minWidth: ms(24),
    textAlign: 'center',
  },
  detailDesc: {
    fontSize: ms(11),
    fontWeight: '600',
    color: '#64748b',
    lineHeight: vs(16),
    marginBottom: vs(16),
  },
  bulletsContainer: {
    gap: vs(10),
    marginBottom: SPACE.SECTION,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
  },
  bulletCircle: {
    width: ms(16),
    height: ms(16),
    borderRadius: ms(8),
    backgroundColor: '#FFEAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletText: {
    fontSize: ms(11),
    fontWeight: '700',
    color: '#334155',
  },
  totalBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACE.ITEM,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: hs(12),
  },
  totalLabel: {
    fontSize: ms(9),
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  totalAmount: {
    fontSize: ms(16),
    fontWeight: '900',
    color: '#0f172a',
    marginTop: vs(2),
  },
  addToCartBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
    height: vs(44),
    borderRadius: ms(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  addToCartBtnAdded: {
    backgroundColor: '#059669',
  },
  addToCartBtnText: {
    fontSize: ms(11),
    fontWeight: '900',
    color: '#ffffff',
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
    color: '#065f46',
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
