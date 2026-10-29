import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import InfoButton from '@/components/shared/InfoButton';
import { useSharedValue } from 'react-native-reanimated';
import {
  ArrowLeft,
  Search,
  MapPin,
  Star,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import AppText from '@/components/AppText';
import { VendorReviewsSection } from '@/components/shared';
import CampaignHero from '@/components/shared/CampaignHero';
import { openHeroTarget } from '@/services/adsTarget';
import { useCampaignHero } from '@/hooks/useCampaignHero';
import type { HeroAd } from '@/services/api/GatewayClient';
import RemoteImage from '../components/RemoteImage';
import FoodStatusBarStrip from '../components/FoodStatusBarStrip';
import MenuItemRow from '../components/MenuItemRow';
import MenuCategoryRail from '../components/MenuCategoryRail';
import ViewCartPill from '../components/ViewCartPill';
import { foodTheme } from '../constants/theme';
import type { FoodStackParamList, RootStackParamList } from '@/navigation/types';
import type { SpecialDish } from '@data/types';
import { getOfferDishes, getMenuCategories } from '../utils/menu';
import { useRestaurantMenu } from '../hooks/useRestaurantMenu';
import { useBestCoupon } from '../hooks/useBestCoupon';
import { useCartStore } from '@/state/cartStore';
import { useFoodFilterStore, type DietFilter } from '@/state/foodFilterStore';
import { dishMatches } from '../utils/dietFilter';
import DietToggle from '../components/DietToggle';

type Props = NativeStackScreenProps<FoodStackParamList, 'RestaurantProfile'>;

const GREEN = '#16A34A';
const RED = '#DC2626';

export function RestaurantProfileScreen({ navigation, route }: Props) {
  const restaurant = route.params.restaurant;
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState('Bestsellers');

  // Screen-local diet override seeded once from the shared store. Toggling here
  // never writes back, so home/search keep their value; re-opening this screen
  // re-seeds from home ("follows home by default").
  const [dietFilter, setDietFilter] = useState<DietFilter>(
    () => useFoodFilterStore.getState().dietFilter,
  );

  // Paid STORE_TOP band owns its own fill; with none we drop the grey hero slab entirely rather
  // than leaving a dead band (CampaignHero itself collapses to `null`). The extra read is the same
  // anon, server-cached (`faazio:v1:ads:hero:…`) projection the hero renders from — no double POST.
  const { ads: storeTopAds } = useCampaignHero('STORE_TOP', { app: 'FOOD', storeId: restaurant.id });
  const hasHero = storeTopAds.length > 0;

  // Authoritative Food coupon for the offer slot (server-owned, strict). Falls back to the
  // decorative `offerTag` when there is no live coupon.
  const bestCoupon = useBestCoupon('FOOD');

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

  const { menu: dishes, loading: menuLoading } = useRestaurantMenu(restaurant);

  const menu = useMemo(
    () => dishes.filter((d) => dishMatches(dietFilter, d)),
    [dishes, dietFilter],
  );
  // `menu` is already the venue's own dishes (see useRestaurantMenu); only MRP-struck dishes are
  // offers — organic food is never paid and never earns the offers title.
  const offerDishes = useMemo(() => getOfferDishes(menu), [menu]);

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

  /** Offer-banner tap: open the scoped cart with the live coupon pre-loaded (validated there). */
  const applyCouponInCart = useCallback(() => {
    navigation
      .getParent<NativeStackNavigationProp<RootStackParamList>>()
      ?.navigate('Cart', {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        couponCode: bestCoupon?.code,
      });
  }, [navigation, restaurant.id, restaurant.name, bestCoupon?.code]);

  const openMenuSearch = useCallback(() => {
    navigation.navigate('RestaurantMenu', { restaurant, dietFilter });
  }, [navigation, restaurant, dietFilter]);

  const openRateVendor = useCallback(() => {
    navigation
      .getParent<NativeStackNavigationProp<RootStackParamList>>()
      ?.navigate('RateVendor', { vendorId: restaurant.id, vendorName: restaurant.name });
  }, [navigation, restaurant.id, restaurant.name]);

  const handleAdd = useCallback(
    (dish: SpecialDish) => {
      addToCart(dish.id, dish.dishName, dish.price, '🍽️', restaurant.id);
    },
    [addToCart, restaurant.id],
  );

  /** Paid STORE_TOP tap-through on this restaurant page: product/dish → PDP; other venues no-op. */
  const handleHeroPress = useCallback(
    (ad: HeroAd) => {
      void openHeroTarget(ad, {
        onProduct: (product) =>
          navigation
            .getParent<NativeStackNavigationProp<RootStackParamList>>()
            ?.navigate('ProductDetail', { product }),
        onStore: () => {},
        onVenue: () => {},
      });
    },
    [navigation],
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
        {/* AD BANNER HERO — paid STORE_TOP placement (whole band drops when no LIVE fill) */}
        {hasHero ? (
          <View style={[styles.heroContainer, { paddingTop: insets.top + vs(52) }]}>
            <CampaignHero
              placement="STORE_TOP"
              app="FOOD"
              storeId={restaurant.id}
              onPress={handleHeroPress}
            />
          </View>
        ) : (
          <View style={{ height: insets.top + vs(52) }} />
        )}

        {/* OVERLAPPING WHITE BOARD */}
        <View style={[styles.mainBoard, !hasHero && styles.mainBoardFlat]}>
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

              <View style={styles.statusRow}>
                <View style={styles.openBadge}>
                  <AppText style={styles.openText}>Open now</AppText>
                </View>
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
                <ShieldCheck color={foodTheme.primary} size={ms(16)} />
              </View>
              <AppText style={styles.highlightTitle}>Hygienic</AppText>
              <AppText style={styles.highlightSub}>FSSAI Certified</AppText>
            </View>
          </View>

          {bestCoupon ? (
            <TouchableOpacity
              style={styles.offerBanner}
              onPress={applyCouponInCart}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Apply coupon ${bestCoupon.code} in cart`}
            >
              <AppText style={styles.offerBannerText}>
                {bestCoupon.code} ·{' '}
                {bestCoupon.freeDelivery ? 'Free delivery' : `${bestCoupon.valuePercent}% OFF`}
                {bestCoupon.minOrder > 0 ? ` · min ₹${bestCoupon.minOrder}` : ''}
              </AppText>
            </TouchableOpacity>
          ) : restaurant.offerTag ? (
            <View style={styles.offerBanner}>
              <AppText style={styles.offerBannerText}>{restaurant.offerTag}</AppText>
            </View>
          ) : null}

          <VendorReviewsSection
            vendorId={restaurant.id}
            accentColor={foodTheme.primary}
            onRatePress={openRateVendor}
            style={styles.reviewsSection}
          />

          {/* RECOMMENDED & OFFERS — discounted dishes only; hidden when there's nothing on offer */}
          {offerDishes.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <AppText style={styles.sectionTitle}>Recommended & Offers</AppText>
                <TouchableOpacity
                  onPress={() => navigation.navigate('RestaurantOffers', { restaurant, offers: offerDishes })}
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
                {offerDishes.map((item) => (
                  <View key={item.id} style={styles.discountCard}>
                    <View style={styles.discountImageWrap}>
                      <RemoteImage uri={item.image} variant="dish" style={styles.discountImage} />
                    </View>
                    <AppText numberOfLines={3} style={styles.productName}>
                      {item.dishName}
                    </AppText>
                    <View style={styles.priceRowHoriz}>
                      <View style={styles.priceCol}>
                        {item.mrp !== undefined && item.mrp > item.price ? (
                          <AppText style={styles.oldPrice}>₹{item.mrp}</AppText>
                        ) : null}
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
          <MenuCategoryRail
            categories={categories}
            active={active}
            onSelect={setActiveCategory}
            style={styles.categoryRail}
          />

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
              menuLoading ? (
                <ActivityIndicator
                  color={foodTheme.primary}
                  style={styles.menuLoading}
                  accessibilityLabel="Loading menu"
                />
              ) : (
                <AppText style={styles.emptyText}>
                  {dietFilter === 'veg'
                    ? 'No veg dishes in this menu.'
                    : dietFilter === 'nonveg'
                      ? 'No non-veg dishes in this menu.'
                      : 'No dishes available.'}
                </AppText>
              )
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
          <InfoButton contentKey="RestaurantProfile" color="#ffffff" backgroundColor="rgba(0,0,0,0.5)" />
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
  scrollContent: { paddingBottom: SPACE.LIST_BOTTOM },
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
    marginTop: -vs(24),
    paddingTop: SPACE.SECTION,
  },
  mainBoardFlat: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    marginTop: 0,
  },
  storeInfoRow: {
    flexDirection: 'row',
    paddingHorizontal: hs(16),
    marginBottom: SPACE.SECTION,
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
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  openBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  openText: { color: GREEN, fontSize: ms(10), fontWeight: '700' },
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
    marginTop: SPACE.BLOCK,
    backgroundColor: foodTheme.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  offerBannerText: { color: foodTheme.primaryDark, fontSize: ms(13), fontWeight: '700' },
  reviewsSection: { paddingHorizontal: hs(16), marginTop: SPACE.SECTION },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    marginBottom: 12,
    marginTop: SPACE.SECTION,
  },
  sectionTitle: { fontSize: ms(16), fontWeight: 'bold', color: foodTheme.textPrimary },
  seeAllText: { fontSize: ms(13), color: foodTheme.primary, fontWeight: '600' },
  discountScroll: { paddingLeft: hs(16), paddingRight: hs(8) },
  discountCard: { width: 140, marginRight: 16 },
  discountImageWrap: { position: 'relative', marginBottom: 8 },
  discountImage: { width: '100%', aspectRatio: 1, borderRadius: 16 },
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
    marginTop: SPACE.SECTION,
    marginBottom: 12,
    gap: SPACE.BLOCK,
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
  categoryRail: { marginBottom: 12 },
  productList: { paddingHorizontal: hs(16) },
  emptyText: { color: foodTheme.textSecondary, textAlign: 'center', marginVertical: 24 },
  menuLoading: { marginVertical: 24 },
  footerPad: { height: vs(100) },
});
