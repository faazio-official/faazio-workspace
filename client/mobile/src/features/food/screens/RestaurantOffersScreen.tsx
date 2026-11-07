import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Search } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { foodTheme } from '../constants/theme';
import type { FoodStackParamList, RootStackParamList } from '@/navigation/types';
import type { SpecialDish } from '../mocks/types';
import { dishToProduct } from '../mocks/specials';
import { getOfferDishes } from '../utils/menu';
import { useRestaurantMenu } from '../hooks/useRestaurantMenu';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import FoodDetailTopBar from '../components/FoodDetailTopBar';
import SearchDishCard from '../components/SearchDishCard';

type Props = NativeStackScreenProps<FoodStackParamList, 'RestaurantOffers'>;

/**
 * "View All" offers page — a food-search-result-style list of a restaurant's
 * own discounted dishes. Reuses the SearchDishCard row (square thumb + ADD/stepper)
 * and keeps the strikethrough old price so it reads as an offers listing.
 *
 * The menu is re-fetched live via `useRestaurantMenu` (keys off the venue id) rather than trusting
 * the nav param alone, so a price/MRP change or an expiry between opening the profile and this page
 * can't leave a stale strike. The param `offers` is only an instant seed while the remote menu is
 * in flight for a server-only venue.
 */
export function RestaurantOffersScreen({ navigation, route }: Props) {
  const { restaurant, offers } = route.params;
  const [searchQuery, setSearchQuery] = useState('');
  const [priceAsc, setPriceAsc] = useState(true);
  const { menu, loading } = useRestaurantMenu(restaurant);
  const seedOffers = offers ?? [];

  // Live menu wins as soon as it has rows (a known venue seeds instantly from its fixture, then
  // swaps to the server list). Only a server-only venue still in flight borrows the param seed.
  const source = menu.length > 0 ? menu : loading ? seedOffers : menu;

  // Organic dishes are never offers — the page is MRP-struck only (the profile rail already
  // filters, this keeps the page honest if opened with a stale param payload).
  const offerDishes = useMemo(() => getOfferDishes(source), [source]);

  const filteredOffers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const rows = !q
      ? offerDishes
      : offerDishes.filter(
          (d) =>
            d.dishName.toLowerCase().includes(q) ||
            (d.description ?? '').toLowerCase().includes(q),
        );
    return [...rows].sort((a, b) => (priceAsc ? a.price - b.price : b.price - a.price));
  }, [offerDishes, searchQuery, priceAsc]);

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
<AppTextInput
          placeholder="Search offers"
          placeholderTextColor={foodTheme.textSecondary}
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          accessibilityLabel="Search offers"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {offerDishes.length > 0 ? (
        <View style={styles.metaRow}>
          <AppText style={styles.metaText}>
            Discounts reflect the restaurant’s live menu; availability can change.
          </AppText>
          <TouchableOpacity
            style={styles.sortBtn}
            onPress={() => setPriceAsc((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={priceAsc ? 'Sort offers by price, high to low' : 'Sort offers by price, low to high'}
          >
            {priceAsc ? (
              <ArrowUpNarrowWide size={ms(15)} color={foodTheme.primary} strokeWidth={2.2} />
            ) : (
              <ArrowDownWideNarrow size={ms(15)} color={foodTheme.primary} strokeWidth={2.2} />
            )}
            <AppText style={styles.sortText}>{priceAsc ? 'Price ↑' : 'Price ↓'}</AppText>
          </TouchableOpacity>
        </View>
      ) : null}

      {offerDishes.length === 0 ? (
        loading ? (
          <View style={styles.emptyWrap}>
            <ActivityIndicator color={foodTheme.primary} />
            <AppText style={styles.emptyText}>Loading offers…</AppText>
          </View>
        ) : (
          <View style={styles.emptyWrap}>
            <AppText style={styles.emptyText}>No discounted dishes right now</AppText>
          </View>
        )
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
    backgroundColor: foodTheme.background,
  },
  searchBox: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: foodTheme.sectionBg,
    borderRadius: 12,
    paddingHorizontal: hs(12),
    marginHorizontal: hs(16),
    marginBottom: vs(8),
    borderWidth: 1,
    borderColor: foodTheme.divider,
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
    marginTop: vs(10),
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: hs(12),
    paddingHorizontal: hs(16),
    paddingVertical: vs(6),
  },
  metaText: {
    flex: 1,
    color: foodTheme.textSecondary,
    fontSize: ms(11),
    lineHeight: ms(16),
  },
  sortBtn: {
    minHeight: 44,
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: hs(4),
  },
  sortText: {
    color: foodTheme.primary,
    fontSize: ms(12),
    fontWeight: '600',
  },
});
