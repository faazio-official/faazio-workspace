import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
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
  MoreVertical,
  MapPin,
  Star,
  Plus,
  Minus,
  ShoppingCart,
  ArrowRight,
  ShieldCheck,
  Clock,
  CheckCircle2,
} from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import AppText from '@/components/AppText';
import AdLabelBadge from '@/components/shared/AdLabelBadge';
import RemoteImage from '../components/RemoteImage';
import FoodStatusBarStrip from '../components/FoodStatusBarStrip';
import { foodTheme } from '../constants/theme';
import type { FoodStackParamList, RootStackParamList } from '@/navigation/types';
import type { DiningRestaurant } from '../mocks/types';
import type { SpecialDish } from '@data/types';
import { TODAYS_SPECIALS } from '@data/food/specials';
import { restaurantMenus } from '@data/food/menus';
import { useCartStore } from '@/state/cartStore';
import { useFoodFilterStore, type DietFilter } from '@/state/foodFilterStore';
import { dishMatches } from '../utils/dietFilter';
import DietToggle from '../components/DietToggle';

type Props = NativeStackScreenProps<FoodStackParamList, 'RestaurantProfile'>;

const GREEN = '#16A34A';
const RED = '#DC2626';

/** Build the restaurant's menu from its per-restaurant menu first (so each dining
 *  room shows its own dishes), falling back to matching the shared specials
 *  catalog by cuisine and padding with the remaining dishes so every restaurant
 *  has a full menu. */
function getMenuForRestaurant(restaurant: DiningRestaurant): SpecialDish[] {
  const own = restaurantMenus[restaurant.name];
  if (own && own.length > 0) return own;
  const cuisines = restaurant.cuisines.map((c) => c.toLowerCase());
  const matched = TODAYS_SPECIALS.filter((d) =>
    cuisines.some((c) => (d.cuisine ?? '').toLowerCase().includes(c) || c.includes((d.cuisine ?? '').toLowerCase())),
  );
  const rest = TODAYS_SPECIALS.filter((d) => !matched.includes(d));
  return [...matched, ...rest];
}

/** All dishes in the restaurant's menu that belong to the current restaurant —
 *  the only content the "Recommended & Offers" rail / page should show. */
function getOwnDishes(menu: SpecialDish[], restaurantName: string): SpecialDish[] {
  return menu.filter((d) => d.restaurant === restaurantName);
}

export function RestaurantProfileScreen({ navigation, route }: Props) {
  const restaurant = route.params?.restaurant as DiningRestaurant;
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState('Bestsellers');
  const [searchQuery, setSearchQuery] = useState('');

  // Screen-local diet override seeded once from the shared store. Toggling here
  // never writes back, so home/search keep their value; re-opening this screen
  // re-seeds from home ("follows home by default").
  const [dietFilter, setDietFilter] = useState<DietFilter>(
    () => useFoodFilterStore.getState().dietFilter,
  );

  const scrollRef = useRef<ScrollView>(null);
  const menuSearchRef = useRef<TextInput>(null);
  const boardYRef = useRef(0);
  const menuHeaderYRef = useRef(0);
  const menuSearchYRef = useRef(0);

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
    () => ['Bestsellers', ...restaurant.cuisines],
    [restaurant],
  );

  const filteredMenu = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base =
      activeCategory === 'Bestsellers'
        ? menu
        : menu.filter(
            (d) => (d.cuisine ?? '').toLowerCase() === activeCategory.toLowerCase(),
          );
    if (!q) return base;
    return base.filter(
      (d) =>
        d.dishName.toLowerCase().includes(q) ||
        (d.description ?? '').toLowerCase().includes(q),
    );
  }, [menu, activeCategory, searchQuery]);

  const openCart = useCallback(() => {
    navigation
      .getParent<NativeStackNavigationProp<RootStackParamList>>()
      ?.navigate('Cart', { restaurantId: restaurant.id, restaurantName: restaurant.name });
  }, [navigation, restaurant.id, restaurant.name]);

  // Toolbar search icon → park the menu search bar just under the pinned
  // toolbar, then focus it (works from any scroll offset; scrollTo clamps).
  const focusMenuSearch = useCallback(() => {
    const clearance = insets.top + vs(64);
    const y = Math.max(
      0,
      boardYRef.current + menuHeaderYRef.current + menuSearchYRef.current - clearance,
    );
    scrollRef.current?.scrollTo({ y, animated: true });
    menuSearchRef.current?.focus();
  }, [insets.top]);

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
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
        {/* HERO IMAGE BACKGROUND */}
        <View style={styles.heroContainer}>
          <RemoteImage uri={restaurant.image} variant="restaurant" style={styles.heroImage} />
          <View style={styles.heroOverlay} />
        </View>

        {/* OVERLAPPING WHITE BOARD */}
        <View
          style={styles.mainBoard}
          onLayout={(e) => {
            boardYRef.current = e.nativeEvent.layout.y;
          }}
        >
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
          <View
            style={styles.menuHeaderContainer}
            onLayout={(e) => {
              menuHeaderYRef.current = e.nativeEvent.layout.y;
            }}
          >
            <AppText style={styles.sectionTitle}>Menu</AppText>
            <View
              style={styles.menuSearchBox}
              onLayout={(e) => {
                menuSearchYRef.current = e.nativeEvent.layout.y;
              }}
            >
              <Search color={foodTheme.textSecondary} size={ms(16)} />
              <TextInput
                ref={menuSearchRef}
                placeholder="Search in menu"
                placeholderTextColor={foodTheme.textSecondary}
                style={styles.menuSearchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
            </View>
          </View>

          {/* CATEGORY CHIPS */}
          <ScrollView
            contentContainerStyle={styles.categoryScroll}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {categories.map((cat) => {
              const active = activeCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setActiveCategory(cat)}
                  style={[styles.categoryChip, active && styles.activeCategoryChip]}
                  accessibilityRole="button"
                >
                  <AppText style={[styles.categoryText, active && styles.activeCategoryText]}>
                    {cat}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* MENU LIST */}
          <View style={styles.productList}>
            {filteredMenu.map((item) => {
              const qty = dishQuantity(item.id);
              const isAdded = qty > 0;
              return (
                <View key={item.id} style={styles.listCard}>
                  <View style={styles.listDetails}>
                    <AppText style={styles.listTitle}>{item.dishName}</AppText>
                    <AppText numberOfLines={2} style={styles.listDesc}>
                      {item.description}
                    </AppText>
                    <AppText style={styles.listPrice}>₹{item.price}</AppText>
                  </View>
                  <View style={styles.listImageWrapper}>
                    <RemoteImage uri={item.image} variant="dish" style={styles.listImage} />
                    {isAdded ? (
                      <View style={styles.qtyStepper}>
                        <TouchableOpacity
                          style={styles.qtyStepperBtn}
                          onPress={() => updateQuantity(item.id, -1)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Decrease quantity of ${item.dishName}`}
                        >
                          <Minus color={foodTheme.primary} size={ms(14)} />
                        </TouchableOpacity>
                        <AppText style={styles.qtyStepperValue}>{qty}</AppText>
                        <TouchableOpacity
                          style={styles.qtyStepperBtn}
                          onPress={() => updateQuantity(item.id, 1)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Increase quantity of ${item.dishName}`}
                        >
                          <Plus color={foodTheme.primary} size={ms(14)} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.addBtnOutline}
                        onPress={() => handleAdd(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${item.dishName}`}
                      >
                        <Plus color={foodTheme.primary} size={ms(14)} style={styles.addBtnPlus} />
                        <AppText style={styles.addBtnOutlineText}>Add</AppText>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
            {filteredMenu.length === 0 && (
              <AppText style={styles.emptyText}>
                {searchQuery.trim()
                  ? 'No dishes match your search.'
                  : dietFilter === 'veg'
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
            onPress={focusMenuSearch}
            accessibilityRole="button"
            accessibilityLabel="Search menu"
          >
            <Search color="#fff" size={ms(20)} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBg} accessibilityRole="button">
            <Share2 color="#fff" size={ms(20)} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBg} accessibilityRole="button">
            <MoreVertical color="#fff" size={ms(20)} />
          </TouchableOpacity>
        </View>
      </View>

      {/* STICKY CART FOOTER — restaurant-scoped white pill, no orange card / amount */}
      {restaurantCartCount > 0 && (
        <View style={styles.stickyFooterWrapper}>
          <TouchableOpacity
            style={styles.viewCartBtn}
            onPress={openCart}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={`View cart, ${restaurantCartCount} ${restaurantCartCount === 1 ? 'item' : 'items'}`}
          >
            <ShoppingCart color={foodTheme.primary} size={ms(18)} />
            <AppText style={styles.viewCartText}>View Cart</AppText>
            <View style={styles.viewCartDivider} />
            <AppText style={styles.viewCartCount}>
              {restaurantCartCount} {restaurantCartCount === 1 ? 'item' : 'items'}
            </AppText>
            <ArrowRight color={foodTheme.primary} size={ms(16)} />
          </TouchableOpacity>
        </View>
      )}

      <FoodStatusBarStrip scrollY={scrollY} />
    </View>
  );
}

export default RestaurantProfileScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { paddingBottom: vs(40) },
  heroContainer: { height: vs(260), position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.4)',
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
  menuSearchInput: { flex: 1, fontSize: ms(14), marginLeft: hs(8), color: foodTheme.textPrimary, padding: 0 },
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
  listCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 24,
  },
  listDetails: { flex: 1, paddingRight: 16 },
  listTitle: { fontSize: ms(16), fontWeight: 'bold', color: foodTheme.textPrimary, marginBottom: 4 },
  listDesc: { fontSize: ms(13), color: foodTheme.textSecondary, lineHeight: 18, marginBottom: 8 },
  listPrice: { fontSize: ms(15), fontWeight: 'bold', color: foodTheme.textPrimary },
  listImageWrapper: { alignItems: 'center' },
  listImage: { width: 110, height: 110, borderRadius: 16, backgroundColor: '#F3F4F6' },
  addBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: foodTheme.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: -14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addBtnPlus: { marginRight: 2 },
  addBtnOutlineText: { color: foodTheme.primary, fontWeight: 'bold', fontSize: 14 },
  qtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: foodTheme.primary,
    borderRadius: 8,
    marginTop: -14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  qtyStepperBtn: {
    paddingHorizontal: hs(12),
    paddingVertical: vs(6),
  },
  qtyStepperValue: {
    minWidth: ms(24),
    textAlign: 'center',
    color: foodTheme.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyText: { color: foodTheme.textSecondary, textAlign: 'center', marginVertical: 24 },
  footerPad: { height: vs(100) },
  stickyFooterWrapper: { position: 'absolute', bottom: vs(20), left: hs(16), right: hs(16) },
  viewCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(8),
    backgroundColor: '#fff',
    paddingHorizontal: hs(16),
    paddingVertical: vs(12),
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  viewCartText: { color: foodTheme.primary, fontSize: ms(14), fontWeight: 'bold' },
  viewCartDivider: { width: 1, height: vs(16), backgroundColor: '#E5E7EB' },
  viewCartCount: { color: foodTheme.primary, fontSize: ms(14), fontWeight: 'bold' },
});
