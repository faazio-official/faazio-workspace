import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { hs, ms, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import AppText from '@/components/AppText';
import { useCartStore } from '@/state/store';
import type { Product, StoreProfile } from '@data/types';
import type { RootStackParamList } from '@/navigation/types';
import { gateway, type HeroAd } from '@/services/api/GatewayClient';
import { openCatalogTarget, openHeroTarget } from '@/services/adsTarget';
import { isDiscounted } from '@/services/categoryVendors';
import { applyActiveDiscounts, useActiveDiscounts } from '@/services/pricing';
import { trackProductView } from '@/services/productViews';
import { useViewableTracking } from '@/hooks/useViewableTracking';
import MartProductCard from '@/features/ecommerce/cards/MartProductCard';

import {
  dealToProduct,
  essentialToProduct,
} from './mocks/martHomeFeed';
import type { MartDeal, MartEssential } from './mocks/martHomeFeed';
import { useMartFeed } from './hooks/useMartFeed';
import { priceDeals, priceEssentials } from './services/martService';
import MartHomeSkeleton from './components/skeletons/MartHomeSkeleton';

import DealsOfDayRail from './components/mart-home/DealsOfDayRail';
import DailyEssentialsRail from './components/mart-home/DailyEssentialsRail';
import LocalVendorRail from './components/mart-home/LocalVendorRail';
import MartHouseHero from './components/mart-home/MartHouseHero';
import SponsoredRail from '@/components/shared/SponsoredRail';
import CampaignHero from '@/components/shared/CampaignHero';
import { VendorProfileView } from './components/vendor';

const SCREEN_W = Dimensions.get('window').width;

interface FaMartScreenProps {
  searchQuery?: string;
  onProductClick?: (product: any) => void;
  onSearchPress?: (query?: string) => void;
  /** The vendor whose profile drill-in is currently open (owned by the wrapper
   *  so header/tab-bar hiding and the vendor view update atomically). */
  vendor?: StoreProfile | null;
  /** Requests opening (vendor) or closing (null) the vendor profile drill-in. */
  onVendorPress?: (vendor: StoreProfile | null) => void;
  /** Open the Deals landing page for this vendor's discounted products. */
  onViewAllDiscounts?: (vendor: StoreProfile) => void;
}

/**
 * A store's drill-in inventory is served by the gateway (`GET /stores/{id}/products`,
 * `catalog.products` filtered by `store_id` + `status = ACTIVE`). The local empty fallback keeps the
 * drill-in renderable offline; the server is the origin.
 */
const CARD_GAP = hs(12);
const CARD_W = (SCREEN_W - hs(32) - CARD_GAP) / 2;

export function FaMartScreen({
  searchQuery = '',
  onProductClick,
  onSearchPress,
  vendor = null,
  onVendorPress,
  onViewAllDiscounts,
}: FaMartScreenProps) {
  const feed = useMartFeed();
  const cartItems = useCartStore((s) => s.cart);
  const addToCart = useCartStore((s) => s.addToCart);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const normalizedSearch = searchQuery.trim().toLowerCase();

  // Vendor header enrichment: the rail serves the PII-free list projection, so fetch the single
  // store (authed → full address/phone, anon → redacted). Falls back to the list row when absent.
  const [vendorDetail, setVendorDetail] = useState<StoreProfile | null>(vendor);
  useEffect(() => {
    setVendorDetail(vendor);
    if (!vendor) return;
    let active = true;
    gateway
      .getStore(vendor.id)
      .then((s) => {
        if (active && s) setVendorDetail(s);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [vendor]);

  // Vendor drill-in inventory: server-backed (catalog.products by store_id + ACTIVE), refetched
  // whenever the open vendor changes. Empty in feed mode.
  const [vendorProducts, setVendorProducts] = useState<Product[]>([]);
  useEffect(() => {
    if (!vendor) {
      setVendorProducts([]);
      return;
    }
    let active = true;
    gateway
      .getStoreProducts(vendor.id)
      .then((rows) => {
        if (active) setVendorProducts(rows);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [vendor]);

  // Feed search mode: full catalog search (FTS on the server, local mirror offline), so results
  // are no longer limited to the local fixture pool. Empty when no query.
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  useEffect(() => {
    if (!normalizedSearch || vendor) {
      setSearchResults([]);
      return;
    }
    let active = true;
    gateway
      .searchProducts(searchQuery.trim(), 'MART')
      .then((rows) => {
        if (!active) return;
        setSearchResults(rows);
        // Behavior analytics (ID-only, allowlisted): the `search` event has no product id of its
        // own, so it is anchored to the top result — mirrors SearchScreen.
        const anchor = rows.find((r) => r?.id)?.id;
        if (anchor) void gateway.trackEvent(String(anchor), 'search').catch(() => {});
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [normalizedSearch, searchQuery, vendor]);

  // Passive `view` impressions for the search-result grid and the vendor drill-in "All Products"
  // grid that actually scroll into view (deduped per session by `trackProductView`). PDP opens
  // still emit their own `view`.
  const { onViewableItemsChanged, viewabilityConfig } = useViewableTracking<Product>((p) =>
    trackProductView(p.id),
  );

  // "Discounted Products" rail: every vendor product, with any server-owned festival discount
  // overlaid, filtered to what is actually on offer (authored MRP or an active opt-in). Fetching
  // discounts for the full pool means an approved opt-in shows even when the product has no MRP
  // fixture. In mock mode `useActiveDiscounts` returns {} so only the authored MRP set shows.
  //
  // The same price authority covers the whole feed: one batch `GET /promo/active-discounts` for the
  // Deals rail, Daily Essentials and the vendor pool (and the paid shelf via the `discounts` prop) —
  // one cache key, no post-paint price flicker, identical shopper price on every surface.
  const discountIds = useMemo(
    () => [
      ...(feed?.deals ?? []).map((d) => d.id),
      ...(feed?.dailyEssentials ?? []).map((i) => i.id),
      ...vendorProducts.map((p) => p.id),
    ],
    [feed?.deals, feed?.dailyEssentials, vendorProducts],
  );
  const discounts = useActiveDiscounts(discountIds);

  const discountedProducts = useMemo(
    () => applyActiveDiscounts(vendorProducts, discounts).filter(isDiscounted),
    [vendorProducts, discounts],
  );
  const pricedDeals = useMemo(
    () => priceDeals(feed?.deals ?? [], discounts),
    [feed?.deals, discounts],
  );
  const pricedEssentials = useMemo(
    () => priceEssentials(feed?.dailyEssentials ?? [], discounts),
    [feed?.dailyEssentials, discounts],
  );

  const filteredVendorProducts = useMemo(
    () =>
      normalizedSearch
        ? vendorProducts.filter((p) => p.name.toLowerCase().includes(normalizedSearch))
        : vendorProducts,
    [vendorProducts, normalizedSearch],
  );

  const handleVendorPress = useCallback(
    (v: StoreProfile) => {
      onVendorPress?.(v);
    },
    [onVendorPress],
  );

  const handleDealPress = useCallback(
    (deal: MartDeal) => {
      // Canonical catalog row first (same resolver as the paid hero); local projection offline.
      void openCatalogTarget(deal.id, { onProduct: (p) => onProductClick?.(p) }, () =>
        dealToProduct(deal),
      );
    },
    [onProductClick],
  );

  const handleEssentialPress = useCallback(
    (item: MartEssential) => {
      void openCatalogTarget(item.id, { onProduct: (p) => onProductClick?.(p) }, () =>
        essentialToProduct(item),
      );
    },
    [onProductClick],
  );

  // Paid MART_HERO tap-through — the store/product deep-link target is resolved server-side.
  const handleHeroPress = useCallback(
    (ad: HeroAd) => {
      void openHeroTarget(ad, {
        onProduct: (product) => onProductClick?.(product),
        onStore: (store) => onVendorPress?.(store),
      });
    },
    [onProductClick, onVendorPress],
  );

  // Passive impressions for the two Mart feed rails (deduped per session by trackProductView).
  const handleDealView = useCallback((deal: MartDeal) => trackProductView(deal.id), []);
  const handleEssentialView = useCallback((item: MartEssential) => trackProductView(item.id), []);

  // Rail "View All" → the Deals landing grid (server list mode, no Home-owned fixture).
  const handleViewAllDeals = useCallback(() => {
    navigation.navigate('DealsLanding', {
      mode: 'martDeals',
      productIds: pricedDeals.map((d) => d.id),
      title: 'Deals of the Day',
    });
  }, [navigation, pricedDeals]);

  const handleViewAllEssentials = useCallback(() => {
    navigation.navigate('DealsLanding', {
      mode: 'martEssentials',
      productIds: pricedEssentials.map((i) => i.id),
      title: 'Daily Essentials',
    });
  }, [navigation, pricedEssentials]);

  const feedSectionsData: { id: string; component: React.ReactNode }[] = [
    {
      id: 'hero',
      component: (
        <CampaignHero
          placement="MART_HERO"
          app="MART"
          onPress={handleHeroPress}
          fallback={
            feed?.heroBanners?.length ? <MartHouseHero banners={feed.heroBanners} /> : null
          }
        />
      ),
    },
    // Paid Mart showcase (SPONSORED_SHOWCASE) — same closed-loop pipeline as the Home rail; collapses
    // to nothing when there is no LIVE fill.
    {
      id: 'sponsoredShowcase',
      component: (
        <SponsoredRail
          placement="SPONSORED_SHOWCASE"
          onProductClick={onProductClick}
          addToCart={addToCart}
          discounts={discounts}
          renderCard={(product, h) => (
            <MartProductCard
              key={product.id}
              product={product as unknown as Product}
              width={CARD_W}
              variant="rail"
              showAdLabel
              isAdded={h.isAdded}
              onPress={h.onPress}
              onAdd={h.onAdd}
            />
          )}
        />
      ),
    },
    { id: 'deals', component: <DealsOfDayRail deals={pricedDeals} onDealPress={handleDealPress} onViewAll={handleViewAllDeals} onItemView={handleDealView} /> },
    { id: 'essentials', component: <DailyEssentialsRail items={pricedEssentials} onItemPress={handleEssentialPress} onViewAll={handleViewAllEssentials} onItemView={handleEssentialView} /> },
  ];

  const handleBackToFeed = useCallback(() => {
    onVendorPress?.(null);
  }, [onVendorPress]);

  const handleRateVendor = useCallback(
    (v: StoreProfile) => navigation.navigate('RateVendor', { vendorId: v.id, vendorName: v.name }),
    [navigation],
  );

  const handleAddProduct = useCallback(
    (product: Product) => {
      addToCart(product.id, product.name, product.price, product.emoji);
    },
    [addToCart],
  );

  const renderProductItem = useCallback(
    ({ item }: { item: Product }) => {
      const cartItem = cartItems.find((c) => c.id === item.id);
      return (
        <MartProductCard
          product={item}
          width={CARD_W}
          quantity={cartItem?.quantity ?? 0}
          isAdded={!!cartItem && cartItem.quantity > 0}
          onPress={() => onProductClick?.(item)}
          onAdd={() => handleAddProduct(item)}
          onIncrement={() => updateQuantity(item.id, 1)}
          onDecrement={() => updateQuantity(item.id, -1)}
        />
      );
    },
    [cartItems, onProductClick, handleAddProduct, updateQuantity],
  );

  // ---- Store Drill-in Mode ----
  if (vendor) {
    return (
      <VendorProfileView
        vendor={vendorDetail ?? vendor}
        products={filteredVendorProducts}
        discountedProducts={discountedProducts}
        cartItems={cartItems}
        onBack={handleBackToFeed}
        onProductClick={onProductClick}
        onAddToCart={handleAddProduct}
        onUpdateQuantity={updateQuantity}
        onCartPress={() => navigation.navigate('Cart', {})}
        onViewAllDiscounts={onViewAllDiscounts ? () => onViewAllDiscounts(vendor) : undefined}
        onRateVendor={handleRateVendor}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />
    );
  }

  // ---- Search Mode ----
  if (normalizedSearch) {
    return (
      <View style={styles.drillContainer}>
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.productGrid}
          columnWrapperStyle={styles.productRow}
          showsVerticalScrollIndicator={false}
          renderItem={renderProductItem}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <AppText style={styles.emptyText}>No products found for "{searchQuery}"</AppText>
            </View>
          }
        />
      </View>
    );
  }

  // ---- Feed Mode ----
  if (!feed) {
    return <MartHomeSkeleton />;
  }

  return (
    <FlatList
      data={feedSectionsData}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <>{item.component}</>}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.feedContent}
      ListFooterComponent={
        <LocalVendorRail vendors={feed.localVendors} onVendorPress={handleVendorPress} />
      }
    />
  );
}

export default FaMartScreen;

const styles = StyleSheet.create({
  feedContent: {
    paddingBottom: SPACE.LIST_BOTTOM,
  },
  drillContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  productGrid: {
    padding: hs(16),
    paddingBottom: SPACE.LIST_BOTTOM,
  },
  productRow: {
    gap: CARD_GAP,
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
});
