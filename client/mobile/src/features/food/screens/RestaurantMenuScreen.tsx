import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Search, X } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import AppText from '@/components/AppText';
import FoodDetailTopBar from '../components/FoodDetailTopBar';
import DietToggle from '../components/DietToggle';
import MenuItemRow from '../components/MenuItemRow';
import MenuCategoryRail from '../components/MenuCategoryRail';
import ViewCartPill from '../components/ViewCartPill';
import { foodTheme } from '../constants/theme';
import type { FoodStackParamList, RootStackParamList } from '@/navigation/types';
import type { SpecialDish } from '@data/types';
import { getMenuCategories } from '../utils/menu';
import { useRestaurantMenu } from '../hooks/useRestaurantMenu';
import { dishMatches } from '../utils/dietFilter';
import { useCartStore } from '@/state/cartStore';
import type { DietFilter } from '@/state/foodFilterStore';

type Props = NativeStackScreenProps<FoodStackParamList, 'RestaurantMenu'>;

/**
 * Full restaurant menu page — the restaurant's complete dish list with its own
 * autofocused search bar, the category chip row and the diet toggle seeded from
 * the profile. Add/stepper writes to the same restaurant-isolated cart slice as
 * the profile, so the View Cart count stays in sync between both screens.
 */
export function RestaurantMenuScreen({ navigation, route }: Props) {
  const { restaurant: diningRestaurant } = route.params;

  const [activeCategory, setActiveCategory] = useState('Bestsellers');
  const [searchQuery, setSearchQuery] = useState('');
  const [dietFilter, setDietFilter] = useState<DietFilter>(() => route.params.dietFilter);

  const searchRef = useRef<TextInput>(null);

  const cart = useCartStore((s) => s.cart);
  const addToCart = useCartStore((s) => s.addToCart);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  // Focus the search field after the navigation transition settles — `autoFocus`
  // alone is unreliable on Android when the screen animates in.
  useEffect(() => {
    const timer = setTimeout(() => searchRef.current?.focus(), 250);
    return () => clearTimeout(timer);
  }, []);

  const restaurantItems = useMemo(
    () => cart.filter((i) => i.restaurantId === diningRestaurant.id),
    [cart, diningRestaurant.id],
  );
  const restaurantCartCount = useMemo(
    () => restaurantItems.reduce((acc, i) => acc + i.quantity, 0),
    [restaurantItems],
  );

  const { menu: dishes, loading: menuLoading } = useRestaurantMenu(diningRestaurant);

  const menu = useMemo(
    () => dishes.filter((d) => dishMatches(dietFilter, d)),
    [dishes, dietFilter],
  );

  const categories = useMemo(
    () => ['Bestsellers', ...getMenuCategories(menu)],
    [menu],
  );

  // Keep the selected chip valid when the diet filter removes its dishes.
  const active = categories.includes(activeCategory) ? activeCategory : 'Bestsellers';

  const filteredMenu = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base =
      active === 'Bestsellers'
        ? menu
        : menu.filter(
            (d) => (d.cuisine ?? '').toLowerCase() === active.toLowerCase(),
          );
    if (!q) return base;
    return base.filter(
      (d) =>
        d.dishName.toLowerCase().includes(q) ||
        (d.description ?? '').toLowerCase().includes(q),
    );
  }, [menu, active, searchQuery]);

  const openCart = useCallback(() => {
    navigation
      .getParent<NativeStackNavigationProp<RootStackParamList>>()
      ?.navigate('Cart', {
        restaurantId: diningRestaurant.id,
        restaurantName: diningRestaurant.name,
      });
  }, [navigation, diningRestaurant.id, diningRestaurant.name]);

  const handleAdd = useCallback(
    (dish: SpecialDish) => {
      addToCart(dish.id, dish.dishName, dish.price, '🍽️', diningRestaurant.id);
    },
    [addToCart, diningRestaurant.id],
  );

  const dishQuantity = useCallback(
    (id: string) => restaurantItems.find((i) => i.id === id)?.quantity ?? 0,
    [restaurantItems],
  );

  return (
    <View style={styles.container}>
      <FoodDetailTopBar
        title="Menu"
        onBack={() => navigation.goBack()}
        right={<DietToggle value={dietFilter} onChange={setDietFilter} />}
      />

      <View style={styles.titleBlock}>
        <AppText style={styles.restaurantName} numberOfLines={2}>
          {diningRestaurant.name}
        </AppText>
      </View>

      <View style={styles.searchBox}>
        <Search color={foodTheme.textSecondary} size={ms(18)} />
        <TextInput
          ref={searchRef}
          placeholder="Search in menu"
          placeholderTextColor={foodTheme.textSecondary}
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          accessibilityLabel="Search in menu"
        />
        {searchQuery.length > 0 ? (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <X color={foodTheme.textSecondary} size={ms(18)} />
          </TouchableOpacity>
        ) : null}
      </View>

      <MenuCategoryRail
        categories={categories}
        active={active}
        onSelect={setActiveCategory}
        style={styles.categoryRail}
      />

      <ScrollView
        style={styles.list}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.productList}>
          {filteredMenu.map((item) => {
            const qty = dishQuantity(item.id);
            return (
              <MenuItemRow
                key={item.id}
                dish={item}
                quantity={qty}
                onAdd={() => handleAdd(item)}
                onIncrement={() => updateQuantity(item.id, 1)}
                onDecrement={() => updateQuantity(item.id, -1)}
              />
            );
          })}
          {filteredMenu.length === 0 && (
            menuLoading ? (
              <ActivityIndicator
                color={foodTheme.primary}
                style={styles.menuLoading}
                accessibilityLabel="Loading menu"
              />
            ) : (
              <AppText style={styles.emptyText}>
                {searchQuery.trim()
                  ? 'No dishes match your search.'
                  : dietFilter === 'veg'
                    ? 'No veg dishes in this menu.'
                    : dietFilter === 'nonveg'
                      ? 'No non-veg dishes in this menu.'
                      : 'No dishes available.'}
              </AppText>
            )
          )}
        </View>
      </ScrollView>

      {restaurantCartCount > 0 && (
        <ViewCartPill count={restaurantCartCount} onPress={openCart} />
      )}
    </View>
  );
}

export default RestaurantMenuScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  titleBlock: {
    paddingHorizontal: hs(16),
    paddingTop: vs(8),
    paddingBottom: vs(2),
  },
  restaurantName: { fontSize: ms(18), fontWeight: '800', color: foodTheme.textPrimary },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: ms(12),
    minHeight: vs(44),
    paddingHorizontal: hs(14),
    marginHorizontal: hs(16),
    marginTop: vs(4),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    fontSize: ms(14),
    marginLeft: hs(8),
    color: foodTheme.textPrimary,
    padding: 0,
  },
  categoryRail: { paddingTop: vs(12), paddingBottom: vs(4) },
  list: { flex: 1 },
  listContent: { paddingBottom: vs(100) },
  productList: { paddingHorizontal: hs(16), paddingTop: vs(12) },
  emptyText: { color: foodTheme.textSecondary, textAlign: 'center', marginVertical: 24 },
  menuLoading: { marginVertical: 24 },
});
