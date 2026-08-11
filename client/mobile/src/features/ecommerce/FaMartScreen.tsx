import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ShoppingCart } from 'lucide-react-native';
import { hs, ms, vs } from '@/utils/responsive';
import AppText from '@/components/AppText';
import { useCartStore } from '@/state/store';
import { martProducts } from '@data/mart/products';
import type { MartProduct } from '@data/types';
import type { RootStackParamList } from '@/navigation/types';
import MartProductCard from '@/features/ecommerce/cards/MartProductCard';

import {
  MART_HERO_BANNERS,
  MART_CATEGORIES,
  MART_DEALS,
  MART_FLASH_SALES,
  MART_TOP_BRANDS,
  MART_LOCAL_VENDORS,
} from './mocks/martHomeFeed';
import type { MartLocalVendor } from './mocks/martHomeFeed';

import MartHeroCarousel from './components/mart-home/MartHeroCarousel';
import MartCategoryRail from './components/mart-home/MartCategoryRail';
import DealsOfDayRail from './components/mart-home/DealsOfDayRail';
import FlashSaleRail from './components/mart-home/FlashSaleRail';
import TopBrandsRail from './components/mart-home/TopBrandsRail';
import LocalVendorRail from './components/mart-home/LocalVendorRail';

const SCREEN_W = Dimensions.get('window').width;

interface FaMartScreenProps {
  searchQuery?: string;
  onProductClick?: (product: any) => void;
}

const VENDOR_PRODUCT_MAP: Record<string, string[]> = {
  'lv-1': ['md-1', 'md-2', 'md-4', 'mf-1', 'mf-5'],
  'lv-2': ['md-3', 'md-5', 'md-6', 'mf-2', 'mf-3'],
  'lv-3': ['md-1', 'md-6', 'mf-1', 'mf-4', 'mf-5'],
  'lv-4': ['md-2', 'md-4', 'md-5', 'mf-3', 'mf-4'],
  'lv-5': ['md-3', 'md-5', 'md-6', 'mf-2', 'mf-5'],
  'lv-6': ['md-1', 'md-2', 'md-3', 'mf-1', 'mf-4'],
};

const DEAL_PRODUCT_MAP: Record<string, { id: string; name: string; price: number; emoji: string; imageUrl: string }> = {};
MART_DEALS.forEach((d) => { DEAL_PRODUCT_MAP[d.id] = d; });
MART_FLASH_SALES.forEach((s) => { DEAL_PRODUCT_MAP[s.id] = s; });

const getVendorProducts = (vendorId: string): MartProduct[] => {
  const ids = VENDOR_PRODUCT_MAP[vendorId];
  if (!ids) return martProducts.slice(0, 6);
  return ids
    .map((id) => DEAL_PRODUCT_MAP[id])
    .filter(Boolean)
    .map((d) => ({
      id: d.id,
      app: 'MART' as const,
      category: 'Groceries',
      name: d.name,
      price: d.price,
      emoji: d.emoji,
      rating: 4.5,
      reviews: 100,
      desc: '',
      image: d.imageUrl,
    }));
};

const CARD_GAP = hs(12);
const CARD_W = (SCREEN_W - hs(32) - CARD_GAP) / 2;

const feedSectionsData: { id: string; component: React.ReactNode }[] = [
  { id: 'hero', component: <MartHeroCarousel banners={MART_HERO_BANNERS} /> },
  { id: 'categories', component: <MartCategoryRail categories={MART_CATEGORIES} /> },
  { id: 'deals', component: <DealsOfDayRail deals={MART_DEALS} /> },
  { id: 'flash', component: <FlashSaleRail sales={MART_FLASH_SALES} /> },
  { id: 'brands', component: <TopBrandsRail brands={MART_TOP_BRANDS} /> },
];

export function FaMartScreen({
  searchQuery = '',
  onProductClick,
}: FaMartScreenProps) {
  const [selectedVendor, setSelectedVendor] = useState<MartLocalVendor | null>(null);
  const cartItems = useCartStore((s) => s.cart);
  const addToCart = useCartStore((s) => s.addToCart);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const vendorProducts = useMemo(
    () => (selectedVendor ? getVendorProducts(selectedVendor.id) : []),
    [selectedVendor],
  );

  const filteredVendorProducts = useMemo(
    () =>
      normalizedSearch
        ? vendorProducts.filter((p) => p.name.toLowerCase().includes(normalizedSearch))
        : vendorProducts,
    [vendorProducts, normalizedSearch],
  );

  const handleVendorPress = useCallback((vendor: MartLocalVendor) => {
    setSelectedVendor(vendor);
  }, []);

  const handleBackToFeed = useCallback(() => {
    setSelectedVendor(null);
  }, []);

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
  if (selectedVendor) {
    return (
      <View style={styles.drillContainer}>
        <View style={styles.drillHeader}>
          <TouchableOpacity onPress={handleBackToFeed} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <AppText style={styles.backArrow}>←</AppText>
          </TouchableOpacity>
          <View style={styles.drillHeaderText}>
            <AppText style={styles.drillTitle}>{selectedVendor.name}</AppText>
            <AppText style={styles.drillMeta}>
              {selectedVendor.distance} · ⭐ {selectedVendor.rating} · {selectedVendor.deliveryTime}
            </AppText>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Cart')} style={styles.drillCartBtn} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ShoppingCart size={ms(18)} color="#1E2022" strokeWidth={2} />
            {cartItems.length > 0 && (
              <View style={styles.drillCartBadge}>
                <AppText style={styles.drillCartBadgeText}>{cartItems.length}</AppText>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <FlatList
          data={filteredVendorProducts}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.productGrid}
          columnWrapperStyle={styles.productRow}
          showsVerticalScrollIndicator={false}
          renderItem={renderProductItem}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <AppText style={styles.emptyText}>No products found</AppText>
            </View>
          }
        />
      </View>
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
  return (
    <FlatList
      data={feedSectionsData}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <>{item.component}</>}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.feedContent}
      ListFooterComponent={
        <LocalVendorRail vendors={MART_LOCAL_VENDORS} onVendorPress={handleVendorPress} />
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
  drillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    paddingVertical: vs(12),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  backBtn: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: hs(10),
  },
  backArrow: {
    fontSize: ms(18),
    fontWeight: '700',
    color: '#1E2022',
    marginTop: vs(-2),
  },
  drillHeaderText: {
    flex: 1,
  },
  drillTitle: {
    fontSize: ms(15),
    fontWeight: '700',
    color: '#1E2022',
  },
  drillMeta: {
    fontSize: ms(10),
    fontWeight: '500',
    color: '#666666',
    marginTop: vs(2),
  },
  drillCartBtn: {
    position: 'relative',
    width: ms(36),
    height: ms(36),
    alignItems: 'center',
    justifyContent: 'center',
  },
  drillCartBadge: {
    position: 'absolute',
    top: vs(2),
    right: hs(2),
    backgroundColor: '#FFC107',
    borderRadius: ms(7),
    minWidth: ms(14),
    height: ms(14),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(3),
  },
  drillCartBadgeText: {
    fontSize: ms(8),
    fontWeight: '900',
    color: '#1E2022',
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
