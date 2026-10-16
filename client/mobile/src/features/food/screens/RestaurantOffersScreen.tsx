import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Search } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { foodTheme } from '../constants/theme';
import type { FoodStackParamList, RootStackParamList } from '@/navigation/types';
import type { SpecialDish } from '../mocks/types';
import { dishToProduct } from '../mocks/specials';
import AppText from '@/components/AppText';
import FoodDetailTopBar from '../components/FoodDetailTopBar';
import SearchDishCard from '../components/SearchDishCard';

type Props = NativeStackScreenProps<FoodStackParamList, 'RestaurantOffers'>;

/**
 * "View All" offers page — a food-search-result-style list of a restaurant's
 * own discounted dishes. Reuses the SearchDishCard row (square thumb + ADD/stepper)
 * and keeps the strikethrough old price so it reads as an offers listing.
 */
export function RestaurantOffersScreen({ navigation, route }: Props) {
  const { restaurant, offers } = route.params;
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOffers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return offers;
    return offers.filter(
      (d) =>
        d.dishName.toLowerCase().includes(q) ||
        (d.description ?? '').toLowerCase().includes(q),
    );
  }, [offers, searchQuery]);

  const openDish = useCallback(
    (dish: SpecialDish) => {
      navigation
        .getParent<NativeStackNavigationProp<RootStackParamList>>()
        ?.navigate('ProductDetail', { product: dishToProduct(dish) });
    },
    [navigation],
  );

  return (
    <View style={styles.container}>
      <FoodDetailTopBar title={`Offers from ${restaurant.name}`} onBack={() => navigation.goBack()} />

      <View style={styles.searchBox}>
        <Search color={foodTheme.textSecondary} size={ms(16)} />
        <TextInput
          placeholder="Search offers…"
          placeholderTextColor={foodTheme.textSecondary}
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {offers.length === 0 ? (
        <View style={styles.emptyWrap}>
          <AppText style={styles.emptyText}>No current offers from {restaurant.name}</AppText>
        </View>
      ) : (
        <FlatList
          data={filteredOffers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SearchDishCard
              dish={item}
              oldPrice={item.mrp !== undefined && item.mrp > item.price ? item.mrp : undefined}
              onPress={openDish}
              restaurantId={restaurant.id}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <AppText style={styles.emptyText}>No offers match your search.</AppText>
            </View>
          }
        />
      )}
    </View>
  );
}

export default RestaurantOffersScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: hs(12),
    marginHorizontal: hs(16),
    marginBottom: vs(8),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    fontSize: ms(14),
    marginLeft: hs(8),
    color: foodTheme.textPrimary,
    paddingVertical: vs(10),
    paddingHorizontal: 0,
  },
  listContent: {
    paddingTop: vs(4),
    paddingBottom: SPACE.LIST_BOTTOM,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: vs(60),
    paddingHorizontal: hs(24),
  },
  emptyText: {
    color: foodTheme.textSecondary,
    fontSize: ms(14),
    textAlign: 'center',
  },
});
