import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  TextInput,
  ImageBackground,
} from 'react-native';
import { Search, ChevronRight, Clock, Star, MapPin, CheckCircle, ArrowLeft, Calendar, Users, Check, Sparkles } from 'lucide-react-native';

import { topOfWeekDishes } from '../../data/mockProducts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

export function FoodScreen({ addToCart, activeSubMode, setActiveSubMode, onProductClick }: any) {
  const [searchQuery, setSearchQuery] = useState('');
  const [addedId, setAddedId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState('All');
  
  // Booking specific states
  const [selectedBookingTab, setSelectedBookingTab] = useState('Dinner');
  const [selectedDate, setSelectedDate] = useState('2026-07-08');
  const [selectedTime, setSelectedTime] = useState('19:00');
  const [guestsCount, setGuestsCount] = useState(2);
  const [bookingFormOpen, setBookingFormOpen] = useState(false);
  const [selectedBookingDish, setSelectedBookingDish] = useState<any>(null);
  const [addedRecommendedIds, setAddedRecommendedIds] = useState<string[]>([]);
  
  const handleAddToCartWithFeedback = (id: string, name: string, price: number, emoji: string) => {
    if (addToCart) addToCart(id, name, price, emoji);
    setAddedId(id);
    setTimeout(() => {
      setAddedId(null);
    }, 1500);
  };

  const bookingDishesList = BOOKING_DISHES_DB.filter(d => d.tab === selectedBookingTab);
  
  if (activeSubMode === 'order') {
    return (
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentPadding}>
        
        {/* Search Input */}
        <View style={styles.searchWrap}>
          <Search size={18} color="#94a3b8" style={styles.searchIcon} />
          <TextInput 
            style={styles.searchInput}
            placeholder="Search on Food"
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Emerald Green Address Card */}
        <TouchableOpacity style={styles.addressCard} activeOpacity={0.9}>
          <View style={styles.addressLeft}>
            <Text style={styles.addressTitle}>DELIVERY TO HOME</Text>
            <Text style={styles.addressMain}>Utama Street no. 14, Rumbai</Text>
            <View style={styles.distanceBadge}>
              <Text style={styles.distanceText}>2.4 km</Text>
            </View>
          </View>
          <View style={styles.arrowCircle}>
            <ChevronRight size={18} color="#ffffff" />
          </View>
        </TouchableOpacity>

        {/* Premium Interactive Teriyaki Promo Card */}
        <View style={styles.promoCard}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1598514982205-f36b96d1e8dd?auto=format&fit=crop&q=80&w=400&h=250' }}
            style={styles.promoImage}
          />
          <View style={styles.promoOverlay}>
            <View>
              <Text style={styles.promoHeading}>Chicken Teriyaki</Text>
              <Text style={styles.promoSubheading}>Discount 25%</Text>
              <View style={styles.todayOnlyBadge}>
                <Text style={styles.todayOnlyText}>TODAY ONLY</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.orderNowBtn} activeOpacity={0.8}>
              <Text style={styles.orderNowText}>Order Now</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section: Let's Order */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Let's Order</Text>
          <Text style={styles.sectionSubtitle}>Explore Menus</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {['All', 'Rice', 'Snack', 'Noodles', 'Vegetable'].map((filter) => {
            const isActive = selectedFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[styles.filterBtn, isActive && styles.filterBtnActive]}
                onPress={() => setSelectedFilter(filter)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{filter}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.productsList}>
          {topOfWeekDishes.map((product) => {
            const isAdded = addedId === product.id;
            return (
              <TouchableOpacity
                key={product.id}
                style={styles.productCardRow}
                onPress={() => onProductClick && onProductClick(product)}
                activeOpacity={0.9}
              >
                <View style={styles.productImageWrapRow}>
                  <Image source={{ uri: product.image }} style={styles.productImageRow} />
                  <View style={styles.emojiBadgeRow}>
                    <Text style={styles.emojiBadgeTextRow}>{product.emoji}</Text>
                  </View>
                </View>
                <View style={styles.productInfoRow}>
                  <Text style={styles.productNameRow} numberOfLines={2}>{product.name}</Text>
                  <View style={styles.metaRowRow}>
                    <View style={styles.metaItemRow}>
                      <Star size={10} color="#f59e0b" fill="#f59e0b" />
                      <Text style={styles.metaTextRow}>{product.rating || "4.8"} ({product.reviewsCount || "1.2k"})</Text>
                    </View>
                    <Text style={styles.metaDotRow}>•</Text>
                    <View style={styles.metaItemRow}>
                      <Clock size={10} color="#64748b" />
                      <Text style={styles.metaTextRow}>{product.time || "15 mins"}</Text>
                    </View>
                  </View>
                  <View style={styles.priceAddRowRow}>
                    <Text style={styles.priceRowRow}>₹{product.price}</Text>
                    <TouchableOpacity
                      style={[styles.addBtnRow, isAdded && styles.addBtnAddedRow]}
                      onPress={() => handleAddToCartWithFeedback(product.id, product.name, product.price, product.emoji)}
                    >
                      {isAdded ? (
                        <CheckCircle size={14} color="#ffffff" />
                      ) : (
                        <Text style={styles.addBtnTextRow}>ADD</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  // Dinner Booking Mode
  return (
    <View style={styles.container}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentPaddingBooking}>
        
        {/* Top Header Section */}
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

          {/* Central Search */}
          <View style={styles.bookingSearch}>
            <TouchableOpacity onPress={() => setActiveSubMode('order')}>
              <ArrowLeft size={16} color="#94a3b8" />
            </TouchableOpacity>
            <TextInput 
              style={styles.bookingSearchInput}
              placeholder="Find for food or resto ..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <Search size={16} color="#94a3b8" />
          </View>

          {/* Horizontal Category Tabs */}
          <View style={styles.tabsRow}>
            {['Breakfast', 'Dinner', 'Have Lunch'].map((tab) => {
              const isActive = selectedBookingTab === tab;
              return (
                <TouchableOpacity 
                  key={tab} 
                  style={styles.tabBtn}
                  onPress={() => setSelectedBookingTab(tab)}
                >
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab}</Text>
                  {isActive && <View style={styles.tabIndicator} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Most Favorite Food */}
        <View style={styles.favoriteHeader}>
          <Text style={styles.sectionTitle}>Most Favorite Food</Text>
          <Text style={styles.seeAllText}>See all</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favoriteScroll}>
          {bookingDishesList.map((dish) => (
            <TouchableOpacity 
              key={dish.id} 
              style={styles.favoriteCard}
              onPress={() => {
                setSelectedBookingDish(dish);
                setBookingFormOpen(true);
              }}
              activeOpacity={0.9}
            >
              <Image source={{ uri: dish.image }} style={styles.favImage} />
              <View style={styles.favRatingBadge}>
                <Text style={styles.favRatingText}>★ {dish.rating}</Text>
              </View>
              <View style={styles.favContent}>
                <Text style={styles.favTitle} numberOfLines={1}>{dish.name}</Text>
                <Text style={styles.favResto} numberOfLines={1}>{dish.restaurant}</Text>
                <View style={styles.favFooter}>
                  <Text style={styles.favPrice}>{dish.price}</Text>
                  <View style={styles.favAddCircle}>
                    <Text style={styles.favAddText}>+</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Iconic Dishes & Today's Special */}
        <View style={styles.iconicHeader}>
          <View>
            <Text style={styles.iconicLabel}>HIGHLY RECOMMENDED</Text>
            <View style={styles.iconicTitleRow}>
              <Sparkles size={14} color="#f59e0b" />
              <Text style={styles.sectionTitle}>Iconic Dishes & Today's Special</Text>
            </View>
          </View>
          <View style={styles.popularBadge}>
            <Text style={styles.popularText}>POPULAR PAIRS</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favoriteScroll}>
          {BOOKING_DISHES_DB.filter(d => d.id !== selectedBookingDish?.id).map((dish) => {
            const isAdded = addedRecommendedIds.includes(dish.id);
            return (
              <TouchableOpacity 
                key={dish.id} 
                style={styles.iconicCard}
                activeOpacity={0.9}
              >
                {dish.isSpecial && (
                  <View style={styles.specialBadge}>
                    <Text style={styles.specialText}>Special 🔥</Text>
                  </View>
                )}
                <Image source={{ uri: dish.image }} style={styles.iconicImage} />
                <View style={styles.iconicContent}>
                  <Text style={styles.iconicResto} numberOfLines={1}>{dish.restaurant}</Text>
                  <Text style={styles.iconicTitle} numberOfLines={2}>{dish.name}</Text>
                  <View style={styles.iconicFooter}>
                    <Text style={styles.iconicPrice}>{dish.price}</Text>
                    <TouchableOpacity 
                      style={[styles.iconicAddBtn, isAdded && styles.iconicAddBtnAdded]}
                      onPress={() => {
                        handleAddToCartWithFeedback(dish.id, dish.name, parseInt(dish.price.replace(/[^\d]/g, '')), dish.emoji);
                        setAddedRecommendedIds(prev => [...prev, dish.id]);
                      }}
                    >
                      {isAdded ? <Check size={11} color="#ffffff" strokeWidth={3} /> : <Text style={styles.iconicAddBtnText}>+</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </ScrollView>

      {/* Bottom Sticky action summary */}
      {bookingFormOpen && (
        <View style={styles.bottomSticky}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Reservation Summary</Text>
            <Text style={styles.summaryValue}>{guestsCount} Guests • {selectedDate} @ {selectedTime}</Text>
          </View>
          <TouchableOpacity 
            style={styles.confirmBtn}
            onPress={() => setBookingFormOpen(false)}
          >
            <Text style={styles.confirmBtnText}>Confirm Table Reservation ({selectedBookingDish?.price})</Text>
            <View style={styles.promoPassBadge}>
              <Text style={styles.promoPassText}>PROMO PASS</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  contentPadding: { paddingBottom: 40, paddingTop: 16, paddingHorizontal: 16 },
  contentPaddingBooking: { paddingBottom: 100 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9',
    borderRadius: 16, paddingHorizontal: 12, height: 44, marginBottom: 20
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 12, fontWeight: '800', color: '#0f172a' },
  addressCard: {
    backgroundColor: '#1E5D44', borderRadius: 24, padding: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20
  },
  addressLeft: { flex: 1 },
  addressTitle: { fontSize: 10, fontWeight: '900', color: '#6ee7b7', marginBottom: 4 },
  addressMain: { fontSize: 14, fontWeight: '900', color: '#ffffff', marginBottom: 12 },
  distanceBadge: { backgroundColor: '#ffffff', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  distanceText: { fontSize: 10, fontWeight: '900', color: '#1E5D44' },
  arrowCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  promoCard: { width: '100%', height: 160, borderRadius: 24, overflow: 'hidden', marginBottom: 24 },
  promoImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  promoOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', padding: 20, justifyContent: 'space-between', flexDirection: 'row', alignItems: 'flex-end' },
  promoHeading: { fontSize: 18, fontWeight: '900', color: '#ffffff', marginBottom: 4 },
  promoSubheading: { fontSize: 12, fontWeight: '800', color: '#fcd34d', marginBottom: 8 },
  todayOnlyBadge: { backgroundColor: '#ef4444', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  todayOnlyText: { fontSize: 9, fontWeight: '900', color: '#ffffff' },
  orderNowBtn: { backgroundColor: '#ffffff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  orderNowText: { fontSize: 11, fontWeight: '900', color: '#0f172a' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  sectionSubtitle: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  filterScroll: { paddingBottom: 16, gap: 10 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, backgroundColor: '#f1f5f9' },
  filterBtnActive: { backgroundColor: '#0f172a' },
  filterText: { fontSize: 11, fontWeight: '800', color: '#64748b' },
  filterTextActive: { color: '#ffffff' },
  productsList: { gap: 16 },
  productCardRow: { flexDirection: 'row', backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: '#f1f5f9', padding: 12, gap: 12 },
  productImageWrapRow: { width: 80, height: 80, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  productImageRow: { width: '100%', height: '100%' },
  emojiBadgeRow: { position: 'absolute', top: 6, left: 6, backgroundColor: '#ffffff', padding: 4, borderRadius: 8 },
  emojiBadgeTextRow: { fontSize: 12 },
  productInfoRow: { flex: 1, justifyContent: 'space-between' },
  productNameRow: { fontSize: 12, fontWeight: '900', color: '#0f172a' },
  metaRowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 4 },
  metaItemRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTextRow: { fontSize: 10, fontWeight: '700', color: '#64748b' },
  metaDotRow: { fontSize: 10, color: '#cbd5e1' },
  priceAddRowRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceRowRow: { fontSize: 14, fontWeight: '900', color: '#10b981' },
  addBtnRow: { backgroundColor: '#0f172a', width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  addBtnAddedRow: { backgroundColor: '#10b981' },
  addBtnTextRow: { fontSize: 14, fontWeight: '900', color: '#ffffff' },

  // Booking Styles
  bookingHeader: { backgroundColor: '#54B175', padding: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, marginBottom: 20 },
  bookingHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' },
  onlineDot: { position: 'absolute', top: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#4ade80', borderWidth: 2, borderColor: '#54B175' },
  greetText: { fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: '700' },
  userNameText: { fontSize: 14, fontWeight: '900', color: '#ffffff', marginTop: 2 },
  cartCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center' },
  cartEmoji: { fontSize: 18 },
  bookingSearch: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 16, paddingHorizontal: 16, height: 44, marginBottom: 16, gap: 12 },
  bookingSearchInput: { flex: 1, fontSize: 12, fontWeight: '700', color: '#0f172a' },
  tabsRow: { flexDirection: 'row', gap: 20 },
  tabBtn: { paddingVertical: 8, position: 'relative' },
  tabText: { fontSize: 12, fontWeight: '900', color: 'rgba(255,255,255,0.6)' },
  tabTextActive: { color: '#ffffff' },
  tabIndicator: { position: 'absolute', bottom: 0, left: '50%', transform: [{ translateX: -4 }], width: 8, height: 4, backgroundColor: '#ffffff', borderRadius: 2 },
  favoriteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 16, marginBottom: 12 },
  seeAllText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  favoriteScroll: { paddingHorizontal: 16, gap: 16, paddingBottom: 24 },
  favoriteCard: { width: 180, backgroundColor: '#ffffff', borderRadius: 24, borderWidth: 1, borderColor: '#f1f5f9', padding: 12 },
  favImage: { width: '100%', height: 120, borderRadius: 16, marginBottom: 12 },
  favRatingBadge: { position: 'absolute', top: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  favRatingText: { fontSize: 9, fontWeight: '900', color: '#ffffff' },
  favContent: { flex: 1 },
  favTitle: { fontSize: 12, fontWeight: '900', color: '#0f172a', marginBottom: 4 },
  favResto: { fontSize: 10, fontWeight: '700', color: '#64748b', marginBottom: 12 },
  favFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  favPrice: { fontSize: 14, fontWeight: '900', color: '#54B175' },
  favAddCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  favAddText: { fontSize: 14, fontWeight: '900', color: '#ffffff' },
  iconicHeader: { paddingHorizontal: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  iconicLabel: { fontSize: 9, fontWeight: '900', color: '#f59e0b', letterSpacing: 1, marginBottom: 4 },
  iconicTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  popularBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  popularText: { fontSize: 9, fontWeight: '900', color: '#f59e0b' },
  iconicCard: { width: 140, backgroundColor: '#ffffff', borderRadius: 24, borderWidth: 1, borderColor: '#f1f5f9', padding: 12 },
  specialBadge: { position: 'absolute', top: 20, left: 20, zIndex: 10, backgroundColor: '#f59e0b', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  specialText: { fontSize: 8, fontWeight: '900', color: '#ffffff', letterSpacing: 0.5 },
  iconicImage: { width: '100%', height: 90, borderRadius: 16, marginBottom: 10 },
  iconicContent: { flex: 1 },
  iconicResto: { fontSize: 9, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 },
  iconicTitle: { fontSize: 11, fontWeight: '900', color: '#0f172a', marginBottom: 8, minHeight: 30 },
  iconicFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f8fafc', paddingTop: 8 },
  iconicPrice: { fontSize: 11, fontWeight: '900', color: '#54B175' },
  iconicAddBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  iconicAddBtnAdded: { backgroundColor: '#54B175' },
  iconicAddBtnText: { fontSize: 14, fontWeight: '900', color: '#ffffff' },
  bottomSticky: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#ffffff', padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 5 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  summaryLabel: { fontSize: 11, fontWeight: '800', color: '#64748b' },
  summaryValue: { fontSize: 11, fontWeight: '900', color: '#0f172a' },
  confirmBtn: { backgroundColor: '#54B175', height: 44, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  confirmBtnText: { fontSize: 12, fontWeight: '900', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 0.5 },
  promoPassBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  promoPassText: { fontSize: 9, fontWeight: '900', color: '#ffffff' },
});
