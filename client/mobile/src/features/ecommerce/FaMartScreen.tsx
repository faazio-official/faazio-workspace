import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { hs, ms, vs } from '@/utils/responsive';
import AppText from '@/components/AppText';
import { useCartStore } from '@/state/store';
import { martProducts } from '@data/mart/products';
import type { MartProduct } from '@data/types';
import type { RootStackParamList } from '@/navigation/types';
import MartProductCard from '@/features/ecommerce/cards/MartProductCard';

import {
  dealToProduct,
  flashSaleToProduct,
} from './mocks/martHomeFeed';
import type { MartLocalVendor, MartTopBrand, MartDeal, MartFlashSale } from './mocks/martHomeFeed';
import { useMartFeed } from './hooks/useMartFeed';
import MartHomeSkeleton from './components/skeletons/MartHomeSkeleton';

import MartHeroCarousel from './components/mart-home/MartHeroCarousel';
import CategoryCardRail from '@/components/shared/CategoryCardRail';
import DealsOfDayRail from './components/mart-home/DealsOfDayRail';
import FlashSaleRail from './components/mart-home/FlashSaleRail';
import TopBrandsRail from './components/mart-home/TopBrandsRail';
import LocalVendorRail from './components/mart-home/LocalVendorRail';
import { VendorProfileView } from './components/vendor';
import { getCategoryCards } from '@/services/categoryRail';
import type { CategoryCard } from '@/services/categoryRail';
import { MART_ACCENT } from '@data/categories/masterCategories';

const SCREEN_W = Dimensions.get('window').width;

interface FaMartScreenProps {
  searchQuery?: string;
  onProductClick?: (product: any) => void;
  onSearchPress?: (query?: string) => void;
  /** The vendor whose profile drill-in is currently open (owned by the wrapper
   *  so header/tab-bar hiding and the vendor view update atomically). */
  vendor?: MartLocalVendor | null;
  /** Requests opening (vendor) or closing (null) the vendor profile drill-in. */
  onVendorPress?: (vendor: MartLocalVendor | null) => void;
}

/**
 * Each local vendor carries a rotating subset of the real @data/mart inventory,
 * so category chips genuinely filter across the vendor's available categories.
 */
const VENDOR_PRODUCT_MAP: Record<string, string[]> = {
  'lv-1': ['fm-f1', 'fm-f2', 'fm-f3', 'fm-b1', 'fm-b2', 'fm-t1', 'fm-bk1', 'fm-bk2'],
  'lv-2': ['fm-m1', 'fm-m2', 'fm-e1', 'fm-e2', 'fm-e3', 'fm-ha1', 'fm-ha2'],
  'lv-3': ['fm-f1', 'fm-b1', 'fm-e1', 'fm-t1', 'fm-fur1', 'fm-fur2', 'fm-s1'],
  'lv-4': ['fm-f2', 'fm-b2', 'fm-ha1', 'fm-t1', 'fm-s1', 'fm-bk1', 'fm-tg1'],
  'lv-5': ['fm-m1', 'fm-e3', 'fm-ha2', 'fm-fur2', 'fm-bk2', 'fm-t1', 'fm-s1'],
  'lv-6': ['fm-f3', 'fm-b1', 'fm-e2', 'fm-fur1', 'fm-ha1', 'fm-bk1', 'fm-s1'],
};

const getVendorProducts = (vendorId: string): MartProduct[] => {
  const ids = VENDOR_PRODUCT_MAP[vendorId];
  if (!ids) return martProducts.slice(0, 6);
  return ids
    .map((id) => martProducts.find((p) => p.id === id))
    .filter((p): p is MartProduct => Boolean(p));
};

/** Items currently on offer (have a pre-discount MRP) — shown in the discount rail. */
const getDiscountedProducts = (vendorId: string): MartProduct[] =>
  getVendorProducts(vendorId).filter((p) => p.originalPrice !== undefined && p.originalPrice > p.price);

const CARD_GAP = hs(12);
const CARD_W = (SCREEN_W - hs(32) - CARD_GAP) / 2;

export function FaMartScreen({
  searchQuery = '',
  onProductClick,
  onSearchPress,
  vendor = null,
  onVendorPress,
}: FaMartScreenProps) {
  const feed = useMartFeed();
  const cartItems = useCartStore((s) => s.cart);
  const addToCart = useCartStore((s) => s.addToCart);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const vendorProducts = useMemo(
    () => (vendor ? getVendorProducts(vendor.id) : []),
    [vendor],
  );

  const filteredVendorProducts = useMemo(
    () =>
      normalizedSearch
        ? vendorProducts.filter((p) => p.name.toLowerCase().includes(normalizedSearch))
        : vendorProducts,
    [vendorProducts, normalizedSearch],
  );

  const handleVendorPress = useCallback(
    (v: MartLocalVendor) => {
      onVendorPress?.(v);
    },
    [onVendorPress],
  );

  const handleCategoryPress = useCallback(
    (card: CategoryCard) => {
      navigation.navigate('MasterCategories', {
        initialChip: 'FA_MART',
        initialTabId: card.id,
      });
    },
    [navigation],
  );

  const handleViewCategories = useCallback(() => {
    navigation.navigate('MasterCategories', { initialChip: 'FA_MART' });
  }, [navigation]);

  const handleBrandPress = useCallback(
    (brand: MartTopBrand) => {
      navigation.navigate('Search', { subApp: 'FA_MART', initialQuery: brand.name });
    },
    [navigation],
  );

  const handleDealPress = useCallback(
    (deal: MartDeal) => {
      onProductClick?.(dealToProduct(deal));
    },
    [onProductClick],
  );

  const handleSalePress = useCallback(
    (sale: MartFlashSale) => {
      onProductClick?.(flashSaleToProduct(sale));
    },
    [onProductClick],
  );

  const feedSectionsData: { id: string; component: React.ReactNode }[] = [
    { id: 'hero', component: <MartHeroCarousel banners={feed?.heroBanners ?? []} /> },
    {
      id: 'categories',
      component: (
        <CategoryCardRail
          title="Shop by Category"
          categories={getCategoryCards('FA_MART')}
          accent={MART_ACCENT}
          cardBg="#FFF8E1"
          onPress={handleCategoryPress}
          onViewMore={handleViewCategories}
        />
      ),
    },
    { id: 'deals', component: <DealsOfDayRail deals={feed?.deals ?? []} onDealPress={handleDealPress} /> },
    { id: 'flash', component: <FlashSaleRail sales={feed?.flashSales ?? []} onSalePress={handleSalePress} /> },
    { id: 'brands', component: <TopBrandsRail brands={feed?.topBrands ?? []} onPress={handleBrandPress} /> },
  ];

  const handleBackToFeed = useCallback(() => {
    onVendorPress?.(null);
  }, [onVendorPress]);

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
        discountedProducts={getDiscountedProducts(vendor.id)}
        cartItems={cartItems}
        onBack={handleBackToFeed}
        onProductClick={onProductClick}
        onAddToCart={handleAddProduct}
        onUpdateQuantity={updateQuantity}
        onCartPress={() => navigation.navigate('Cart')}
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
    paddingBottom: vs(24),
  },
  drillContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  productGrid: {
    padding: hs(16),
    paddingBottom: vs(40),
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
