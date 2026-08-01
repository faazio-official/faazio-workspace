import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Image, TouchableOpacity,
  TextInput, Animated, Modal,
} from 'react-native';
import {
  Search, ChevronRight, Clock, Star, CheckCircle, ArrowLeft, Check, Sparkles,
  Heart, Users,
} from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { topOfWeekDishes } from '@data/food/products';
import { foodStores } from '@data/food/stores';
import { addBooking, getBookings } from './bookingStore';
import StoreCardBase from '@/components/shared/StoreCardBase';
import FoodProductCard from '@/components/shared/FoodProductCard';

const BOOKING_DISHES_DB = [
  {
    id: 'bd-1',
    name: 'Garasen Vegetarian Platter',
    restaurant: 'The Green Garden Bistro',
    category: 'Vegan',
    tab: 'Dinner',
    rating: '4.9',
    tags: 'Vegetables • Salad • Hummus',
    price: '₹250',
    emoji: '🥗',
    isSpecial: true,
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=400&h=300',
  },
  {
    id: 'bd-2',
    name: 'Pesto Vegan Penne',
    restaurant: 'The Green Garden Bistro',
    category: 'Vegan',
    tab: 'Dinner',
    rating: '4.8',
    tags: 'Pasta • Organic • Greens',
    price: '₹320',
    emoji: '🍝',
    isSpecial: false,
    image: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&q=80&w=400&h=300',
  },
  {
    id: 'bd-3',
    name: 'Neapolitan Margherita Pizza',
    restaurant: 'Milano Pizza & Pasta Co.',
    category: 'Pizza',
    tab: 'Dinner',
    rating: '4.9',
    tags: 'Cheese • Tomato • Basil',
    price: '₹380',
    emoji: '🍕',
    isSpecial: true,
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=400&h=300',
  },
  {
    id: 'bd-4',
    name: 'Spicy Truffle Pizza',
    restaurant: 'Milano Pizza & Pasta Co.',
    category: 'Pizza',
    tab: 'Dinner',
    rating: '4.7',
    tags: 'Mushroom • Arugula • Truffle',
    price: '₹450',
    emoji: '🍕',
    isSpecial: false,
    image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&q=80&w=400&h=300',
  },
  {
    id: 'bd-5',
    name: 'Omahs Salmon Sushi Rolls',
    restaurant: 'Kyoto House Sushi Bar',
    category: 'Sushi',
    tab: 'Dinner',
    rating: '4.9',
    tags: 'Raw Fish • Rice • Wasabi',
    price: '₹490',
    emoji: '🍣',
    isSpecial: true,
    image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&q=80&w=400&h=300',
  },
  {
    id: 'bd-6',
    name: 'Premium Classic Hot Dog',
    restaurant: 'Broadway Diner & Hotdogs',
    category: 'Hot Dog',
    tab: 'Dinner',
    rating: '4.6',
    tags: 'Sausage • Mustard • Relish',
    price: '₹190',
    emoji: '🌭',
    isSpecial: false,
    image: 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?auto=format&fit=crop&q=80&w=400&h=300',
  },
  {
    id: 'bd-7',
    name: 'Morning Berry Granola',
    restaurant: 'Aura Organic Kitchen',
    category: 'Vegan',
    tab: 'Breakfast',
    rating: '4.8',
    tags: 'Yogurt • Oats • Mixed Berries',
    price: '₹180',
    emoji: '🥣',
    isSpecial: true,
    image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&q=80&w=400&h=300',
  },
  {
    id: 'bd-8',
    name: 'English Toast & Hash Combo',
    restaurant: 'Aura Organic Kitchen',
    category: 'Hot Dog',
    tab: 'Breakfast',
    rating: '4.7',
    tags: 'Eggs • Bacon • Beans',
    price: '₹220',
    emoji: '🍳',
    isSpecial: false,
    image: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&q=80&w=400&h=300',
  }
];

export function FoodScreen({ addToCart, activeSubMode, setActiveSubMode, onProductClick, searchFocusedInitially }: any) {
  const effectiveMode = activeSubMode || 'order';
  const searchRef = useRef<TextInput>(null);

  useEffect(() => {
    if (searchFocusedInitially && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 300);
    }
  }, [searchFocusedInitially]);

  const [searchQuery, setSearchQuery] = useState('');
  const [addedId, setAddedId] = useState<string | null>(null);

  const orderAnim = useRef(new Animated.Value(effectiveMode === 'order' ? 1 : 0)).current;
  const bookingAnim = useRef(new Animated.Value(effectiveMode === 'booking' ? 1 : 0)).current;

  const [selectedStore, setSelectedStore] = useState<any>(null);
  const [vegFilter, setVegFilter] = useState(false);
  const [timeFilter, setTimeFilter] = useState(false);
  const [sortBy, setSortBy] = useState<'rating' | 'delivery' | 'distance'>('rating');

  const [selectedBookingTab, setSelectedBookingTab] = useState('Dinner');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [selectedTime, setSelectedTime] = useState('19:00');
  const [guestsCount, setGuestsCount] = useState(2);
  const [bookingFormOpen, setBookingFormOpen] = useState(false);
  const [selectedBookingDish, setSelectedBookingDish] = useState<any>(null);
  const [addedRecommendedIds, setAddedRecommendedIds] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState('Vegan');
  const [bookingConfirmed, setBookingConfirmed] = useState<string | null>(null);
  const [promoAdded, setPromoAdded] = useState(false);

  const tabUnderlineAnim = useRef(new Animated.Value(0)).current;
  const tabPositions = useRef<number[]>([]);

  const storeOfferPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(storeOfferPulse, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
        Animated.timing(storeOfferPulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const handleAddToCartWithFeedback = (id: string, name: string, price: number, emoji: string) => {
    if (addToCart) addToCart(id, name, price, emoji);
    setAddedId(id);
    setTimeout(() => setAddedId(null), 1500);
  };

  const crossfadeTo = (mode: 'order' | 'booking') => {
    if (setActiveSubMode) setActiveSubMode(mode);
    Animated.parallel([
      Animated.timing(orderAnim, { toValue: mode === 'order' ? 1 : 0, duration: 250, useNativeDriver: true }),
      Animated.timing(bookingAnim, { toValue: mode === 'booking' ? 1 : 0, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const handlePromoOrder = () => {
    if (addToCart) addToCart('tow-special', 'Chicken Teriyaki', 280, '🍱');
    setAddedId('tow-special');
    setPromoAdded(true);
    setTimeout(() => { setAddedId(null); setPromoAdded(false); }, 1500);
  };

  let filteredStores = [...foodStores];
  if (vegFilter) filteredStores = filteredStores.filter(s => s.isVeg);
  if (timeFilter) filteredStores = filteredStores.filter(s => parseInt(s.deliveryTime) < 30);
  if (sortBy === 'rating') filteredStores.sort((a, b) => b.rating - a.rating);
  else if (sortBy === 'delivery') filteredStores.sort((a, b) => parseInt(a.deliveryTime) - parseInt(b.deliveryTime));
  else if (sortBy === 'distance') filteredStores.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

  const hasFilters = vegFilter || timeFilter || sortBy !== 'rating';

  const topOfWeekFiltered = topOfWeekDishes.filter(item => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return item.name.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q);
  });

  const formatDisplayDate = (dateStr: string) => {
    const today = new Date();
    const date = new Date(dateStr + 'T00:00:00');
    const diff = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const handleTabLayout = (idx: number, x: number) => {
    tabPositions.current[idx] = x;
  };

  const handleTabPress = (tab: string, idx: number) => {
    setSelectedBookingTab(tab);
    if (tabPositions.current[idx] !== undefined) {
      Animated.spring(tabUnderlineAnim, {
        toValue: tabPositions.current[idx],
        useNativeDriver: true,
        stiffness: 300,
        damping: 30,
      }).start();
    }
  };

  const handleConfirmBooking = () => {
    const orderId = addBooking({
      dish: {
        id: selectedBookingDish.id,
        name: selectedBookingDish.name,
        price: selectedBookingDish.price,
        emoji: selectedBookingDish.emoji,
      },
      guests: guestsCount,
      date: selectedDate,
      time: selectedTime,
      addedRecommendedIds,
    });
    setBookingConfirmed(orderId);
    setTimeout(() => {
      setBookingConfirmed(null);
      setBookingFormOpen(false);
    }, 5000);
  };

  const bookingDishesList = BOOKING_DISHES_DB.filter(d => {
    if (d.tab !== selectedBookingTab) return false;
    if (activeCategory === 'Vegan') return d.category === 'Vegan';
    if (activeCategory === 'Pizza') return d.category === 'Pizza';
    if (activeCategory === 'Sushi') return d.category === 'Sushi';
    if (activeCategory === 'Hot Dog') return d.category === 'Hot Dog';
    return true;
  });

  const timeSlots = [
    { value: '18:00', label: 'Early' },
    { value: '19:00', label: 'Sunset' },
    { value: '20:00', label: 'Prime' },
    { value: '21:00', label: 'Late' },
  ];

  const guestOptions = [1, 2, 4, 6, 8];

  const handleStoreProductClick = (item: any) => {
    if (onProductClick) {
      onProductClick({ ...item, price: Math.floor(item.price / 10), app: 'FOOD' });
    }
  };

  return (
    <View style={styles.container}>
      {/* Mode Toggle */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeBtn, effectiveMode === 'order' && styles.modeBtnActive]}
          onPress={() => crossfadeTo('order')}
          activeOpacity={0.8}
        >
          <Text style={[styles.modeBtnText, effectiveMode === 'order' && styles.modeBtnTextActive]}>Order</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, effectiveMode === 'booking' && styles.modeBtnActive]}
          onPress={() => crossfadeTo('booking')}
          activeOpacity={0.8}
        >
          <Text style={[styles.modeBtnText, effectiveMode === 'booking' && styles.modeBtnTextActive]}>Dinner Booking</Text>
        </TouchableOpacity>
      </View>

      {/* Order Mode */}
      <Animated.View style={[styles.modeContainer, { opacity: orderAnim, transform: [{ translateY: orderAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]} pointerEvents={effectiveMode === 'order' ? 'auto' : 'none'}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.orderContent}>
          {/* Search */}
          <View style={styles.searchWrap}>
            <Search size={ms(14)} color="#94a3b8" style={styles.searchIcon} />
            <TextInput
              ref={searchRef}
              style={styles.searchInput}
              placeholder="Search on Food"
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Promo Card Redesign */}
          <View style={styles.promoCard}>
            <View style={styles.promoLeft}>
              <View style={styles.discountChip}>
                <Text style={styles.discountChipText}>Discount 25%</Text>
              </View>
              <Text style={styles.promoTitle}>Chicken Teriyaki</Text>
              <Text style={styles.promoDesc}>Savory grilled chicken with teriyaki glaze</Text>
              <TouchableOpacity
                style={[styles.orderNowBtn, promoAdded && styles.orderNowBtnAdded]}
                onPress={handlePromoOrder}
                activeOpacity={0.8}
              >
                {promoAdded ? (
                  <Check size={ms(14)} color="#ffffff" strokeWidth={3} />
                ) : (
                  <Text style={styles.orderNowBtnText}>Order Now</Text>
                )}
              </TouchableOpacity>
            </View>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1598514982205-f36b96d1e8dd?auto=format&fit=crop&q=80&w=200&h=200' }}
              style={styles.promoImage}
            />
          </View>

          {/* Top of Week Rail */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Top of Week</Text>
            <Text style={styles.sectionSubtitle}>Explore Menus</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railScroll}>
            {topOfWeekFiltered.map((item) => {
              const isAdded = addedId === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.railCard}
                  onPress={() => handleStoreProductClick(item)}
                  activeOpacity={0.9}
                >
                  <Image source={{ uri: item.image }} style={styles.railImage} />
                  <View style={styles.railInfo}>
                    <Text style={styles.railName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.railPrice}>₹{item.price}</Text>
                    <TouchableOpacity
                      style={[styles.railAddBtn, isAdded && styles.railAddBtnAdded]}
                      onPress={() => handleAddToCartWithFeedback(item.id, item.name, item.price, item.emoji)}
                      activeOpacity={0.8}
                    >
                      {isAdded ? <Check size={ms(12)} color="#ffffff" strokeWidth={3} /> : <Text style={styles.railAddBtnText}>ADD</Text>}
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Restaurant Directory */}
          {!selectedStore ? (
            <>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Top Restaurants Near You</Text>
                <Text style={styles.sectionSubtitle}>({foodStores.length})</Text>
              </View>

              {/* Filter toggles */}
              <View style={styles.filterRow}>
                <TouchableOpacity
                  style={[styles.filterPill, vegFilter && styles.filterPillActive]}
                  onPress={() => setVegFilter(!vegFilter)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterPillText, vegFilter && styles.filterPillTextActive]}>🌱 Pure Veg</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterPill, timeFilter && styles.filterPillActive]}
                  onPress={() => setTimeFilter(!timeFilter)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterPillText, timeFilter && styles.filterPillTextActive]}>⚡ Under-30 mins</Text>
                </TouchableOpacity>
                {hasFilters && (
                  <TouchableOpacity
                    style={styles.clearAllPill}
                    onPress={() => { setVegFilter(false); setTimeFilter(false); setSortBy('rating'); }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.clearAllText}>Clear All</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Sort segment */}
              <View style={styles.sortRow}>
                {(['rating', 'delivery', 'distance'] as const).map((s) => {
                  const labels = { rating: '⭐ Rating', delivery: '🕒 Delivery', distance: '📍 Distance' };
                  const isActiveSort = sortBy === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[styles.sortPill, isActiveSort && styles.sortPillActive]}
                      onPress={() => setSortBy(s)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.sortPillText, isActiveSort && styles.sortPillTextActive]}>{labels[s]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Store Cards */}
              {filteredStores.map((store) => (
                <StoreCardBase
                  key={store.id}
                  store={store}
                  variant="food"
                  onPress={() => setSelectedStore(store)}
                />
              ))}
            </>
          ) : (
            /* Store Drill-In */
            <View>
              <TouchableOpacity
                style={styles.backPill}
                onPress={() => setSelectedStore(null)}
                activeOpacity={0.8}
              >
                <ArrowLeft size={ms(14)} color="#ffffff" />
                <Text style={styles.backPillText}>{selectedStore.name}</Text>
              </TouchableOpacity>

              <View style={styles.storeHero}>
                <Image source={{ uri: selectedStore.coverImage }} style={styles.storeHeroImage} />
                <View style={styles.storeHeroGradient} />
                <View style={styles.floatingRatingBadge}>
                  <Star size={ms(10)} color="#f59e0b" fill="#f59e0b" />
                  <Text style={styles.floatingRatingText}>{selectedStore.rating}</Text>
                </View>
                {selectedStore.offerTag && (
                  <Animated.View style={[styles.pulsingOfferTag, { opacity: storeOfferPulse }]}>
                    <Text style={styles.pulsingOfferText}>{selectedStore.offerTag}</Text>
                  </Animated.View>
                )}
                <View style={styles.storeEmojiTile}>
                  <Text style={styles.storeEmojiTileText}>{selectedStore.emoji}</Text>
                </View>
              </View>

              <Text style={styles.storeMenuTitle}>Menu</Text>
              <View style={styles.storeMenuGrid}>
                {topOfWeekDishes.map((dish) => (
                  <FoodProductCard
                    key={dish.id}
                    product={{ id: dish.id, name: dish.name, price: dish.price, emoji: dish.emoji, image: dish.image, desc: dish.desc, rating: typeof dish.rating === 'string' ? parseFloat(dish.rating) : dish.rating, app: 'FOOD', category: 'Featured' }}
                    isAdded={addedId === dish.id}
                    onPress={() => handleStoreProductClick(dish)}
                    onAdd={() => handleAddToCartWithFeedback(dish.id, dish.name, dish.price, dish.emoji)}
                  />
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* Booking Mode */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: bookingAnim, transform: [{ translateY: bookingAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]} pointerEvents={effectiveMode === 'booking' ? 'auto' : 'none'}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.bookingContent}>
          {/* Header */}
          <View style={styles.bookingHeader}>
            <View style={styles.bookingHeaderTop}>
              <View style={styles.avatarRow}>
                <View style={styles.avatarWrap}>
                  <Image
                    source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150&h=150' }}
                    style={styles.avatarImg}
                  />
                  <View style={styles.onlineDot} />
                </View>
                <View>
                  <Text style={styles.greetText}>Let's order a food,</Text>
                  <Text style={styles.userNameText}>Faizal Basha</Text>
                </View>
              </View>
              <View style={styles.cartCircle}>
                <Text style={styles.cartEmoji}>🛒</Text>
              </View>
            </View>

            {/* Search Row */}
            <View style={styles.bookingSearchRow}>
              <TouchableOpacity onPress={() => crossfadeTo('order')}>
                <ArrowLeft size={ms(16)} color="#ffffff" />
              </TouchableOpacity>
              <View style={styles.bookingSearchInputWrap}>
                <TextInput
                  style={styles.bookingSearchInput}
                  placeholder="Find for food or resto ..."
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.settingsChip}>
                <Text style={styles.settingsChipText}>⚙️</Text>
              </View>
            </View>

            {/* Tabs */}
            <View style={styles.bookingTabsRow}>
              {['Breakfast', 'Dinner', 'Have Lunch'].map((tab, idx) => {
                const isActive = selectedBookingTab === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    style={styles.bookingTab}
                    onPress={() => handleTabPress(tab, idx)}
                    onLayout={(e) => handleTabLayout(idx, e.nativeEvent.layout.x)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.bookingTabText, isActive && styles.bookingTabTextActive]}>{tab}</Text>
                    {isActive && (
                      <View style={styles.tabBadge24}>
                        <Text style={styles.tabBadge24Text}>24</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <Animated.View style={[styles.bookingTabUnderline, { transform: [{ translateX: tabUnderlineAnim }] }]} />
          </View>

          {/* Floating Category Bubbles */}
          <View style={styles.categoryBubblesCard}>
            {['Vegan', 'Pizza', 'Sushi', 'Hot Dog'].map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryBubble, isActive && styles.categoryBubbleActive]}
                  onPress={() => setActiveCategory(cat)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.categoryBubbleText}>{cat === 'Vegan' ? '🥬' : cat === 'Pizza' ? '🍕' : cat === 'Sushi' ? '🍣' : '🌭'}</Text>
                  {isActive && (
                    <View style={styles.starBadge}>
                      <Text style={styles.starBadgeText}>★</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Popular Food Cards - Vertical */}
          <View style={styles.popularSection}>
            <View style={styles.popularHeaderRow}>
              <Text style={styles.popularTitle}>Popular Food</Text>
              <Text style={styles.popularCount}>{bookingDishesList.length} items</Text>
            </View>

            {bookingDishesList.length === 0 ? (
              <View style={styles.emptyBookingState}>
                <Text style={styles.emptyBookingEmoji}>🍽️</Text>
                <Text style={styles.emptyBookingTitle}>No dishes available</Text>
                <Text style={styles.emptyBookingDesc}>Try a different tab or category</Text>
              </View>
            ) : (
              bookingDishesList.map((dish) => (
                <TouchableOpacity
                  key={dish.id}
                  style={styles.popularCard}
                  onPress={() => {
                    setSelectedBookingDish(dish);
                    setBookingFormOpen(true);
                  }}
                  activeOpacity={0.9}
                >
                  <Image source={{ uri: dish.image }} style={styles.popularCardImage} />
                  <View style={styles.heartCircle}>
                    <Heart size={ms(14)} color="#FF4A6B" fill="#FF4A6B" />
                  </View>
                  <View style={styles.popularCardContent}>
                    <Text style={styles.popularCardName}>{dish.name}</Text>
                    <Text style={styles.popularCardResto}>{dish.restaurant}</Text>
                    <View style={styles.popularCardMeta}>
                      <View style={styles.popularCardRating}>
                        <Star size={ms(9)} color="#f59e0b" fill="#f59e0b" />
                        <Text style={styles.popularCardRatingText}>{dish.rating}</Text>
                      </View>
                      <Text style={styles.popularCardTags}>{dish.tags}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.bookTableBtn}
                      onPress={() => {
                        setSelectedBookingDish(dish);
                        setBookingFormOpen(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.bookTableBtnText}>Book Table</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>

        {/* Reservation Modal */}
        <Modal
          visible={bookingFormOpen}
          animationType="slide"
          onRequestClose={() => setBookingFormOpen(false)}
        >
          <View style={styles.modalContainer}>
            {/* Sticky Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setBookingFormOpen(false); setBookingConfirmed(null); }} style={styles.modalBackBtn}>
                <ArrowLeft size={ms(20)} color="#ffffff" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Table Reservation</Text>
              <View style={styles.modalBackBtn} />
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              {/* Core Dish Card */}
              {selectedBookingDish && (
                <View style={styles.dishGradientCard}>
                  <Image source={{ uri: selectedBookingDish.image }} style={styles.dishGradientBg} />
                  <View style={styles.dishGradientOverlay} />
                  <View style={styles.dishGradientContent}>
                    <Text style={styles.dishGradientEmoji}>{selectedBookingDish.emoji}</Text>
                    <Text style={styles.dishGradientName}>{selectedBookingDish.name}</Text>
                    <Text style={styles.dishGradientPrice}>{selectedBookingDish.price}</Text>
                  </View>
                </View>
              )}

              {/* Reservation Setup */}
              <View style={styles.reservationSection}>
                {/* Date */}
                <View style={styles.reservationRow}>
                  <Text style={styles.reservationLabel}>Date</Text>
                  <Text style={styles.reservationValue}>{formatDisplayDate(selectedDate)}</Text>
                </View>

                {/* Time Slots */}
                <View style={styles.reservationRow}>
                  <Text style={styles.reservationLabel}>Time</Text>
                  <View style={styles.pillRow}>
                    {timeSlots.map((slot) => {
                      const isActive = selectedTime === slot.value;
                      return (
                        <TouchableOpacity
                          key={slot.value}
                          style={[styles.timePill, isActive && styles.timePillActive]}
                          onPress={() => setSelectedTime(slot.value)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.timePillValue, isActive && styles.timePillValueActive]}>{slot.value}</Text>
                          <Text style={[styles.timePillLabel, isActive && styles.timePillLabelActive]}>{slot.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Guests */}
                <View style={styles.reservationRow}>
                  <Text style={styles.reservationLabel}>Guests</Text>
                  <View style={styles.pillRow}>
                    {guestOptions.map((g) => {
                      const isActive = guestsCount === g;
                      return (
                        <TouchableOpacity
                          key={g}
                          style={[styles.guestPill, isActive && styles.guestPillActive]}
                          onPress={() => setGuestsCount(g)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.guestPillText, isActive && styles.guestPillTextActive]}>{g}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* Iconic Dishes Rail */}
              <View style={styles.iconicRailSection}>
                <Text style={styles.iconicRailTitle}>Iconic Dishes</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iconicRailScroll}>
                  {BOOKING_DISHES_DB.filter(d => d.id !== selectedBookingDish?.id).map((dish) => {
                    const isAdded = addedRecommendedIds.includes(dish.id);
                    return (
                      <TouchableOpacity
                        key={dish.id}
                        style={[styles.iconicRailCard, isAdded && styles.iconicRailCardAdded]}
                        onPress={() => {
                          if (isAdded) {
                            setAddedRecommendedIds(prev => prev.filter(id => id !== dish.id));
                          } else {
                            setAddedRecommendedIds(prev => [...prev, dish.id]);
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <Image source={{ uri: dish.image }} style={styles.iconicRailImage} />
                        <Text style={styles.iconicRailName} numberOfLines={1}>{dish.name}</Text>
                        <Text style={styles.iconicRailPrice}>{dish.price}</Text>
                        <View style={[styles.iconicRailAddCircle, isAdded && styles.iconicRailAddCircleAdded]}>
                          {isAdded ? <Check size={ms(10)} color="#ffffff" strokeWidth={3} /> : <Text style={styles.iconicRailAddText}>+</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </ScrollView>

            {/* Sticky Bottom Bar */}
            <View style={styles.bottomSticky}>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleConfirmBooking}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmBtnText}>
                  {bookingConfirmed ? `${bookingConfirmed} Confirmed!` : `Confirm Table Reservation (${selectedBookingDish?.price || '₹0'})`}
                </Text>
                <View style={styles.promoPassBadge}>
                  <Text style={styles.promoPassText}>PROMO PASS</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Booking Confirmed Toast */}
        {bookingConfirmed && (
          <View style={styles.confirmedToast}>
            <CheckCircle size={ms(16)} color="#ffffff" />
            <Text style={styles.confirmedToastText}>{bookingConfirmed} Confirmed!</Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  orderContent: { paddingBottom: 40, paddingHorizontal: hs(16), paddingTop: vs(8) },
  bookingContent: { paddingBottom: 40 },

  // Mode Toggle
  modeToggle: {
    flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: ms(12),
    marginHorizontal: hs(16), marginTop: vs(8),
    padding: vs(4),
  },
  modeBtn: { flex: 1, paddingVertical: vs(8), borderRadius: ms(10), alignItems: 'center' },
  modeBtnActive: { backgroundColor: '#1E5D44' },
  modeBtnText: { fontSize: ms(11), fontWeight: '900', color: '#64748b', textTransform: 'uppercase' },
  modeBtnTextActive: { color: '#ffffff' },
  modeContainer: { flex: 1, marginTop: vs(12) },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff',
    borderRadius: ms(16), paddingHorizontal: hs(12), height: vs(44), marginBottom: vs(16),
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  searchIcon: { marginRight: hs(8) },
  searchInput: { flex: 1, fontSize: ms(12), fontWeight: '800', color: '#0f172a' },

  // Promo Card
  promoCard: {
    backgroundColor: '#F2F5F3', borderRadius: ms(24), padding: hs(16),
    flexDirection: 'row', marginBottom: vs(20),
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1,
  },
  promoLeft: { flex: 1, justifyContent: 'center' },
  discountChip: { backgroundColor: '#ECFDF5', alignSelf: 'flex-start', paddingHorizontal: hs(8), paddingVertical: vs(3), borderRadius: ms(20), marginBottom: vs(6) },
  discountChipText: { fontSize: ms(7), fontWeight: '900', color: '#047857' },
  promoTitle: { fontSize: ms(14), fontWeight: '900', color: '#0f172a', marginBottom: vs(4) },
  promoDesc: { fontSize: ms(9), fontWeight: '600', color: '#64748b', marginBottom: vs(10) },
  orderNowBtn: { backgroundColor: '#1E5D44', alignSelf: 'flex-start', paddingHorizontal: hs(16), paddingVertical: vs(8), borderRadius: ms(12), minWidth: hs(80), alignItems: 'center' },
  orderNowBtnAdded: { backgroundColor: '#059669' },
  orderNowBtnText: { fontSize: ms(10), fontWeight: '900', color: '#ffffff' },
  promoImage: { width: ms(124), height: ms(124), borderRadius: ms(62), borderWidth: 4, borderColor: '#ffffff', marginLeft: hs(12) },

  // Section headers
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: vs(12) },
  sectionTitle: { fontSize: ms(16), fontWeight: '900', color: '#0f172a' },
  sectionSubtitle: { fontSize: ms(11), fontWeight: '700', color: '#64748b' },

  // Top of Week Rail
  railScroll: { paddingBottom: vs(16) },
  railCard: {
    height: vs(170), width: hs(130), borderRadius: ms(20), borderWidth: 1, borderColor: '#f1f5f9',
    padding: hs(10), backgroundColor: '#ffffff', marginRight: hs(10),
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 4, elevation: 1,
  },
  railImage: { height: vs(112), borderRadius: ms(16), resizeMode: 'cover' },
  railInfo: { flex: 1, justifyContent: 'space-between', marginTop: vs(6) },
  railName: { fontSize: ms(10), fontWeight: '800', color: '#0f172a' },
  railPrice: { fontSize: ms(11), fontWeight: '900', color: '#1E5D44', marginTop: vs(2) },
  railAddBtn: { backgroundColor: '#0f172a', width: ms(28), height: ms(20), borderRadius: ms(6), alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },
  railAddBtnAdded: { backgroundColor: '#10B981' },
  railAddBtnText: { fontSize: ms(8), fontWeight: '900', color: '#ffffff' },

  // Filter Row
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: hs(8), marginBottom: vs(10) },
  filterPill: { paddingHorizontal: hs(12), paddingVertical: vs(6), borderRadius: ms(20), backgroundColor: '#f1f5f9' },
  filterPillActive: { backgroundColor: '#0f172a' },
  filterPillText: { fontSize: ms(9), fontWeight: '800', color: '#64748b' },
  filterPillTextActive: { color: '#ffffff' },
  clearAllPill: { paddingHorizontal: hs(10), paddingVertical: vs(6), borderRadius: ms(20), backgroundColor: '#fff1f2' },
  clearAllText: { fontSize: ms(9), fontWeight: '800', color: '#e11d48' },
  sortRow: { flexDirection: 'row', gap: hs(6), marginBottom: vs(14) },
  sortPill: { paddingHorizontal: hs(10), paddingVertical: vs(5), borderRadius: ms(16), backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  sortPillActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  sortPillText: { fontSize: ms(9), fontWeight: '700', color: '#64748b' },
  sortPillTextActive: { color: '#ffffff' },

  // Store cards
  storeCard: {
    borderRadius: ms(20), backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#f1f5f9',
    marginBottom: vs(12), overflow: 'hidden', position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 4, elevation: 1,
  },
  storeCover: { width: '100%', height: vs(120), resizeMode: 'cover' },
  storeGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: vs(80), backgroundColor: 'rgba(0,0,0,0.35)' },
  storeEmojiRow: { position: 'absolute', top: vs(12), left: hs(12), flexDirection: 'row', alignItems: 'center' },
  storeEmoji: { fontSize: ms(22), marginRight: hs(8) },
  storeNameOnImage: { fontSize: ms(12), fontWeight: '900', color: '#ffffff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  vegBadge: { position: 'absolute', top: vs(12), right: hs(12), backgroundColor: '#059669', paddingHorizontal: hs(6), paddingVertical: vs(2), borderRadius: ms(6) },
  vegBadgeText: { fontSize: ms(7), fontWeight: '900', color: '#ffffff' },
  storeMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: hs(14), paddingTop: vs(10), paddingBottom: vs(6) },
  storeRatingRow: { flexDirection: 'row', alignItems: 'center' },
  storeRatingText: { fontSize: ms(9), fontWeight: '800', color: '#0f172a', marginLeft: hs(3) },
  storeDeliveryRow: { flexDirection: 'row', alignItems: 'center' },
  storeMetaText: { fontSize: ms(9), fontWeight: '700', color: '#64748b' },
  storeMetaDot: { fontSize: ms(9), color: '#cbd5e1', marginHorizontal: hs(4) },
  offerTag: { paddingHorizontal: hs(14), paddingTop: vs(4), paddingBottom: vs(12) },
  offerTagText: { fontSize: ms(8), fontWeight: '800', color: '#d97706', backgroundColor: '#fffbeb', alignSelf: 'flex-start', paddingHorizontal: hs(8), paddingVertical: vs(2), borderRadius: ms(6), overflow: 'hidden' },
  chevronCircle: { position: 'absolute', right: hs(14), bottom: vs(40), width: ms(28), height: ms(28), borderRadius: ms(14), backgroundColor: 'rgba(0,0,0,0.15)', alignItems: 'center', justifyContent: 'center' },

  // Store drill-in
  backPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', alignSelf: 'flex-start', paddingHorizontal: hs(12), paddingVertical: vs(6), borderRadius: ms(20), marginBottom: vs(12) },
  backPillText: { fontSize: ms(10), fontWeight: '900', color: '#ffffff', marginLeft: hs(6) },
  storeHero: { position: 'relative', marginBottom: vs(20) },
  storeHeroImage: { width: '100%', height: vs(180), borderRadius: ms(20), resizeMode: 'cover' },
  storeHeroGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: ms(20), backgroundColor: 'rgba(0,0,0,0.2)' },
  floatingRatingBadge: { position: 'absolute', top: vs(12), right: hs(12), backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: hs(8), paddingVertical: vs(3), borderRadius: ms(8) },
  floatingRatingText: { fontSize: ms(9), fontWeight: '900', color: '#ffffff', marginLeft: hs(3) },
  pulsingOfferTag: { position: 'absolute', top: vs(40), right: hs(12), backgroundColor: '#d97706', paddingHorizontal: hs(8), paddingVertical: vs(3), borderRadius: ms(8) },
  pulsingOfferText: { fontSize: ms(8), fontWeight: '900', color: '#ffffff' },
  storeEmojiTile: { position: 'absolute', bottom: vs(-12), left: hs(16), width: ms(56), height: ms(56), borderRadius: ms(16), backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  storeEmojiTileText: { fontSize: ms(28) },
  storeMenuTitle: { fontSize: ms(16), fontWeight: '900', color: '#0f172a', marginBottom: vs(12) },
  storeMenuGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  storeMenuItem: { width: '48%', backgroundColor: '#ffffff', borderRadius: ms(16), borderWidth: 1, borderColor: '#f1f5f9', marginBottom: vs(12), overflow: 'hidden' },
  storeMenuImage: { width: '100%', height: vs(100), resizeMode: 'cover' },
  specialBadgeSmall: { position: 'absolute', top: vs(6), left: hs(6), backgroundColor: '#f59e0b', paddingHorizontal: hs(6), paddingVertical: vs(2), borderRadius: ms(6) },
  specialBadgeSmallText: { fontSize: ms(7), fontWeight: '900', color: '#ffffff' },
  storeMenuName: { fontSize: ms(10), fontWeight: '800', color: '#0f172a', paddingHorizontal: hs(8), paddingTop: vs(8), minHeight: ms(26) },
  storeMenuFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: hs(8) },
  storeMenuPrice: { fontSize: ms(11), fontWeight: '900', color: '#1E5D44' },
  storeMenuAddBtn: { width: ms(24), height: ms(24), borderRadius: ms(12), backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  storeMenuAddBtnAdded: { backgroundColor: '#10B981' },
  storeMenuAddText: { fontSize: ms(12), fontWeight: '900', color: '#ffffff' },

  // Booking header
  bookingHeader: {
    backgroundColor: '#54B175', paddingHorizontal: hs(20), paddingTop: vs(16),
    paddingBottom: vs(12), borderRadius: ms(28), marginHorizontal: hs(16), marginTop: vs(12),
    position: 'relative', zIndex: 2,
  },
  bookingHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: vs(14) },
  avatarRow: { flexDirection: 'row', alignItems: 'center' },
  avatarWrap: { position: 'relative', marginRight: hs(10) },
  avatarImg: { width: vs(44), height: vs(44), borderRadius: vs(22), borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' },
  onlineDot: { position: 'absolute', top: 0, right: 0, width: vs(12), height: vs(12), borderRadius: vs(6), backgroundColor: '#4ade80', borderWidth: 2, borderColor: '#54B175' },
  greetText: { fontSize: ms(10), color: 'rgba(255,255,255,0.8)', fontWeight: '700' },
  userNameText: { fontSize: ms(14), fontWeight: '900', color: '#ffffff', marginTop: vs(2) },
  cartCircle: { width: vs(40), height: vs(40), borderRadius: vs(20), backgroundColor: '#FFA500', alignItems: 'center', justifyContent: 'center' },
  cartEmoji: { fontSize: ms(18) },
  bookingSearchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(12), gap: hs(8) },
  bookingSearchInputWrap: { flex: 1, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: ms(16), paddingHorizontal: hs(14), height: vs(40), justifyContent: 'center' },
  bookingSearchInput: { fontSize: ms(11), fontWeight: '700', color: '#ffffff' },
  divider: { width: 1, height: vs(20), backgroundColor: 'rgba(255,255,255,0.2)' },
  settingsChip: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: ms(12), paddingHorizontal: hs(8), paddingVertical: vs(4) },
  settingsChipText: { fontSize: ms(14) },

  // Booking tabs
  bookingTabsRow: { flexDirection: 'row', position: 'relative' },
  bookingTab: { flexDirection: 'row', alignItems: 'center', paddingVertical: vs(8), paddingRight: hs(16) },
  bookingTabText: { fontSize: ms(11), fontWeight: '900', color: 'rgba(255,255,255,0.6)' },
  bookingTabTextActive: { color: '#ffffff' },
  tabBadge24: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: hs(6), paddingVertical: vs(1), borderRadius: ms(10), marginLeft: hs(4) },
  tabBadge24Text: { fontSize: ms(8), fontWeight: '900', color: '#ffffff' },
  bookingTabUnderline: { position: 'absolute', bottom: 0, width: hs(24), height: vs(3), backgroundColor: '#ffffff', borderRadius: ms(1.5) },

  // Category bubbles
  categoryBubblesCard: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: ms(20),
    marginHorizontal: hs(16), marginTop: vs(-24), marginBottom: vs(16),
    paddingVertical: vs(10), paddingHorizontal: hs(8),
    zIndex: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  categoryBubble: { alignItems: 'center', position: 'relative', paddingHorizontal: hs(8), paddingVertical: vs(4) },
  categoryBubbleActive: { borderWidth: 2, borderColor: '#fbbf24', borderRadius: ms(16), backgroundColor: 'rgba(251,191,36,0.1)' },
  categoryBubbleText: { fontSize: ms(22) },
  starBadge: { position: 'absolute', top: vs(-4), right: hs(0) },
  starBadgeText: { fontSize: ms(10), color: '#f59e0b' },

  // Popular food vertical
  popularSection: { paddingHorizontal: hs(16), paddingTop: vs(8) },
  popularHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: vs(12) },
  popularTitle: { fontSize: ms(15), fontWeight: '900', color: '#0f172a' },
  popularCount: { fontSize: ms(10), fontWeight: '700', color: '#94a3b8' },
  popularCard: {
    borderRadius: ms(28), borderWidth: 1, borderColor: '#f1f5f9', backgroundColor: '#ffffff',
    marginBottom: vs(16), overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 1,
  },
  popularCardImage: { width: '100%', height: vs(176), resizeMode: 'cover' },
  heartCircle: { position: 'absolute', top: vs(12), right: hs(12), width: ms(36), height: ms(36), borderRadius: ms(18), backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  popularCardContent: { padding: hs(14) },
  popularCardName: { fontSize: ms(16), fontWeight: '900', color: '#0f172a', marginBottom: vs(2) },
  popularCardResto: { fontSize: ms(10), fontWeight: '700', color: '#64748b', marginBottom: vs(8) },
  popularCardMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(12) },
  popularCardRating: { flexDirection: 'row', alignItems: 'center', marginRight: hs(8) },
  popularCardRatingText: { fontSize: ms(9), fontWeight: '800', color: '#0f172a', marginLeft: hs(3) },
  popularCardTags: { fontSize: ms(9), fontWeight: '600', color: '#94a3b8', flex: 1 },
  bookTableBtn: { backgroundColor: '#54B175', paddingVertical: vs(10), borderRadius: ms(14), alignItems: 'center' },
  bookTableBtnText: { fontSize: ms(11), fontWeight: '900', color: '#ffffff' },

  // Empty booking state
  emptyBookingState: { alignItems: 'center', paddingVertical: vs(40) },
  emptyBookingEmoji: { fontSize: ms(40), marginBottom: vs(12) },
  emptyBookingTitle: { fontSize: ms(12), fontWeight: '900', color: '#0f172a' },
  emptyBookingDesc: { fontSize: ms(9.5), color: '#94a3b8', fontWeight: '600', marginTop: vs(4) },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#54B175' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: hs(16), paddingTop: vs(50), paddingBottom: vs(12) },
  modalBackBtn: { width: ms(40), height: ms(40), borderRadius: ms(20), alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: ms(14), fontWeight: '900', color: '#ffffff' },
  modalScroll: { paddingBottom: vs(100), backgroundColor: '#f8fafc', borderTopLeftRadius: ms(28), borderTopRightRadius: ms(28), marginTop: vs(12) },
  dishGradientCard: { position: 'relative', height: vs(180), marginBottom: vs(16), marginHorizontal: hs(16), borderRadius: ms(20), overflow: 'hidden', marginTop: vs(16) },
  dishGradientBg: { width: '100%', height: '100%', resizeMode: 'cover' },
  dishGradientOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  dishGradientContent: { position: 'absolute', bottom: vs(14), left: hs(14) },
  dishGradientEmoji: { fontSize: ms(24), marginBottom: vs(4) },
  dishGradientName: { fontSize: ms(14), fontWeight: '900', color: '#ffffff' },
  dishGradientPrice: { fontSize: ms(16), fontWeight: '900', color: '#fbbf24' },

  // Reservation section
  reservationSection: { paddingHorizontal: hs(16), marginBottom: vs(16) },
  reservationRow: { marginBottom: vs(14) },
  reservationLabel: { fontSize: ms(11), fontWeight: '800', color: '#64748b', marginBottom: vs(6), textTransform: 'uppercase', letterSpacing: 0.5 },
  reservationValue: { fontSize: ms(18), fontWeight: '900', color: '#0f172a' },
  pillRow: { flexDirection: 'row', gap: hs(8), flexWrap: 'wrap' },
  timePill: { paddingHorizontal: hs(12), paddingVertical: vs(8), borderRadius: ms(12), backgroundColor: '#f1f5f9', alignItems: 'center', minWidth: hs(60) },
  timePillActive: { backgroundColor: '#54B175' },
  timePillValue: { fontSize: ms(11), fontWeight: '900', color: '#0f172a' },
  timePillValueActive: { color: '#ffffff' },
  timePillLabel: { fontSize: ms(8), fontWeight: '700', color: '#94a3b8', marginTop: vs(2) },
  timePillLabelActive: { color: 'rgba(255,255,255,0.8)' },
  guestPill: { width: ms(36), height: ms(36), borderRadius: ms(18), backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  guestPillActive: { backgroundColor: '#54B175' },
  guestPillText: { fontSize: ms(12), fontWeight: '900', color: '#0f172a' },
  guestPillTextActive: { color: '#ffffff' },

  // Iconic dishes rail
  iconicRailSection: { paddingHorizontal: hs(16), marginBottom: vs(16) },
  iconicRailTitle: { fontSize: ms(12), fontWeight: '900', color: '#0f172a', marginBottom: vs(10) },
  iconicRailScroll: { gap: hs(10) },
  iconicRailCard: { width: hs(120), backgroundColor: '#ffffff', borderRadius: ms(16), borderWidth: 1, borderColor: '#f1f5f9', padding: hs(8), position: 'relative' },
  iconicRailCardAdded: { borderColor: '#54B175' },
  iconicRailImage: { width: '100%', height: vs(80), borderRadius: ms(12), marginBottom: vs(6) },
  iconicRailName: { fontSize: ms(9), fontWeight: '800', color: '#0f172a', marginBottom: vs(2) },
  iconicRailPrice: { fontSize: ms(10), fontWeight: '900', color: '#54B175', marginBottom: vs(6) },
  iconicRailAddCircle: { width: ms(24), height: ms(24), borderRadius: ms(12), backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },
  iconicRailAddCircleAdded: { backgroundColor: '#54B175' },
  iconicRailAddText: { fontSize: ms(12), fontWeight: '900', color: '#ffffff' },

  // Bottom sticky
  bottomSticky: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#ffffff', padding: hs(16), borderTopWidth: 1, borderTopColor: '#f1f5f9', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 5 },
  confirmBtn: { backgroundColor: '#54B175', height: vs(44), borderRadius: ms(16), flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  confirmBtnText: { fontSize: ms(11), fontWeight: '900', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 0.5, marginRight: hs(8) },
  promoPassBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: hs(8), paddingVertical: vs(3), borderRadius: ms(8) },
  promoPassText: { fontSize: ms(8), fontWeight: '900', color: '#ffffff' },

  // Confirmed toast
  confirmedToast: { position: 'absolute', bottom: vs(80), left: hs(16), right: hs(16), backgroundColor: '#059669', borderRadius: ms(14), paddingVertical: vs(12), paddingHorizontal: hs(16), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 5 },
  confirmedToastText: { color: '#ffffff', fontSize: ms(11), fontWeight: '900', marginLeft: hs(8) },
});
