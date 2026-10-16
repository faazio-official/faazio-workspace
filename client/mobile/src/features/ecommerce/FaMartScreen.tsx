import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { hs, ms, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import AppText from '@/components/AppText';
import { useCartStore } from '@/state/store';
import { martProducts } from '@data/mart/products';
import type { MartProduct, StoreProfile } from '@data/types';
import type { RootStackParamList } from '@/navigation/types';
import { isDiscounted } from '@/services/categoryVendors';
import { applyActiveDiscounts, useActiveDiscounts } from '@/services/pricing';
import MartProductCard from '@/features/ecommerce/cards/MartProductCard';

import {
  dealToProduct,
  essentialToProduct,
} from './mocks/martHomeFeed';
import type { MartDeal, MartEssential } from './mocks/martHomeFeed';
import { useMartFeed } from './hooks/useMartFeed';
import MartHomeSkeleton from './components/skeletons/MartHomeSkeleton';

import MartHeroCarousel from './components/mart-home/MartHeroCarousel';
import DealsOfDayRail from './components/mart-home/DealsOfDayRail';
import DailyEssentialsRail from './components/mart-home/DailyEssentialsRail';
import LocalVendorRail from './components/mart-home/LocalVendorRail';
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
 * A store's drill-in inventory is derived from the real @data/mart product set
 * via each product's `storeId`, so category chips genuinely filter across the
 * products that store actually sells.
 */
const getVendorProducts = (store: StoreProfile): MartProduct[] =>
  martProducts.filter((p) => p.storeId === store.id);

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

  const vendorProducts = useMemo(
    () => (vendor ? getVendorProducts(vendor) : []),
    [vendor],
  );

  // "Discounted Products" rail: every vendor product, with any server-owned festival discount
  // overlaid, filtered to what is actually on offer (authored MRP or an active opt-in). Fetching
  // discounts for the full pool means an approved opt-in shows even when the product has no MRP
  // fixture. In mock mode `useActiveDiscounts` returns {} so only the authored MRP set shows.
  const vendorDiscounts = useActiveDiscounts(vendorProducts.map((p) => p.id));
  const discountedProducts = useMemo(
    () => applyActiveDiscounts(vendorProducts, vendorDiscounts).filter(isDiscounted),
    [vendorProducts, vendorDiscounts],
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
      onProductClick?.(dealToProduct(deal));
    },
    [onProductClick],
  );

  const handleEssentialPress = useCallback(
    (item: MartEssential) => {
      onProductClick?.(essentialToProduct(item));
    },
    [onProductClick],
  );

  const feedSectionsData: { id: string; component: React.ReactNode }[] = [
    { id: 'hero', component: <MartHeroCarousel banners={feed?.heroBanners ?? []} /> },
    { id: 'deals', component: <DealsOfDayRail deals={feed?.deals ?? []} onDealPress={handleDealPress} /> },
    { id: 'essentials', component: <DailyEssentialsRail items={feed?.dailyEssentials ?? []} onItemPress={handleEssentialPress} /> },
  ];

  const handleBackToFeed = useCallback(() => {
    onVendorPress?.(null);
  }, [onVendorPress]);

  const handleRateVendor = useCallback(
    (v: StoreProfile) => navigation.navigate('RateVendor', { vendorId: v.id, vendorName: v.name }),
    [navigation],
  );

  const handleAddProduct = useCallback(
    (product: MartProduct) => {
      addToCart(product.id, product.name, product.price, product.emoji);
    },
    [addToCart],
  );

  const renderProductItem = useCallback(
    ({ item }: { item: MartProduct }) => {
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
        vendor={vendor}
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
      />
    );
  }

  // ---- Search Mode ----
  if (normalizedSearch) {
    const searchedProducts = martProducts.filter((p) =>
      p.name.toLowerCase().includes(normalizedSearch),
    );
    return (
      <View style={styles.drillContainer}>
        <FlatList
          data={searchedProducts}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.productGrid}
          columnWrapperStyle={styles.productRow}
          showsVerticalScrollIndicator={false}
          renderItem={renderProductItem}
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
