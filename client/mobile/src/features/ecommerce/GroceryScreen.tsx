import React, { useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { hs, ms, vs } from '@/utils/responsive';
import AppText from '@/components/AppText';
import { groceryProducts } from '@data/grocery/products';
import GroceryProductCard from '@/features/ecommerce/cards/GroceryProductCard';
import type { RootStackParamList } from '@/navigation/types';

import GroceryHeroBanner from './components/grocery-home/GroceryHeroBanner';
import GroceryAdCarousel from './components/grocery-home/GroceryAdCarousel';
import CategoryCardRail from '@/components/shared/CategoryCardRail';
import TopPicksRail from './components/grocery-home/TopPicksRail';
import BestDealsRail from './components/grocery-home/BestDealsRail';
import SeasonSpecialsRail from './components/grocery-home/SeasonSpecialsRail';
import TopBrandsRail from './components/grocery-home/TopBrandsRail';
import AlsoNeedRail from './components/grocery-home/AlsoNeedRail';
import { getCategoryCards } from '@/services/categoryRail';
import type { CategoryCard } from '@/services/categoryRail';
import { GROCERY_ACCENT } from '@data/categories/masterCategories';
import { useGroceryFeed } from './hooks/useGroceryFeed';
import GroceryHomeSkeleton from './components/skeletons/GroceryHomeSkeleton';

interface GroceryScreenProps {
  addToCart?: (id: string, name: string, price: number, emoji: string) => void;
  cartItems?: { id: string; name: string; price: number; quantity: number; emoji: string }[];
  updateCartQuantity?: (id: string, delta: number) => void;
  onProductClick?: (product: any) => void;
  searchQuery?: string;
}

export function GroceryScreen({
  addToCart,
  cartItems,
  updateCartQuantity,
  onProductClick,
  searchQuery = '',
}: GroceryScreenProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const feed = useGroceryFeed();
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const handleCategoryPress = useCallback(
    (card: CategoryCard) => {
      navigation.navigate('MasterCategories', {
        initialChip: 'GROCERY',
        initialTabId: card.id,
      });
    },
    [navigation],
  );

  const handleViewCategories = useCallback(() => {
    navigation.navigate('MasterCategories', { initialChip: 'GROCERY' });
  }, [navigation]);

  if (normalizedSearch) {
    const searchedProducts = groceryProducts.filter((p) =>
      p.name.toLowerCase().includes(normalizedSearch),
    );

    return (
      <View style={styles.searchContainer}>
        <View style={styles.searchHeader}>
          <AppText style={styles.searchTitle}>Search Results</AppText>
          <AppText style={styles.searchCount}>{searchedProducts.length} items</AppText>
        </View>
        {searchedProducts.length === 0 ? (
          <View style={styles.emptyWrap}>
            <AppText style={styles.emptyText}>No products found for "{searchQuery}"</AppText>
          </View>
        ) : (
          <ScrollView
            style={styles.searchScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.productGrid}
          >
            <View style={styles.productsRow}>
              {searchedProducts.map((product) => {
                const qty = cartItems?.find((i) => i.id === product.id)?.quantity ?? 0;
                return (
                  <GroceryProductCard
                    key={product.id}
                    product={{ ...product, app: 'GROCERY' as const }}
                    quantity={qty}
                    isAdded={false}
                    onPress={() => onProductClick && onProductClick({ ...product, app: 'GROCERY' })}
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
  }

  if (!feed) {
    return <GroceryHomeSkeleton />;
  }

  return (
    <ScrollView
      style={styles.feed}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.feedContent}
    >
      <GroceryHeroBanner />
      <GroceryAdCarousel banners={feed.adBanners} />
      <CategoryCardRail
        title="Shop by Category"
        categories={getCategoryCards('GROCERY')}
        accent={GROCERY_ACCENT}
        cardBg="#F5F5F5"
        onPress={handleCategoryPress}
        onViewMore={handleViewCategories}
      />
      <TopPicksRail items={feed.topPicks} onProductPress={onProductClick} />
      <BestDealsRail items={feed.bestDeals} onDealPress={onProductClick} />
      <SeasonSpecialsRail items={feed.seasonSpecials} />
      <TopBrandsRail brands={feed.topBrands} />
      <AlsoNeedRail items={feed.alsoNeed} onProductPress={onProductClick} />
    </ScrollView>
  );
}

export default GroceryScreen;

const styles = StyleSheet.create({
  feed: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  feedContent: {
    paddingBottom: vs(24),
  },
  searchContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  searchHeader: {
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
    color: '#666666',
  },
  searchScroll: {
    flex: 1,
  },
  productGrid: {
    paddingBottom: vs(40),
  },
  productsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: hs(12),
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
});
