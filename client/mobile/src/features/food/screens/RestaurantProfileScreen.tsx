import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';
import {
  ArrowLeft,
  Search,
  Share2,
  MapPin,
  Star,
  ShieldCheck,
  Clock,
  CheckCircle2,
} from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import AppText from '@/components/AppText';
import { AdBannerCarousel, AdLabelBadge } from '@/components/shared';
import { topAdSlides } from '@data/home/rails';
import RemoteImage from '../components/RemoteImage';
import FoodStatusBarStrip from '../components/FoodStatusBarStrip';
import MenuItemRow from '../components/MenuItemRow';
import ViewCartPill from '../components/ViewCartPill';
import { foodTheme } from '../constants/theme';
import type { FoodStackParamList, RootStackParamList } from '@/navigation/types';
import type { DiningRestaurant } from '../mocks/types';
import type { SpecialDish } from '@data/types';
import { getMenuForRestaurant, getOwnDishes, getMenuCategories } from '../utils/menu';
import { useCartStore } from '@/state/cartStore';
import { useFoodFilterStore, type DietFilter } from '@/state/foodFilterStore';
import { dishMatches } from '../utils/dietFilter';
import DietToggle from '../components/DietToggle';

type Props = NativeStackScreenProps<FoodStackParamList, 'RestaurantProfile'>;

const GREEN = '#16A34A';
const RED = '#DC2626';

export function RestaurantProfileScreen({ navigation, route }: Props) {
  const restaurant = route.params?.restaurant as DiningRestaurant;
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState('Bestsellers');

  // Screen-local diet override seeded once from the shared store. Toggling here
  // never writes back, so home/search keep their value; re-opening this screen
  // re-seeds from home ("follows home by default").
  const [dietFilter, setDietFilter] = useState<DietFilter>(
    () => useFoodFilterStore.getState().dietFilter,
  );

  const cart = useCartStore((s) => s.cart);
  const addToCart = useCartStore((s) => s.addToCart);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  // This restaurant's isolated cart slice — untagged/other-restaurant lines don't
  // show here, so the footer + steppers never reflect the common cart.
  const restaurantItems = useMemo(
    () => cart.filter((i) => i.restaurantId === restaurant.id),
    [cart, restaurant.id],
  );
  const restaurantCartCount = useMemo(
    () => restaurantItems.reduce((acc, i) => acc + i.quantity, 0),
    [restaurantItems],
  );

  const scrollY = useSharedValue(0);
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = e.nativeEvent.contentOffset.y;
    },
    [scrollY],
  );

  const menu = useMemo(
    () => getMenuForRestaurant(restaurant).filter((d) => dishMatches(dietFilter, d)),
    [restaurant, dietFilter],
  );
  const restaurantDishes = useMemo(
    () => getOwnDishes(menu, restaurant.name),
    [menu, restaurant],
  );

  const categories = useMemo(
    () => ['Bestsellers', ...getMenuCategories(menu)],
    [menu],
  );

  // Keep the selected chip valid when the diet filter removes its dishes.
  const active = categories.includes(activeCategory) ? activeCategory : 'Bestsellers';

  const filteredMenu = useMemo(
    () =>
      active === 'Bestsellers'
        ? menu
        : menu.filter(
            (d) => (d.cuisine ?? '').toLowerCase() === active.toLowerCase(),
          ),
    [menu, active],
  );

  const openCart = useCallback(() => {
    navigation
      .getParent<NativeStackNavigationProp<RootStackParamList>>()
      ?.navigate('Cart', { restaurantId: restaurant.id, restaurantName: restaurant.name });
  }, [navigation, restaurant.id, restaurant.name]);

  const openMenuSearch = useCallback(() => {
    navigation.navigate('RestaurantMenu', { restaurant, dietFilter });
  }, [navigation, restaurant, dietFilter]);

  const handleAdd = useCallback(
    (dish: SpecialDish) => {
      addToCart(dish.id, dish.dishName, dish.price, '🍽️', restaurant.id);
    },
    [addToCart, restaurant.id],
  );

  const dishQuantity = useCallback(
    (id: string) => restaurantItems.find((i) => i.id === id)?.quantity ?? 0,
    [restaurantItems],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
        {/* AD BANNER HERO — light gray band, tap is a no-op inside Food */}
        <View style={[styles.heroContainer, { paddingTop: insets.top + vs(52) }]}>
          <AdBannerCarousel slides={topAdSlides} />
        </View>

        {/* OVERLAPPING WHITE BOARD */}
        <View style={styles.mainBoard}>
          {/* STORE INFO CARD */}
          <View style={styles.storeInfoRow}>
            <View style={styles.logoContainer}>
              <View style={styles.storeLogo}>
                <AppText style={styles.logoEmoji}>🍽️</AppText>
              </View>
              <View style={styles.ratingBadge}>
                <AppText style={styles.ratingText}>{restaurant.rating.toFixed(1)}</AppText>
                <Star color="#fff" fill="#fff" size={ms(10)} />
              </View>
            </View>

            <View style={styles.storeDetails}>
              <View style={styles.storeNameRow}>
                <AppText style={styles.storeName}>{restaurant.name}</AppText>
                <CheckCircle2 style={styles.verifiedIcon} color="#3B82F6" size={ms(16)} />
              </View>
              <AppText style={styles.storeSub}>{restaurant.cuisine}</AppText>

              <View style={styles.locationRow}>
                <MapPin color={foodTheme.primary} size={ms(14)} />
                <AppText style={styles.locationText}>
                  {restaurant.neighborhood} • {restaurant.distance.toFixed(1)} km away
                </AppText>
              </View>

              <View style={styles.timeRow}>
                <View style={styles.openBadge}>
                  <AppText style={styles.openText}>Open now</AppText>
                </View>
                <AppText style={styles.closeText}> • {restaurant.deliveryTime} delivery</AppText>
              </View>
            </View>
          </View>

          {/* HIGHLIGHTS ROW */}
          <View style={styles.highlightsContainer}>
            <View style={styles.highlightItem}>
              <View style={styles.iconCircle}>
                <Star color={foodTheme.primary} fill={foodTheme.primary} size={ms(16)} />
              </View>
              <AppText style={styles.highlightTitle}>{restaurant.rating.toFixed(1)} Rating</AppText>
              <AppText style={styles.highlightSub}>{restaurant.ratingCount / 1000}k+ reviews</AppText>
            </View>
            <View style={styles.highlightDivider} />
            <View style={styles.highlightItem}>
              <View style={styles.iconCircle}>
                <Clock color={foodTheme.primary} size={ms(16)} />
              </View>
              <AppText style={styles.highlightTitle}>{restaurant.deliveryTime}</AppText>
              <AppText style={styles.highlightSub}>Delivery time</AppText>
            </View>
            <View style={styles.highlightDivider} />
            <View style={styles.highlightItem}>
              <View style={styles.iconCircle}>
                <ShieldCheck color={foodTheme.primary} size={ms(16)} />
              </View>
              <AppText style={styles.highlightTitle}>Hygienic</AppText>
              <AppText style={styles.highlightSub}>FSSAI Certified</AppText>
            </View>
          </View>

          {restaurant.offerTag ? (
            <View style={styles.offerBanner}>
              <AppText style={styles.offerBannerText}>{restaurant.offerTag}</AppText>
            </View>
          ) : null}

          {/* RECOMMENDED & OFFERS — hidden when the active diet filter emptied it */}
          {restaurantDishes.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <AppText style={styles.sectionTitle}>Recommended & Offers</AppText>
                <TouchableOpacity
                  onPress={() => navigation.navigate('RestaurantOffers', { restaurant, offers: restaurantDishes })}
                  accessibilityRole="button"
                >
                  <AppText style={styles.seeAllText}>View All {'>'}</AppText>
                </TouchableOpacity>
              </View>

              <ScrollView
                contentContainerStyle={styles.discountScroll}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {restaurantDishes.map((item) => (
                  <View key={item.id} style={styles.discountCard}>
                    <View style={styles.discountImageWrap}>
                      <RemoteImage uri={item.image} variant="dish" style={styles.discountImage} />
                      <View style={styles.adLabelWrap}>
                        <AdLabelBadge />
                      </View>
                    </View>
                    <AppText numberOfLines={3} style={styles.productName}>
                      {item.dishName}
                    </AppText>
                    <View style={styles.priceRowHoriz}>
                      <View style={styles.priceCol}>
                        <AppText style={styles.oldPrice}>₹{Math.round(item.price * 1.2)}</AppText>
                        <AppText style={styles.newPrice}>₹{item.price}</AppText>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </>
          )}

          {/* MENU SECTION HEADER */}
          <View style={styles.menuHeaderContainer}>
            <AppText style={styles.sectionTitle}>Menu</AppText>
            <TouchableOpacity
              style={styles.menuSearchBox}
              onPress={openMenuSearch}
              accessibilityRole="button"
              accessibilityLabel="Search menu"
            >
              <Search color={foodTheme.textSecondary} size={ms(16)} />
              <AppText style={styles.menuSearchPlaceholder}>Search in menu</AppText>
            </TouchableOpacity>
          </View>

          {/* CATEGORY CHIPS */}
          <ScrollView
            contentContainerStyle={styles.categoryScroll}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {categories.map((cat) => {
              const isActive = active === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setActiveCategory(cat)}
                  style={[styles.categoryChip, isActive && styles.activeCategoryChip]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                >
                  <AppText style={[styles.categoryText, isActive && styles.activeCategoryText]}>
                    {cat}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* MENU LIST */}
          <View style={styles.productList}>
            {filteredMenu.map((item) => (
              <MenuItemRow
                key={item.id}
                dish={item}
                quantity={dishQuantity(item.id)}
                onAdd={() => handleAdd(item)}
                onIncrement={() => updateQuantity(item.id, 1)}
                onDecrement={() => updateQuantity(item.id, -1)}
              />
            ))}
            {filteredMenu.length === 0 && (
              <AppText style={styles.emptyText}>
                {dietFilter === 'veg'
                  ? 'No veg dishes in this menu.'
                  : dietFilter === 'nonveg'
                    ? 'No non-veg dishes in this menu.'
                    : 'No dishes available.'}
              </AppText>
            )}
          </View>

          {/* Padding for sticky footer */}
          <View style={styles.footerPad} />
        </View>
      </ScrollView>

      {/* PINNED TOP TOOLBAR — overlays hero + scrolled content */}
      <View style={[styles.header, { paddingTop: insets.top + vs(8) }]}>
        <TouchableOpacity
          style={styles.headerIconBg}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft color="#fff" size={ms(20)} />
        </TouchableOpacity>
        <DietToggle value={dietFilter} onChange={setDietFilter} />
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBg}
            onPress={openMenuSearch}
            accessibilityRole="button"
            accessibilityLabel="Search menu"
          >
            <Search color="#fff" size={ms(20)} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBg} accessibilityRole="button">
            <Share2 color="#fff" size={ms(20)} />
          </TouchableOpacity>
        </View>
      </View>

      {/* STICKY CART FOOTER — restaurant-scoped white pill, no orange card / amount */}
      {restaurantCartCount > 0 && (
        <ViewCartPill count={restaurantCartCount} onPress={openCart} />
      )}

      <FoodStatusBarStrip scrollY={scrollY} />
    </View>
  );
}

export default RestaurantProfileScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { paddingBottom: vs(40) },
  heroContainer: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: hs(16),
    paddingBottom: vs(52),
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: hs(16),
  },
  headerIconBg: { backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 20 },
  headerActions: { flexDirection: 'row', gap: 12 },
  mainBoard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -vs(40),
    paddingTop: vs(24),
  },
  storeInfoRow: {
    flexDirection: 'row',
    paddingHorizontal: hs(16),
    marginBottom: vs(20),
    alignItems: 'flex-start',
  },
  logoContainer: { position: 'relative', marginRight: hs(16) },
  storeLogo: {
    width: hs(72),
    height: hs(72),
    borderRadius: 36,
    borderWidth: 1,
    borderColor: '#eee',
    backgroundColor: foodTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: { fontSize: ms(30) },
  ratingBadge: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    backgroundColor: GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ratingText: { color: '#fff', fontSize: ms(10), fontWeight: 'bold', marginRight: 2 },
  storeDetails: { flex: 1 },
  storeNameRow: { flexDirection: 'row', alignItems: 'center' },
  storeName: { fontSize: ms(20), fontWeight: 'bold', color: foodTheme.textPrimary },
  verifiedIcon: { marginLeft: 6 },
  storeSub: { fontSize: ms(13), color: foodTheme.textSecondary, marginTop: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  locationText: { fontSize: ms(12), color: foodTheme.textPrimary, marginLeft: 4 },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  openBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  openText: { color: GREEN, fontSize: ms(10), fontWeight: '700' },
  closeText: { fontSize: ms(12), color: foodTheme.textSecondary, fontWeight: '500' },
  highlightsContainer: {
    flexDirection: 'row',
    marginHorizontal: hs(16),
    borderRadius: 16,
    paddingVertical: 16,
    justifyContent: 'space-evenly',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  highlightItem: { alignItems: 'center', flex: 1 },
  iconCircle: {
    width: hs(32),
    height: hs(32),
    borderRadius: 8,
    backgroundColor: foodTheme.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  highlightTitle: {
    fontSize: ms(12),
    fontWeight: 'bold',
    color: foodTheme.textPrimary,
    textAlign: 'center',
  },
  highlightSub: { fontSize: ms(10), color: foodTheme.textSecondary, textAlign: 'center', marginTop: 2 },
  highlightDivider: { width: 1, backgroundColor: '#F3F4F6' },
  offerBanner: {
    marginHorizontal: hs(16),
    marginTop: vs(16),
    backgroundColor: foodTheme.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  offerBannerText: { color: foodTheme.primaryDark, fontSize: ms(13), fontWeight: '700' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    marginBottom: 12,
    marginTop: vs(16),
  },
  sectionTitle: { fontSize: ms(16), fontWeight: 'bold', color: foodTheme.textPrimary },
  seeAllText: { fontSize: ms(13), color: foodTheme.primary, fontWeight: '600' },
  discountScroll: { paddingLeft: hs(16), paddingRight: hs(8) },
  discountCard: { width: 140, marginRight: 16 },
  discountImageWrap: { position: 'relative', marginBottom: 8 },
  discountImage: { width: '100%', aspectRatio: 1, borderRadius: 16 },
  adLabelWrap: { position: 'absolute', bottom: vs(4), right: hs(4) },
  productName: {
    fontSize: ms(13),
    color: foodTheme.textPrimary,
    fontWeight: '600',
    lineHeight: 18,
  },
  priceRowHoriz: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    justifyContent: 'space-between',
  },
  priceCol: { flexDirection: 'row', alignItems: 'center' },
  oldPrice: {
    fontSize: ms(12),
    color: foodTheme.textSecondary,
    textDecorationLine: 'line-through',
    marginRight: 4,
  },
  newPrice: { fontSize: ms(14), fontWeight: 'bold', color: RED },
  menuHeaderContainer: {
    paddingHorizontal: hs(16),
    marginTop: vs(28),
    marginBottom: 12,
    gap: vs(10),
  },
  menuSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: ms(12),
    minHeight: vs(44),
    paddingHorizontal: hs(14),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  menuSearchPlaceholder: {
    flex: 1,
    fontSize: ms(14),
    marginLeft: hs(8),
    color: foodTheme.textSecondary,
  },
  categoryScroll: {
    paddingHorizontal: hs(16),
    marginBottom: 12,
    alignItems: 'center',
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeCategoryChip: {
    backgroundColor: foodTheme.primarySoft,
    borderColor: foodTheme.primary,
  },
  categoryText: { fontSize: ms(14), color: foodTheme.textSecondary, fontWeight: '500' },
  activeCategoryText: { color: foodTheme.primary, fontWeight: 'bold' },
  productList: { paddingHorizontal: hs(16) },
  emptyText: { color: foodTheme.textSecondary, textAlign: 'center', marginVertical: 24 },
  footerPad: { height: vs(100) },
});
