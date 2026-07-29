import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import {
  ShoppingBag,
  Utensils,
  Sparkles,
  MapPin,
  Tag,
  Percent,
  Flame,
  Heart,
  Plus,
  Check,
  Award,
  Zap,
  Clock,
  Star,
  TrendingUp,
  Volume2,
  VolumeX,
  ShieldCheck,
  Play,
  Info,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from 'lucide-react-native';
import EnterpriseIcon from './EnterpriseIcon';
import { hs, vs, ms } from '@/utils/responsive';

interface HomeViewProps {
  onLaunchSubApp: (subAppId: 'FA_MART' | 'FOOD' | 'GROCERY' | 'PHARMA') => void;
  addToCart: (id: string, name: string, price: number, emoji: string) => void;
  onScroll?: (offsetY: number) => void;
}

export default function HomeView({ onLaunchSubApp, addToCart, onScroll }: HomeViewProps) {
  const [favoriteRestaurants, setFavoriteRestaurants] = useState<string[]>([]);
  const [addedItemFeedback, setAddedItemFeedback] = useState<string | null>(null);
  const [topAdIndex, setTopAdIndex] = useState(0);
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [showAdminDoc, setShowAdminDoc] = useState(false);

  const zapPulseAnim = useRef(new Animated.Value(1)).current;
  const sparkleRotateAnim = useRef(new Animated.Value(0)).current;
  const flamePulseAnim = useRef(new Animated.Value(1)).current;
  const awardBounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(zapPulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(zapPulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  useEffect(() => {
    const rotate = Animated.loop(
      Animated.timing(sparkleRotateAnim, { toValue: 1, duration: 3000, useNativeDriver: true })
    );
    rotate.start();
    return () => rotate.stop();
  }, []);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(flamePulseAnim, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(flamePulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  useEffect(() => {
    const bounce = Animated.loop(
      Animated.sequence([
        Animated.timing(awardBounceAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(awardBounceAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    );
    bounce.start();
    return () => bounce.stop();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTopAdIndex((prev) => (prev + 1) % topAdSlides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const sparkleRotate = sparkleRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const awardScale = awardBounceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.25],
  });

  const portalSectors = [
    {
      id: 'FA_MART' as const,
      name: 'MART',
      tagline: 'Fashion & Tech',
      emoji: '🛍️',
      imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&q=80&w=300&h=300',
      themeColor: '#1162D3',
      shadowColor: 'rgba(17,98,211,0.18)',
    },
    {
      id: 'FOOD' as const,
      name: 'FOOD',
      tagline: 'Gourmet Dining',
      emoji: '🍲',
      imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=300&h=300',
      themeColor: '#1E5D44',
      shadowColor: 'rgba(30,93,68,0.18)',
    },
    {
      id: 'GROCERY' as const,
      name: 'GROCERY',
      tagline: '10-Min Delivery',
      emoji: '🍏',
      imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=300&h=300',
      themeColor: '#10B981',
      shadowColor: 'rgba(16,185,129,0.18)',
    },
    {
      id: 'PHARMA' as const,
      name: 'PHARMA',
      tagline: 'Rx & Lab Tests',
      emoji: '💊',
      imageUrl: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=300&h=300',
      themeColor: '#065F46',
      shadowColor: 'rgba(6,95,70,0.18)',
    },
  ];

  const topAdSlides = [
    {
      id: 'ta-1',
      title: '10-Min Emergency Pharma Delivery Active',
      tagline: 'All life-saving prescription medicines & rapid diagnostic kits at your doorstep.',
      badge: 'LIVE EXPRESS',
      type: 'image' as const,
      imageUrl: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=400&h=200',
      targetApp: 'PHARMA' as const,
    },
    {
      id: 'ta-2',
      title: 'Fresh Farm Apples & Organic Vegetables',
      tagline: 'Zero cold-storage lag. Direct from organic valley farmers to your kitchen.',
      badge: 'HARVEST TODAY',
      type: 'image' as const,
      imageUrl: 'https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?auto=format&fit=crop&q=80&w=400&h=200',
      targetApp: 'GROCERY' as const,
    },
    {
      id: 'ta-3',
      title: 'Monsoon Gourmet Dining Carnival',
      tagline: 'Exclusive 50% discount across top Michelin-rated & trending restaurants.',
      badge: 'FESTIVE SPECIAL',
      type: 'image' as const,
      imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=400&h=200',
      targetApp: 'FOOD' as const,
    },
  ];

  const sponsoredAds = [
    {
      id: 'sp-1',
      title: 'Gourmet Double Truffle Smash Burger',
      tagline: 'Unleash authentic black winter truffle butter inside premium Angus beef patties.',
      brand: 'Burger Craft',
      discount: '50% OFF TODAY',
      mediaType: 'image' as const,
      imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=600&h=350',
      targetApp: 'FOOD' as const,
    },
    {
      id: 'sp-2',
      title: 'Ultra-Light Carbon Fiber Running Sneakers',
      tagline: 'Engineered for explosive marathon speed with reactive kinetic foam cushioning.',
      brand: 'AeroStep Athletics',
      discount: '40% INTRO OFFER',
      mediaType: 'image' as const,
      imageUrl: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=600&h=350',
      targetApp: 'FA_MART' as const,
    },
    {
      id: 'sp-3',
      title: 'Organic Cold-Pressed Immune Immunity Shots',
      tagline: '100% pure ginger, turmeric, and ashwagandha root extracts without preservatives.',
      brand: 'Vitality Labs',
      discount: 'BUY 2 GET 1 FREE',
      mediaType: 'image' as const,
      imageUrl: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&q=80&w=600&h=350',
      targetApp: 'GROCERY' as const,
    },
  ];

  const recentlyViewedHistory = [
    {
      id: 'rv-1',
      name: 'Retro RGB Mechanical Keyboard',
      price: '₹4,999',
      emoji: '⌨️',
      imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=150&h=150',
      targetApp: 'FA_MART' as const,
      activityTag: 'Searched in Mart',
    },
    {
      id: 'rv-2',
      name: 'Organic Honeycrisp Apples',
      price: '₹249 / kg',
      emoji: '🍎',
      imageUrl: 'https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?auto=format&fit=crop&q=80&w=150&h=150',
      targetApp: 'GROCERY' as const,
      activityTag: 'Added to Bag',
    },
    {
      id: 'rv-3',
      name: 'Pure Vitamin C 1000mg Gummies',
      price: '₹349',
      emoji: '🍊',
      imageUrl: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=150&h=150',
      targetApp: 'PHARMA' as const,
      activityTag: 'Viewed Rx',
    },
    {
      id: 'rv-4',
      name: 'Spicy Tonkotsu Ramen Bowl',
      price: '₹225',
      emoji: '🍜',
      imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&q=80&w=150&h=150',
      targetApp: 'FOOD' as const,
      activityTag: 'Ordered Twice',
    },
  ];

  const todaysOffers = [
    {
      id: 'to-1',
      dishName: 'Signature Tonkotsu Ramen',
      originalPrice: '₹450',
      promoPrice: '₹225',
      restaurant: 'Ramen Ichiraku (Food)',
      emoji: '🍜',
      discountBadge: '50% OFF TODAY',
      imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&q=80&w=200&h=200',
      targetApp: 'FOOD' as const,
    },
    {
      id: 'to-2',
      dishName: 'Pro Wireless ANC Earbuds',
      originalPrice: '₹8,999',
      promoPrice: '₹4,999',
      restaurant: 'FA Mart Tech Superstore',
      emoji: '🎧',
      discountBadge: '44% TECH FLASH DEAL',
      imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=200&h=200',
      targetApp: 'FA_MART' as const,
    },
    {
      id: 'to-3',
      dishName: 'Organic Avocado & Berry Box',
      originalPrice: '₹650',
      promoPrice: '₹399',
      restaurant: 'Faazio Fresh Farm Harvest',
      emoji: '🥑',
      discountBadge: '38% FRESH COMBO',
      imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=200&h=200',
      targetApp: 'GROCERY' as const,
    },
    {
      id: 'to-4',
      dishName: 'Comprehensive Full Body Bio-Screen',
      originalPrice: '₹3,500',
      promoPrice: '₹1,499',
      restaurant: 'Faazio Certified Diagnostics',
      emoji: '🩺',
      discountBadge: '57% HEALTH PACK',
      imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=200&h=200',
      targetApp: 'PHARMA' as const,
    },
  ];

  const mixedRecommendations = [
    {
      id: 'mr-1',
      name: 'Ultra-Light Suede Urban Sneakers',
      price: '₹3,499',
      sector: 'Mart Fashion',
      rating: '4.8',
      imageUrl: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=200&h=200',
      targetApp: 'FA_MART' as const,
    },
    {
      id: 'mr-2',
      name: 'Slow Cooked Awadhi Mutton Biryani',
      price: '₹550',
      sector: 'Gourmet Dining',
      rating: '4.9',
      imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80&w=200&h=200',
      targetApp: 'FOOD' as const,
    },
    {
      id: 'mr-3',
      name: 'Cold Pressed Vitamin C Orange Juice',
      price: '₹180',
      sector: 'Organic Grocery',
      rating: '4.9',
      imageUrl: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&q=80&w=200&h=200',
      targetApp: 'GROCERY' as const,
    },
    {
      id: 'mr-4',
      name: 'Digital Instant IR Thermometer',
      price: '₹1,850',
      sector: 'Pharma Care',
      rating: '4.7',
      imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=200&h=200',
      targetApp: 'PHARMA' as const,
    },
  ];

  const popularDining = [
    { id: 'pd-1', name: 'Truffle Infused Wagyu Steak', cuisine: 'Continental · American', price: '₹1,299', rating: '4.9', imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=300&h=200', trending: true },
    { id: 'pd-2', name: 'Spicy Miso Ramen Bowl', cuisine: 'Japanese · Noodles', price: '₹450', rating: '4.8', imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&q=80&w=300&h=200', trending: false },
    { id: 'pd-3', name: 'Wood-Fired Truffle Pizza', cuisine: 'Italian · Pizza', price: '₹699', rating: '4.9', imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&q=80&w=300&h=200', trending: true },
  ];

  const recentlyViewedMart = [
    { id: 'rm-1', name: 'Premium Hoodie', price: '₹1,299', emoji: '👕', imageUrl: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&q=80&w=150&h=150', sector: 'FA_MART' },
    { id: 'rm-2', name: 'Noise-Canceling Earbuds', price: '₹4,499', emoji: '🎧', imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=150&h=150', sector: 'FA_MART' },
    { id: 'rm-3', name: 'Leather Crossbody Bag', price: '₹2,499', emoji: '👛', imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&q=80&w=150&h=150', sector: 'FA_MART' },
  ];

  const recentlyViewedGrocery = [
    { id: 'rg-1', name: 'Organic Avocados (4 pcs)', price: '₹199', emoji: '🥑', imageUrl: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&q=80&w=150&h=150', sector: 'GROCERY' },
    { id: 'rg-2', name: 'Fresh Blueberries (200g)', price: '₹299', emoji: '🫐', imageUrl: 'https://images.unsplash.com/photo-1498557850523-fd3d118b962e?auto=format&fit=crop&q=80&w=150&h=150', sector: 'GROCERY' },
    { id: 'rg-3', name: 'Greek Yogurt Tub', price: '₹149', emoji: '🥛', imageUrl: 'https://images.unsplash.com/photo-1564485377539-5af72af1f393?auto=format&fit=crop&q=80&w=150&h=150', sector: 'GROCERY' },
  ];

  const recentlyViewedPharma = [
    { id: 'rp-1', name: 'Multi-Vitamin Daily Pack', price: '₹499', emoji: '💊', imageUrl: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=150&h=150', sector: 'PHARMA' },
    { id: 'rp-2', name: 'Digital Thermometer Pro', price: '₹850', emoji: '🌡️', imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=150&h=150', sector: 'PHARMA' },
    { id: 'rp-3', name: 'First Aid Emergency Kit', price: '₹349', emoji: '🩹', imageUrl: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&q=80&w=150&h=150', sector: 'PHARMA' },
  ];

  const faMartFinds = [
    { id: 'ff-1', name: 'Wireless Charging Station', price: '₹1,999', rating: '4.8', imageUrl: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?auto=format&fit=crop&q=80&w=300&h=200', tag: 'BESTSELLER' },
    { id: 'ff-2', name: 'Smart LED Desk Lamp', price: '₹1,499', rating: '4.7', imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?auto=format&fit=crop&q=80&w=300&h=200', tag: 'NEW LAUNCH' },
  ];

  const restaurantSpecials = [
    { id: 'rs-1', name: 'Lobster Thermidor Platter', cuisine: 'French · Seafood', price: '₹1,899', imageUrl: 'https://images.unsplash.com/photo-1559737558-2f5a35f4523b?auto=format&fit=crop&q=80&w=300&h=200', icon: '🏆' },
    { id: 'rs-2', name: 'Kobe Beef Sushi Set', cuisine: 'Japanese · Premium', price: '₹1,299', imageUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&q=80&w=300&h=200', icon: '🏆' },
    { id: 'rs-3', name: 'Vegan Buddha Bowl', cuisine: 'Healthy · Bowls', price: '₹549', imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=300&h=200', icon: '🏆' },
  ];

  const toggleFavorite = (id: string) => {
    if (favoriteRestaurants.includes(id)) {
      setFavoriteRestaurants(favoriteRestaurants.filter((item) => item !== id));
    } else {
      setFavoriteRestaurants([...favoriteRestaurants, id]);
    }
  };

  const triggerAddToCartFeedback = (id: string, name: string, price: number, emoji: string) => {
    addToCart(id, name, price, emoji);
    setAddedItemFeedback(id);
    setTimeout(() => {
      setAddedItemFeedback(null);
    }, 1500);
  };

  const screenW = Dimensions.get('window').width;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
      onScroll={onScroll ? (e) => onScroll(e.nativeEvent.contentOffset.y) : undefined}
      scrollEventThrottle={16}>

      {/* H1: ADMINISTRATIVE ALIGNMENT & DELIVERY BANNER */}
      <View style={{ marginHorizontal: hs(16), marginTop: vs(14), backgroundColor: '#0f172a', borderRadius: ms(24), padding: hs(16), borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: hs(8) }}>
            <View style={{ width: ms(32), height: ms(32), borderRadius: ms(8), backgroundColor: 'rgba(245, 158, 11, 0.2)', alignItems: 'center', justifyContent: 'center', marginRight: hs(10) }}>
              <ShieldCheck size={ms(18)} color="#fbbf24" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                <Text style={{ color: '#ffffff', fontSize: ms(12), fontWeight: '900', marginRight: hs(6) }}>Production "Ditto" Demo Replica</Text>
                <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: hs(6), paddingVertical: vs(2), borderRadius: ms(10), borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                  <Text style={{ color: '#6ee7b7', fontSize: ms(8), fontWeight: '900' }}>V2.0 LOCKED</Text>
                </View>
              </View>
              <Text style={{ color: '#cbd5e1', fontSize: ms(9.5), marginTop: vs(2) }}>All staging placeholders replaced with real production INR pricing & Unsplash media.</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setShowAdminDoc(!showAdminDoc)}
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: hs(10), paddingVertical: vs(6), borderRadius: ms(10), borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
          >
            <Text style={{ color: '#fcd34d', fontSize: ms(9), fontWeight: '900' }}>{showAdminDoc ? 'Hide Note' : 'Read Note'}</Text>
          </TouchableOpacity>
        </View>

        {showAdminDoc && (
          <View style={{ marginTop: vs(14), paddingTop: vs(14), borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.3)', padding: hs(12), borderRadius: ms(12) }}>
            <Text style={{ color: '#fbbf24', fontWeight: '900', fontSize: ms(9), marginBottom: vs(4) }}>📌 REVIEW CLARIFICATION:</Text>
            <Text style={{ color: '#e2e8f0', fontSize: ms(10), lineHeight: ms(15), marginBottom: vs(8) }}>In our previous review, "service routing architecture" meant items viewed in Mart, Food, Grocery, or Pharma automatically appear in your Recently Viewed Strip here on the home screen.</Text>
            <Text style={{ color: '#34d399', fontWeight: '900', fontSize: ms(9), marginBottom: vs(4) }}>📅 DEADLINE LOCK ("DATE 2"):</Text>
            <Text style={{ color: '#e2e8f0', fontSize: ms(10), lineHeight: ms(15), marginBottom: vs(8) }}>Final handover scheduled for Friday, August 15th at 5:00 PM IST with all voice note UI restructurings incorporated.</Text>
            <Text style={{ color: '#fb7185', fontWeight: '900', fontSize: ms(9), marginBottom: vs(4) }}>🛑 TICKETING MODULE SCOPE BOUNDARY:</Text>
            <Text style={{ color: '#e2e8f0', fontSize: ms(10), lineHeight: ms(15) }}>Bus, train, and movie ticket booking are strictly excluded from this release as a Version 2.0 expansion after our core 4-sector user base is established.</Text>
          </View>
        )}
      </View>

      {/* H2: TOP AD CAROUSEL */}
      <View style={[styles.sectionHeader, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Zap size={ms(14)} color="#f59e0b" fill="#f59e0b" style={{ marginRight: hs(6) }} />
          <Text style={styles.sectionTitle}>Live Sector Updates & Feeds</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {topAdSlides.map((_, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => setTopAdIndex(idx)}
              style={{
                width: topAdIndex === idx ? hs(16) : hs(6),
                height: vs(6),
                borderRadius: ms(3),
                backgroundColor: topAdIndex === idx ? '#f59e0b' : '#cbd5e1',
                marginLeft: hs(4),
              }}
            />
          ))}
        </View>
      </View>

      {topAdIndex === 0 ? (
        <TouchableOpacity
          onPress={() => onLaunchSubApp(topAdSlides[0].targetApp)}
          style={{ marginHorizontal: hs(16), backgroundColor: '#020617', borderRadius: ms(20), overflow: 'hidden', borderWidth: 1, borderColor: '#1e293b' }}
          activeOpacity={0.9}
        >
          <View style={{ position: 'relative' }}>
            <Image source={{ uri: topAdSlides[0].imageUrl }} style={{ width: '100%', height: vs(120) }} />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: ms(48), height: ms(48), borderRadius: ms(24), backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                <Play size={ms(24)} color="#ffffff" fill="#ffffff" />
              </View>
            </View>
            <View style={{ position: 'absolute', top: vs(10), left: hs(10), flexDirection: 'row', alignItems: 'center' }}>
              <Animated.View style={{ opacity: zapPulseAnim }}>
                <Zap size={ms(12)} color="#f59e0b" fill="#f59e0b" style={{ marginRight: hs(4) }} />
              </Animated.View>
              <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.9)', paddingHorizontal: hs(6), paddingVertical: vs(2), borderRadius: ms(4) }}>
                <Text style={{ color: '#ffffff', fontSize: ms(8), fontWeight: '900' }}>LIVE VIDEO CAM</Text>
              </View>
            </View>
          </View>
          <View style={{ padding: hs(14), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: hs(10) }}>
              <Text style={{ color: '#ffffff', fontSize: ms(11), fontWeight: '900' }} numberOfLines={1}>{topAdSlides[0].title}</Text>
              <Text style={{ color: '#cbd5e1', fontSize: ms(9), marginTop: vs(2) }} numberOfLines={1}>{topAdSlides[0].tagline}</Text>
            </View>
            <View style={{ width: ms(32), height: ms(32), borderRadius: ms(16), backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight size={ms(16)} color="#ffffff" />
            </View>
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={() => onLaunchSubApp(topAdSlides[topAdIndex].targetApp)}
          style={{ marginHorizontal: hs(16), backgroundColor: '#020617', borderRadius: ms(20), padding: hs(14), borderWidth: 1, borderColor: '#1e293b', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          activeOpacity={0.9}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: hs(10) }}>
            <Image source={{ uri: topAdSlides[topAdIndex].imageUrl }} style={{ width: ms(48), height: ms(48), borderRadius: ms(12), marginRight: hs(12) }} />
            <View style={{ flex: 1 }}>
              <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(245, 158, 11, 0.2)', paddingHorizontal: hs(6), paddingVertical: vs(2), borderRadius: ms(4), borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)', marginBottom: vs(4) }}>
                <Text style={{ color: '#fbbf24', fontSize: ms(8), fontWeight: '900' }}>{topAdSlides[topAdIndex].badge}</Text>
              </View>
              <Text style={{ color: '#ffffff', fontSize: ms(11), fontWeight: '900' }} numberOfLines={1}>{topAdSlides[topAdIndex].title}</Text>
              <Text style={{ color: '#cbd5e1', fontSize: ms(9), marginTop: vs(2) }} numberOfLines={1}>{topAdSlides[topAdIndex].tagline}</Text>
            </View>
          </View>
          <View style={{ width: ms(32), height: ms(32), borderRadius: ms(16), backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronRight size={ms(16)} color="#ffffff" />
          </View>
        </TouchableOpacity>
      )}

      {/* H3: CATEGORY SECTORS */}
      <View style={[styles.sectionHeader, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: vs(18) }]}>
        <Text style={styles.sectionTitle}>Explore Premium Sectors</Text>
        <Text style={{ fontSize: ms(9), fontWeight: '700', color: '#94a3b8' }}>Tap to open applet</Text>
      </View>
      <View style={styles.sectorsCard}>
        <View style={styles.sectorsGrid}>
          {portalSectors.map((sector) => (
            <TouchableOpacity
              key={sector.id}
              onPress={() => onLaunchSubApp(sector.id)}
              style={styles.sectorButton}
              activeOpacity={0.8}
            >
              <View style={[styles.sectorCircle, { borderColor: '#e2e8f0', borderWidth: 1.5 }]}>
                <Image source={{ uri: sector.imageUrl }} style={styles.sectorImg} />
                <View style={styles.sectorEmojiOverlay}>
                  <Text style={styles.sectorEmojiText}>{sector.emoji}</Text>
                </View>
              </View>
              <Text style={styles.sectorName} numberOfLines={1}>{sector.name}</Text>
              <Text style={styles.sectorTagline} numberOfLines={1}>{sector.tagline}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* H4: SPONSORED SHOWCASE */}
      <View style={[styles.sectionHeader, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: vs(4) }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Tag size={ms(11)} color="#f59e0b" fill="#f59e0b" style={{ marginRight: hs(4) }} />
          <Text style={{ fontSize: ms(9), fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>Sponsored Showcase</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => setHeroSlideIndex((prev) => (prev - 1 + sponsoredAds.length) % sponsoredAds.length)}
            style={{ width: ms(24), height: ms(24), borderRadius: ms(8), backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: hs(6) }}
          >
            <ChevronLeft size={ms(14)} color="#334155" />
          </TouchableOpacity>
          <Text style={{ fontSize: ms(9), fontWeight: '700', color: '#475569', marginRight: hs(6) }}>{heroSlideIndex + 1}/{sponsoredAds.length}</Text>
          <TouchableOpacity
            onPress={() => setHeroSlideIndex((prev) => (prev + 1) % sponsoredAds.length)}
            style={{ width: ms(24), height: ms(24), borderRadius: ms(8), backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronRight size={ms(14)} color="#334155" />
          </TouchableOpacity>
        </View>
      </View>

      {(() => {
        const currentAd = sponsoredAds[heroSlideIndex];
        const isFirstAd = heroSlideIndex === 0;
        return (
          <TouchableOpacity
            onPress={() => onLaunchSubApp(currentAd.targetApp)}
            style={[styles.adCard, isFirstAd && { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}
            activeOpacity={0.9}
          >
            <Image source={{ uri: currentAd.imageUrl }} style={styles.adBgImg} />
            <View style={styles.adGradientOverlay} />
            {isFirstAd && (
              <>
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
                  <View style={{ width: ms(52), height: ms(52), borderRadius: ms(26), backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                    <Play size={ms(26)} color="#ffffff" fill="#ffffff" />
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setIsMuted(!isMuted)}
                  style={{ position: 'absolute', top: vs(14), right: hs(14), zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: hs(8), paddingVertical: vs(4), borderRadius: ms(12), flexDirection: 'row', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)' }}
                >
                  {isMuted ? <VolumeX size={ms(12)} color="#ffffff" /> : <Volume2 size={ms(12)} color="#ffffff" />}
                  <Text style={{ color: '#ffffff', fontSize: ms(8), fontWeight: '700', marginLeft: hs(4) }}>{isMuted ? 'Muted' : 'Live'}</Text>
                </TouchableOpacity>
              </>
            )}
            <View style={styles.adTag}>
              <Tag size={ms(10)} color="#f59e0b" fill="#f59e0b" />
              <Text style={styles.adTagText}>Sponsored • {currentAd.brand}</Text>
            </View>
            <View style={styles.adContent}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <Text style={styles.adBrand}>{currentAd.discount}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: '#cbd5e1', fontSize: ms(8), fontWeight: '700', marginRight: hs(4) }}>Tap to open {currentAd.brand}</Text>
                  <ArrowRight size={ms(10)} color="#cbd5e1" />
                </View>
              </View>
              <Text style={styles.adTitle}>{currentAd.title}</Text>
              <Text style={styles.adDesc}>{currentAd.tagline}</Text>
            </View>
          </TouchableOpacity>
        );
      })()}

      {/* H5: RECENTLY VIEWED */}
      <View style={[styles.sectionRow, { marginTop: vs(14) }]}>
        <View style={styles.rowTitleWrap}>
          <TrendingUp size={ms(14)} color="#1162D3" style={{ marginRight: hs(4) }} />
          <Text style={styles.sectionTitle}>Recently Viewed & Searched</Text>
        </View>
        <View style={{ backgroundColor: '#eff6ff', paddingHorizontal: hs(8), paddingVertical: vs(2), borderRadius: ms(10) }}>
          <Text style={{ color: '#1d4ed8', fontSize: ms(8), fontWeight: '900', textTransform: 'uppercase' }}>History Router</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyScrollContent}>
        {recentlyViewedHistory.map((item) => {
          const hasAdded = addedItemFeedback === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => onLaunchSubApp(item.targetApp)}
              style={styles.historyItemCard}
              activeOpacity={0.9}
            >
              <View style={styles.historyLeft}>
                <View style={styles.historyImgWrapper}>
                  <Image source={{ uri: item.imageUrl }} style={styles.historyImg} />
                  <View style={styles.historyIconStamp}>
                    <Text style={styles.historyIconText}>{item.emoji}</Text>
                  </View>
                </View>
                <View style={styles.historyTextCol}>
                  <Text style={{ fontSize: ms(7.5), fontWeight: '800', color: '#2563eb', textTransform: 'uppercase', marginBottom: vs(2) }}>{item.activityTag}</Text>
                  <Text style={styles.historyName} numberOfLines={1}>{item.name}</Text>
                  <Text style={{ fontSize: ms(9.5), fontWeight: '900', color: '#1e293b', marginTop: vs(2) }}>{item.price}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => triggerAddToCartFeedback(item.id, item.name, parseInt(item.price.replace(/[^\d]/g, '') || '0'), item.emoji)}
                style={[styles.historyAddBtn, hasAdded && styles.historyAddBtnAdded]}
                activeOpacity={0.8}
              >
                {hasAdded ? (
                  <Check size={ms(8)} color="#ffffff" style={{ marginRight: hs(2) }} />
                ) : (
                  <Plus size={ms(8)} color="#334155" style={{ marginRight: hs(2) }} />
                )}
                <Text style={[styles.historyAddBtnText, hasAdded && styles.historyAddBtnTextAdded]}>
                  {hasAdded ? 'Added' : 'Add'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* H6: TODAY'S OFFERS */}
      <View style={[styles.sectionRow, { marginTop: vs(14) }]}>
        <View style={styles.rowTitleWrap}>
          <Animated.View style={{ opacity: flamePulseAnim }}>
            <Flame size={ms(14)} color="#f97316" fill="#f97316" style={{ marginRight: hs(4) }} />
          </Animated.View>
          <Text style={styles.sectionTitle}>Today's Offers</Text>
        </View>
        <View style={{ backgroundColor: '#fff7ed', paddingHorizontal: hs(8), paddingVertical: vs(2), borderRadius: ms(10), borderWidth: 1, borderColor: '#ffedd5' }}>
          <Text style={{ color: '#ea580c', fontSize: ms(8), fontWeight: '900', textTransform: 'uppercase' }}>All Sectors Deals</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScrollContent}>
        {todaysOffers.map((offer) => (
          <TouchableOpacity
            key={offer.id}
            onPress={() => onLaunchSubApp(offer.targetApp)}
            style={styles.horizontalCard}
            activeOpacity={0.9}
          >
            <View style={styles.cardImageContainer}>
              <Image source={{ uri: offer.imageUrl }} style={styles.cardImg} />
              <View style={[styles.offerBadge, { backgroundColor: '#0f172a', borderColor: '#334155' }]}>
                <Text style={[styles.offerBadgeText, { color: '#fbbf24' }]}>{offer.discountBadge}</Text>
              </View>
              <View style={styles.miniAppBadge}>
                <Text style={styles.miniAppBadgeText}>{offer.emoji}</Text>
              </View>
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>{offer.dishName}</Text>
            <Text style={styles.cardSubtitle}>{offer.restaurant}</Text>
            <View style={styles.cardFooter}>
              <View style={styles.priceRow}>
                <Text style={[styles.promoPrice, { color: '#047857' }]}>{offer.promoPrice}</Text>
                <Text style={styles.originalPrice}>{offer.originalPrice}</Text>
              </View>
              <View style={[styles.orderBadge, { backgroundColor: '#0f172a' }]}>
                <Text style={styles.orderBadgeText}>Claim Deal</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* H7: RECOMMENDED FOR YOU (2-column grid) */}
      <View style={[styles.sectionRow, { marginTop: vs(14) }]}>
        <View style={styles.rowTitleWrap}>
          <Animated.View style={{ transform: [{ rotate: sparkleRotate }] }}>
            <Sparkles size={ms(14)} color="#4f46e5" style={{ marginRight: hs(4) }} />
          </Animated.View>
          <Text style={styles.sectionTitle}>Recommended For You</Text>
        </View>
        <Text style={styles.topVotedText}>AI Curated Picks</Text>
      </View>

      <View style={styles.recommendationGrid}>
        {mixedRecommendations.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => onLaunchSubApp(item.targetApp)}
            style={[styles.recommendationCard, { width: (screenW - hs(44)) / 2 }]}
            activeOpacity={0.9}
          >
            <View style={styles.recommendationCardImageContainer}>
              <Image source={{ uri: item.imageUrl }} style={styles.recommendationCardImg} />
              <View style={[styles.offerBadge, { backgroundColor: 'rgba(0,0,0,0.6)', borderColor: 'transparent' }]}>
                <Text style={[styles.offerBadgeText, { color: '#ffffff' }]}>{item.sector}</Text>
              </View>
              <View style={styles.ratingOverlayRight}>
                <Text style={styles.ratingOverlayText}>★ {item.rating}</Text>
              </View>
            </View>
            <Text style={styles.recommendationCardTitle} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.cardSubtitle}>AI Curated Pick</Text>
            <View style={styles.recommendationCardFooter}>
              <Text style={[styles.promoPrice, { color: '#0f172a' }]}>{item.price}</Text>
              <View style={[styles.orderBadge, { backgroundColor: '#2563eb' }]}>
                <Text style={styles.orderBadgeText}>Discover</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* H8: POPULAR DINING */}
      <View style={[styles.sectionRow, { marginTop: vs(14) }]}>
        <View style={styles.rowTitleWrap}>
          <Star size={ms(14)} color="#f59e0b" fill="#f59e0b" style={{ marginRight: hs(4) }} />
          <Text style={styles.sectionTitle}>Popular Dining</Text>
        </View>
        <View style={{ backgroundColor: '#fef2f2', paddingHorizontal: hs(8), paddingVertical: vs(2), borderRadius: ms(10) }}>
          <Text style={{ color: '#dc2626', fontSize: ms(8), fontWeight: '900', textTransform: 'uppercase' }}>Trending</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScrollContent}>
        {popularDining.map((item) => {
          const isFav = favoriteRestaurants.includes(item.id);
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => onLaunchSubApp('FOOD')}
              style={styles.diningCard}
              activeOpacity={0.9}
            >
              <View style={styles.diningCardImageWrap}>
                <Image source={{ uri: item.imageUrl }} style={styles.diningCardImg} />
                <View style={styles.diningCardGradient} />
                <View style={styles.diningRatingBadge}>
                  <Star size={ms(8)} color="#f59e0b" fill="#f59e0b" />
                  <Text style={styles.diningRatingText}>{item.rating}</Text>
                </View>
                {item.trending && (
                  <View style={styles.diningTrendingBadge}>
                    <TrendingUp size={ms(8)} color="#dc2626" />
                    <Text style={styles.diningTrendingText}>Trending</Text>
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => toggleFavorite(item.id)}
                  style={styles.heartBtn}
                  activeOpacity={0.7}
                >
                  <Heart size={ms(14)} color={isFav ? '#e11d48' : '#64748b'} fill={isFav ? '#e11d48' : 'transparent'} />
                </TouchableOpacity>
              </View>
              <Text style={styles.diningName}>{item.name}</Text>
              <Text style={styles.diningCuisine}>{item.cuisine}</Text>
              <Text style={styles.diningPrice}>{item.price}</Text>
              <View style={styles.detailRow}>
                <View style={styles.detailItem}>
                  <MapPin size={ms(9)} color="#64748b" />
                  <Text style={styles.detailText}>2.3 km</Text>
                </View>
                <View style={styles.detailItem}>
                  <Clock size={ms(9)} color="#64748b" />
                  <Text style={styles.detailText}>35 min</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* H9: RECENTLY VIEWED MART */}
      <View style={[styles.historyCategoryRow, { marginTop: vs(14) }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[styles.historyCategoryDot, { backgroundColor: '#1162D3' }]} />
          <Text style={styles.historyCategoryTitle}>Recently Viewed Mart</Text>
        </View>
        <EnterpriseIcon emoji="🛍️" size={28} variant="flat" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyScrollContent}>
        {recentlyViewedMart.map((item) => {
          const hasAdded = addedItemFeedback === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => onLaunchSubApp('FA_MART')}
              style={styles.historyItemCard}
              activeOpacity={0.9}
            >
              <View style={{ position: 'absolute', top: vs(6), right: hs(6), zIndex: 5 }}>
                <EnterpriseIcon emoji="🛍️" size={24} variant="square" bgColor="rgba(17,98,211,0.1)" />
              </View>
              <View style={styles.historyLeft}>
                <View style={styles.historyImgWrapper}>
                  <Image source={{ uri: item.imageUrl }} style={styles.historyImg} />
                </View>
                <View style={styles.historyTextCol}>
                  <Text style={styles.historyName} numberOfLines={1}>{item.name}</Text>
                  <Text style={{ fontSize: ms(9.5), fontWeight: '900', color: '#1e293b', marginTop: vs(2) }}>{item.price}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => triggerAddToCartFeedback(item.id, item.name, parseInt(item.price.replace(/[^\d]/g, '') || '0'), item.emoji)}
                style={[styles.historyAddBtn, hasAdded && styles.historyAddBtnAdded]}
                activeOpacity={0.8}
              >
                {hasAdded ? (
                  <Check size={ms(8)} color="#ffffff" style={{ marginRight: hs(2) }} />
                ) : (
                  <Plus size={ms(8)} color="#334155" style={{ marginRight: hs(2) }} />
                )}
                <Text style={[styles.historyAddBtnText, hasAdded && styles.historyAddBtnTextAdded]}>
                  {hasAdded ? 'Added' : 'Add'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* H10: RECENTLY VIEWED GROCERY */}
      <View style={[styles.historyCategoryRow, { marginTop: vs(14) }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[styles.historyCategoryDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.historyCategoryTitle}>Recently Viewed Grocery</Text>
        </View>
        <EnterpriseIcon emoji="🍏" size={28} variant="flat" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyScrollContent}>
        {recentlyViewedGrocery.map((item) => {
          const hasAdded = addedItemFeedback === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => onLaunchSubApp('GROCERY')}
              style={styles.historyItemCard}
              activeOpacity={0.9}
            >
              <View style={{ position: 'absolute', top: vs(6), right: hs(6), zIndex: 5 }}>
                <EnterpriseIcon emoji="🍏" size={24} variant="square" bgColor="rgba(16,185,129,0.1)" />
              </View>
              <View style={styles.historyLeft}>
                <View style={styles.historyImgWrapper}>
                  <Image source={{ uri: item.imageUrl }} style={styles.historyImg} />
                </View>
                <View style={styles.historyTextCol}>
                  <Text style={styles.historyName} numberOfLines={1}>{item.name}</Text>
                  <Text style={{ fontSize: ms(9.5), fontWeight: '900', color: '#1e293b', marginTop: vs(2) }}>{item.price}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => triggerAddToCartFeedback(item.id, item.name, parseInt(item.price.replace(/[^\d]/g, '') || '0'), item.emoji)}
                style={[styles.historyAddBtn, hasAdded && styles.historyAddBtnAdded]}
                activeOpacity={0.8}
              >
                {hasAdded ? (
                  <Check size={ms(8)} color="#ffffff" style={{ marginRight: hs(2) }} />
                ) : (
                  <Plus size={ms(8)} color="#334155" style={{ marginRight: hs(2) }} />
                )}
                <Text style={[styles.historyAddBtnText, hasAdded && styles.historyAddBtnTextAdded]}>
                  {hasAdded ? 'Added' : 'Add'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* H11: RECENTLY VIEWED PHARMA */}
      <View style={[styles.historyCategoryRow, { marginTop: vs(14) }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[styles.historyCategoryDot, { backgroundColor: '#065F46' }]} />
          <Text style={styles.historyCategoryTitle}>Recently Viewed Pharma</Text>
        </View>
        <EnterpriseIcon emoji="💊" size={28} variant="flat" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyScrollContent}>
        {recentlyViewedPharma.map((item) => {
          const hasAdded = addedItemFeedback === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => onLaunchSubApp('PHARMA')}
              style={styles.historyItemCard}
              activeOpacity={0.9}
            >
              <View style={{ position: 'absolute', top: vs(6), right: hs(6), zIndex: 5 }}>
                <EnterpriseIcon emoji="💊" size={24} variant="square" bgColor="rgba(6,95,70,0.1)" />
              </View>
              <View style={styles.historyLeft}>
                <View style={styles.historyImgWrapper}>
                  <Image source={{ uri: item.imageUrl }} style={styles.historyImg} />
                </View>
                <View style={styles.historyTextCol}>
                  <Text style={styles.historyName} numberOfLines={1}>{item.name}</Text>
                  <Text style={{ fontSize: ms(9.5), fontWeight: '900', color: '#1e293b', marginTop: vs(2) }}>{item.price}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => triggerAddToCartFeedback(item.id, item.name, parseInt(item.price.replace(/[^\d]/g, '') || '0'), item.emoji)}
                style={[styles.historyAddBtn, hasAdded && styles.historyAddBtnAdded]}
                activeOpacity={0.8}
              >
                {hasAdded ? (
                  <Check size={ms(8)} color="#ffffff" style={{ marginRight: hs(2) }} />
                ) : (
                  <Plus size={ms(8)} color="#334155" style={{ marginRight: hs(2) }} />
                )}
                <Text style={[styles.historyAddBtnText, hasAdded && styles.historyAddBtnTextAdded]}>
                  {hasAdded ? 'Added' : 'Add'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* H12: FA MART FINDS */}
      <View style={[styles.sectionRow, { marginTop: vs(14) }]}>
        <View style={styles.rowTitleWrap}>
          <ShoppingBag size={ms(14)} color="#1162D3" style={{ marginRight: hs(4) }} />
          <Text style={styles.sectionTitle}>FA Mart Finds</Text>
        </View>
        <Text style={{ fontSize: ms(8), color: '#94a3b8', fontWeight: '700' }}>Curated Picks</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScrollContent}>
        {faMartFinds.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => onLaunchSubApp('FA_MART')}
            style={styles.horizontalCard}
            activeOpacity={0.9}
          >
            <View style={styles.cardImageContainer}>
              <Image source={{ uri: item.imageUrl }} style={styles.cardImg} />
              <View style={[styles.offerBadge, { backgroundColor: '#1162D3', borderColor: 'rgba(255,255,255,0.2)' }]}>
                <Text style={[styles.offerBadgeText, { color: '#ffffff' }]}>{item.tag}</Text>
              </View>
              <View style={styles.ratingOverlayRight}>
                <Star size={ms(8)} color="#f59e0b" fill="#f59e0b" />
                <Text style={styles.ratingOverlayText}> {item.rating}</Text>
              </View>
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.cardSubtitle}>FA Mart Exclusive</Text>
            <View style={styles.cardFooter}>
              <Text style={[styles.promoPrice, { color: '#0f172a' }]}>{item.price}</Text>
              <View style={[styles.orderBadge, { backgroundColor: '#1162D3' }]}>
                <Text style={styles.orderBadgeText}>Discover</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* H13: RESTAURANT SPECIALS */}
      <View style={[styles.sectionRow, { marginTop: vs(14) }]}>
        <View style={styles.rowTitleWrap}>
          <Animated.View style={{ transform: [{ scale: awardScale }] }}>
            <Award size={ms(14)} color="#d97706" style={{ marginRight: hs(4) }} />
          </Animated.View>
          <Text style={styles.sectionTitle}>Restaurant Specials</Text>
        </View>
        <EnterpriseIcon emoji="🏆" size={28} variant="flat" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ ...styles.horizontalScrollContent, marginBottom: vs(16) }}>
        {restaurantSpecials.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => onLaunchSubApp('FOOD')}
            style={styles.horizontalCard}
            activeOpacity={0.9}
          >
            <View style={styles.cardImageContainer}>
              <Image source={{ uri: item.imageUrl }} style={styles.cardImg} />
              <View style={[styles.offerBadge, { backgroundColor: 'rgba(217,119,6,0.9)', borderColor: 'rgba(255,255,255,0.2)' }]}>
                <Zap size={ms(10)} color="#ffffff" fill="#ffffff" />
                <Text style={[styles.offerBadgeText, { color: '#ffffff', marginLeft: hs(4) }]}>Special</Text>
              </View>
              <View style={{ position: 'absolute', top: vs(10), right: hs(10) }}>
                <EnterpriseIcon emoji={item.icon} size={28} variant="square" bgColor="rgba(255,255,255,0.95)" />
              </View>
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.cardSubtitle}>{item.cuisine}</Text>
            <View style={styles.cardFooter}>
              <Text style={[styles.promoPrice, { color: '#1E5D44' }]}>{item.price}</Text>
              <View style={[styles.orderBadge, { backgroundColor: '#1E5D44' }]}>
                <Text style={styles.orderBadgeText}>Order Now</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingBottom: vs(40),
  },
  sectionHeader: {
    paddingHorizontal: hs(16),
    marginTop: vs(14),
    marginBottom: vs(8),
  },
  sectionTitle: {
    fontSize: ms(11),
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectorsCard: {
    marginHorizontal: hs(16),
    backgroundColor: '#ffffff',
    borderRadius: ms(24),
    padding: hs(16),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 1,
    marginBottom: vs(16),
  },
  sectorsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  sectorButton: {
    alignItems: 'center',
    width: '23%',
  },
  sectorCircle: {
    width: ms(58),
    height: ms(58),
    borderRadius: ms(29),
    borderWidth: 2,
    borderColor: '#f8fafc',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f1f5f9',
    shadowColor: '#1162D3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  sectorImg: {
    width: '100%',
    height: '100%',
  },
  sectorEmojiOverlay: {
    position: 'absolute',
    bottom: vs(-1),
    right: hs(-1),
    backgroundColor: '#ffffff',
    width: ms(20),
    height: ms(20),
    borderRadius: ms(10),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  sectorEmojiText: {
    fontSize: ms(10),
  },
  sectorName: {
    fontSize: ms(10),
    fontWeight: '900',
    color: '#1e293b',
    marginTop: vs(10),
    textTransform: 'uppercase',
  },
  sectorTagline: {
    fontSize: ms(8),
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: vs(2),
  },
  adCard: {
    marginHorizontal: hs(16),
    height: vs(176),
    borderRadius: ms(24),
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0f172a',
    marginBottom: vs(16),
  },
  adBgImg: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    opacity: 0.85,
  },
  adGradientOverlay: {
    position: 'absolute',
    top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  adTag: {
    position: 'absolute',
    top: vs(14),
    left: hs(14),
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingVertical: vs(4),
    paddingHorizontal: hs(8),
    borderRadius: ms(6),
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  adTagText: {
    color: '#ffffff',
    fontSize: ms(8),
    fontWeight: '900',
    textTransform: 'uppercase',
    marginLeft: hs(4),
    letterSpacing: 0.5,
  },
  adContent: {
    position: 'absolute',
    bottom: vs(16),
    left: hs(16),
    right: hs(16),
  },
  adBrand: {
    color: '#10b981',
    fontSize: ms(9),
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  adTitle: {
    color: '#ffffff',
    fontSize: ms(14),
    fontWeight: '900',
    marginTop: vs(4),
    lineHeight: ms(18),
  },
  adDesc: {
    color: '#cbd5e1',
    fontSize: ms(10),
    fontWeight: '500',
    marginTop: vs(4),
    lineHeight: ms(14),
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    marginBottom: vs(10),
  },
  rowTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topVotedText: {
    fontSize: ms(8),
    color: '#94a3b8',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  horizontalScrollContent: {
    paddingLeft: hs(16),
    paddingRight: hs(4),
    paddingBottom: vs(16),
  },
  horizontalCard: {
    width: hs(256),
    backgroundColor: '#ffffff',
    borderRadius: ms(24),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: hs(14),
    marginRight: hs(12),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  cardImageContainer: {
    height: vs(128),
    width: '100%',
    borderRadius: ms(16),
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f8fafc',
  },
  cardImg: {
    width: '100%',
    height: '100%',
  },
  offerBadge: {
    position: 'absolute',
    bottom: vs(10),
    left: hs(10),
    backgroundColor: '#1E5D44',
    paddingVertical: vs(4),
    paddingHorizontal: hs(10),
    borderRadius: ms(8),
    borderWidth: 1,
    borderColor: '#34d399',
    flexDirection: 'row',
    alignItems: 'center',
  },
  offerBadgeText: {
    color: '#ffffff',
    fontSize: ms(8),
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  miniAppBadge: {
    position: 'absolute',
    top: vs(10),
    right: hs(10),
    backgroundColor: 'rgba(255,255,255,0.95)',
    width: ms(28),
    height: ms(28),
    borderRadius: ms(14),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  miniAppBadgeText: {
    fontSize: ms(12),
  },
  ratingOverlayRight: {
    position: 'absolute',
    bottom: vs(10),
    right: hs(10),
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: vs(2),
    paddingHorizontal: hs(6),
    borderRadius: ms(4),
    borderWidth: 0.5,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingOverlayText: {
    fontSize: ms(8),
    fontWeight: '900',
    color: '#f59e0b',
  },
  cardTitle: {
    fontSize: ms(12),
    fontWeight: '900',
    color: '#0f172a',
    marginTop: vs(12),
  },
  cardSubtitle: {
    fontSize: ms(9.5),
    color: '#94a3b8',
    fontWeight: '700',
    marginTop: vs(4),
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: vs(14),
    paddingTop: vs(10),
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  promoPrice: {
    fontSize: ms(12.5),
    fontWeight: '900',
    color: '#1E5D44',
  },
  originalPrice: {
    fontSize: ms(9.5),
    color: '#94a3b8',
    textDecorationLine: 'line-through',
    fontWeight: '600',
    marginLeft: hs(6),
  },
  orderBadge: {
    backgroundColor: '#1E5D44',
    paddingVertical: vs(4),
    paddingHorizontal: hs(12),
    borderRadius: ms(20),
  },
  orderBadgeText: {
    color: '#ffffff',
    fontSize: ms(8.5),
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heartBtn: {
    position: 'absolute',
    bottom: vs(10),
    right: hs(10),
    backgroundColor: 'rgba(255,255,255,0.95)',
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(8),
    paddingTop: vs(8),
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: hs(12),
  },
  detailText: {
    fontSize: ms(9),
    color: '#64748b',
    fontWeight: '700',
    marginLeft: hs(3),
  },
  historyCategoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    marginTop: vs(10),
    marginBottom: vs(8),
  },
  historyCategoryTitle: {
    fontSize: ms(9),
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: hs(6),
  },
  historyCategoryDot: {
    width: vs(6),
    height: vs(6),
    borderRadius: ms(3),
  },
  historyScrollContent: {
    paddingLeft: hs(16),
    paddingRight: hs(4),
    paddingBottom: vs(10),
  },
  historyItemCard: {
    width: hs(256),
    backgroundColor: '#ffffff',
    borderRadius: ms(20),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: hs(12),
    marginRight: hs(12),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.01,
    shadowRadius: 4,
    elevation: 1,
    position: 'relative',
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: hs(10),
  },
  historyImgWrapper: {
    width: ms(46),
    height: ms(46),
    borderRadius: ms(12),
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f8fafc',
    borderWidth: 0.5,
    borderColor: '#e2e8f0',
  },
  historyImg: {
    width: '100%',
    height: '100%',
  },
  historyIconStamp: {
    position: 'absolute',
    bottom: vs(2),
    right: hs(2),
    backgroundColor: 'rgba(255,255,255,0.95)',
    width: ms(16),
    height: ms(16),
    borderRadius: ms(8),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  historyIconText: {
    fontSize: ms(8),
  },
  historyTextCol: {
    marginLeft: hs(10),
    flex: 1,
  },
  historyName: {
    fontSize: ms(10),
    fontWeight: '900',
    color: '#0f172a',
  },
  historyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: vs(3),
    paddingHorizontal: hs(8),
    borderRadius: ms(8),
    marginTop: vs(4),
  },
  historyAddBtnAdded: {
    backgroundColor: '#10b981',
  },
  historyAddBtnText: {
    fontSize: ms(8),
    fontWeight: '900',
    color: '#334155',
    textTransform: 'uppercase',
  },
  historyAddBtnTextAdded: {
    color: '#ffffff',
  },
  recommendationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: hs(16),
    gap: hs(12),
    paddingBottom: vs(8),
  },
  recommendationCard: {
    backgroundColor: '#ffffff',
    borderRadius: ms(24),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: hs(14),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
    marginBottom: vs(12),
  },
  recommendationCardImageContainer: {
    height: vs(110),
    width: '100%',
    borderRadius: ms(16),
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f8fafc',
  },
  recommendationCardImg: {
    width: '100%',
    height: '100%',
  },
  recommendationCardTitle: {
    fontSize: ms(11),
    fontWeight: '900',
    color: '#0f172a',
    marginTop: vs(10),
  },
  recommendationCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: vs(10),
    paddingTop: vs(8),
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  diningCard: {
    width: hs(256),
    backgroundColor: '#ffffff',
    borderRadius: ms(24),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: hs(14),
    marginRight: hs(12),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  diningCardImageWrap: {
    height: vs(128),
    width: '100%',
    borderRadius: ms(16),
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f8fafc',
  },
  diningCardImg: {
    width: '100%',
    height: '100%',
  },
  diningCardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: vs(50),
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  diningRatingBadge: {
    position: 'absolute',
    top: vs(10),
    left: hs(10),
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: vs(3),
    paddingHorizontal: hs(8),
    borderRadius: ms(6),
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  diningRatingText: {
    color: '#fbbf24',
    fontSize: ms(9),
    fontWeight: '900',
    marginLeft: hs(3),
  },
  diningTrendingBadge: {
    position: 'absolute',
    top: vs(10),
    right: hs(10),
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: vs(3),
    paddingHorizontal: hs(8),
    borderRadius: ms(6),
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#e2e8f0',
  },
  diningTrendingText: {
    color: '#dc2626',
    fontSize: ms(8),
    fontWeight: '900',
    marginLeft: hs(3),
    textTransform: 'uppercase',
  },
  diningName: {
    fontSize: ms(12),
    fontWeight: '900',
    color: '#0f172a',
    marginTop: vs(10),
  },
  diningCuisine: {
    fontSize: ms(9.5),
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: vs(2),
  },
  diningPrice: {
    fontSize: ms(11),
    fontWeight: '900',
    color: '#1E5D44',
    marginTop: vs(6),
  },
});
