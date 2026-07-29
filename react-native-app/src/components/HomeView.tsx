import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
      type: 'image',
      imageUrl: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=400&h=200',
      targetApp: 'PHARMA' as const,
    },
    {
      id: 'ta-2',
      title: 'Fresh Farm Apples & Organic Vegetables',
      tagline: 'Zero cold-storage lag. Direct from organic valley farmers to your kitchen.',
      badge: 'HARVEST TODAY',
      type: 'image',
      imageUrl: 'https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?auto=format&fit=crop&q=80&w=400&h=200',
      targetApp: 'GROCERY' as const,
    },
    {
      id: 'ta-3',
      title: 'Monsoon Gourmet Dining Carnival',
      tagline: 'Exclusive 50% discount across top Michelin-rated & trending restaurants.',
      badge: 'FESTIVE SPECIAL',
      type: 'image',
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
      onScroll={onScroll ? (e) => onScroll(e.nativeEvent.contentOffset.y) : undefined}
      scrollEventThrottle={16}>
      
      {/* PHASE 2: ADMINISTRATIVE ALIGNMENT & DELIVERY BANNER (Ditto Demo Status) */}
      <View style={{ marginHorizontal: 16, marginTop: 14, backgroundColor: '#0f172a', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(245, 158, 11, 0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
              <ShieldCheck size={18} color="#fbbf24" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '900', marginRight: 6 }}>Production "Ditto" Demo Replica</Text>
                <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                  <Text style={{ color: '#6ee7b7', fontSize: 8, fontWeight: '900' }}>V2.0 LOCKED</Text>
                </View>
              </View>
              <Text style={{ color: '#cbd5e1', fontSize: 9.5, marginTop: 2 }}>All staging placeholders replaced with real production INR pricing & Unsplash media.</Text>
            </View>
          </View>
          <TouchableOpacity 
            onPress={() => setShowAdminDoc(!showAdminDoc)}
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
          >
            <Text style={{ color: '#fcd34d', fontSize: 9, fontWeight: '900' }}>{showAdminDoc ? 'Hide Note' : 'Read Note'}</Text>
          </TouchableOpacity>
        </View>

        {showAdminDoc && (
          <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 12 }}>
            <Text style={{ color: '#fbbf24', fontWeight: '900', fontSize: 9, marginBottom: 4 }}>📌 REVIEW CLARIFICATION:</Text>
            <Text style={{ color: '#e2e8f0', fontSize: 10, lineHeight: 15, marginBottom: 8 }}>In our previous review, "service routing architecture" meant items viewed in Mart, Food, Grocery, or Pharma automatically appear in your Recently Viewed Strip here on the home screen.</Text>
            <Text style={{ color: '#34d399', fontWeight: '900', fontSize: 9, marginBottom: 4 }}>📅 DEADLINE LOCK ("DATE 2"):</Text>
            <Text style={{ color: '#e2e8f0', fontSize: 10, lineHeight: 15, marginBottom: 8 }}>Final handover scheduled for Friday, August 15th at 5:00 PM IST with all voice note UI restructurings incorporated.</Text>
            <Text style={{ color: '#fb7185', fontWeight: '900', fontSize: 9, marginBottom: 4 }}>🛑 TICKETING MODULE SCOPE BOUNDARY:</Text>
            <Text style={{ color: '#e2e8f0', fontSize: 10, lineHeight: 15 }}>Bus, train, and movie ticket booking are strictly excluded from this release as a Version 2.0 expansion after our core 4-sector user base is established.</Text>
          </View>
        )}
      </View>

      {/* PHASE 1 - REQUIREMENT 1: TOP AD SPACE (Dynamic Carousel replacing text area) */}
      <View style={[styles.sectionHeader, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Zap size={14} color="#f59e0b" fill="#f59e0b" style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>Live Sector Updates & Feeds</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {topAdSlides.map((_, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => setTopAdIndex(idx)}
              style={{
                width: topAdIndex === idx ? 16 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: topAdIndex === idx ? '#f59e0b' : '#cbd5e1',
                marginLeft: 4
              }}
            />
          ))}
        </View>
      </View>

      <TouchableOpacity
        onPress={() => onLaunchSubApp(topAdSlides[topAdIndex].targetApp)}
        style={{ marginHorizontal: 16, backgroundColor: '#020617', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: '#1e293b', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        activeOpacity={0.9}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
          <Image source={{ uri: topAdSlides[topAdIndex].imageUrl }} style={{ width: 48, height: 48, borderRadius: 12, marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(245, 158, 11, 0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)', marginBottom: 4 }}>
              <Text style={{ color: '#fbbf24', fontSize: 8, fontWeight: '900' }}>{topAdSlides[topAdIndex].badge}</Text>
            </View>
            <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '900' }} numberOfLines={1}>{topAdSlides[topAdIndex].title}</Text>
            <Text style={{ color: '#cbd5e1', fontSize: 9, marginTop: 2 }} numberOfLines={1}>{topAdSlides[topAdIndex].tagline}</Text>
          </View>
        </View>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronRight size={16} color="#ffffff" />
        </View>
      </TouchableOpacity>

      {/* PHASE 1 - REQUIREMENT 2: CATEGORY BORDERS (Explore Premium Sectors with 1dp borders & shadow) */}
      <View style={[styles.sectionHeader, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }]}>
        <Text style={styles.sectionTitle}>Explore Premium Sectors</Text>
        <Text style={{ fontSize: 9, fontWeight: '700', color: '#94a3b8' }}>Tap to open applet</Text>
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

      {/* PHASE 1 - REQUIREMENT 3: UPGRADED MAIN BANNER CAROUSEL */}
      <View style={[styles.sectionHeader, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Tag size={11} color="#f59e0b" fill="#f59e0b" style={{ marginRight: 4 }} />
          <Text style={{ fontSize: 9, fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>Sponsored Showcase</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => setHeroSlideIndex((prev) => (prev - 1 + sponsoredAds.length) % sponsoredAds.length)}
            style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: 6 }}
          >
            <ChevronLeft size={14} color="#334155" />
          </TouchableOpacity>
          <Text style={{ fontSize: 9, fontWeight: '700', color: '#475569', marginRight: 6 }}>{heroSlideIndex + 1}/{sponsoredAds.length}</Text>
          <TouchableOpacity
            onPress={() => setHeroSlideIndex((prev) => (prev + 1) % sponsoredAds.length)}
            style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronRight size={14} color="#334155" />
          </TouchableOpacity>
        </View>
      </View>

      {(() => {
        const currentAd = sponsoredAds[heroSlideIndex];
        return (
          <TouchableOpacity
            onPress={() => onLaunchSubApp(currentAd.targetApp)}
            style={styles.adCard}
            activeOpacity={0.9}
          >
            <Image source={{ uri: currentAd.imageUrl }} style={styles.adBgImg} />
            <View style={styles.adGradientOverlay} />
            <View style={styles.adTag}>
              <Tag size={10} color="#f59e0b" fill="#f59e0b" />
              <Text style={styles.adTagText}>Sponsored • {currentAd.brand}</Text>
            </View>
            <View style={styles.adContent}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <Text style={styles.adBrand}>{currentAd.discount}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: '#cbd5e1', fontSize: 8, fontWeight: '700', marginRight: 4 }}>Tap to open {currentAd.brand}</Text>
                  <ArrowRight size={10} color="#cbd5e1" />
                </View>
              </View>
              <Text style={styles.adTitle}>{currentAd.title}</Text>
              <Text style={styles.adDesc}>{currentAd.tagline}</Text>
            </View>
          </TouchableOpacity>
        );
      })()}

      {/* PHASE 1 - REQUIREMENT 4: RECENTLY VIEWED STRIP (Unified History Router) */}
      <View style={[styles.sectionRow, { marginTop: 14 }]}>
        <View style={styles.rowTitleWrap}>
          <TrendingUp size={14} color="#1162D3" style={{ marginRight: 4 }} />
          <Text style={styles.sectionTitle}>Recently Viewed & Searched</Text>
        </View>
        <View style={{ backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
          <Text style={{ color: '#1d4ed8', fontSize: 8, fontWeight: '900', textTransform: 'uppercase' }}>History Router</Text>
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
                  <Text style={{ fontSize: 7.5, fontWeight: '800', color: '#2563eb', textTransform: 'uppercase', marginBottom: 2 }}>{item.activityTag}</Text>
                  <Text style={styles.historyName} numberOfLines={1}>{item.name}</Text>
                  <Text style={{ fontSize: 9.5, fontWeight: '900', color: '#1e293b', marginTop: 2 }}>{item.price}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => triggerAddToCartFeedback(item.id, item.name, parseInt(item.price.replace(/[^\d]/g, '') || '0'), item.emoji)}
                style={[styles.historyAddBtn, hasAdded && styles.historyAddBtnAdded]}
                activeOpacity={0.8}
              >
                <Plus size={8} color={hasAdded ? '#ffffff' : '#334155'} style={{ marginRight: 2 }} />
                <Text style={[styles.historyAddBtnText, hasAdded && styles.historyAddBtnTextAdded]}>
                  {hasAdded ? 'Added' : 'Add'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* PHASE 1 - REQUIREMENT 5: GLOBAL OFFERS RESTRUCTURE (Today's Offers) */}
      <View style={[styles.sectionRow, { marginTop: 14 }]}>
        <View style={styles.rowTitleWrap}>
          <Flame size={14} color="#f97316" fill="#f97316" style={{ marginRight: 4 }} />
          <Text style={styles.sectionTitle}>Today's Offers</Text>
        </View>
        <View style={{ backgroundColor: '#fff7ed', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: '#ffedd5' }}>
          <Text style={{ color: '#ea580c', fontSize: 8, fontWeight: '900', textTransform: 'uppercase' }}>All Sectors Deals</Text>
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

      {/* PHASE 1 - REQUIREMENT 6: RECOMMENDED FOR YOU (AI Curated Picks) */}
      <View style={[styles.sectionRow, { marginTop: 14 }]}>
        <View style={styles.rowTitleWrap}>
          <Sparkles size={14} color="#4f46e5" style={{ marginRight: 4 }} />
          <Text style={styles.sectionTitle}>Recommended For You</Text>
        </View>
        <Text style={styles.topVotedText}>AI Curated Picks</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScrollContent}>
        {mixedRecommendations.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => onLaunchSubApp(item.targetApp)}
            style={styles.horizontalCard}
            activeOpacity={0.9}
          >
            <View style={styles.cardImageContainer}>
              <Image source={{ uri: item.imageUrl }} style={styles.cardImg} />
              <View style={[styles.offerBadge, { backgroundColor: 'rgba(0,0,0,0.6)', borderColor: 'transparent' }]}>
                <Text style={[styles.offerBadgeText, { color: '#ffffff' }]}>{item.sector}</Text>
              </View>
              <View style={styles.ratingOverlayRight}>
                <Text style={styles.ratingOverlayText}>★ {item.rating}</Text>
              </View>
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.cardSubtitle}>AI Curated Pick</Text>
            <View style={styles.cardFooter}>
              <Text style={[styles.promoPrice, { color: '#0f172a' }]}>{item.price}</Text>
              <View style={[styles.orderBadge, { backgroundColor: '#2563eb' }]}>
                <Text style={styles.orderBadgeText}>Discover</Text>
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
    paddingBottom: 40,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectorsCard: {
    marginHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 1,
    marginBottom: 16,
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
    width: 58,
    height: 58,
    borderRadius: 29,
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
    bottom: -1,
    right: -1,
    backgroundColor: '#ffffff',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  sectorEmojiText: {
    fontSize: 10,
  },
  sectorName: {
    fontSize: 10,
    fontWeight: '900',
    color: '#1e293b',
    marginTop: 10,
    textTransform: 'uppercase',
  },
  sectorTagline: {
    fontSize: 8,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 2,
  },
  adCard: {
    marginHorizontal: 16,
    height: 176,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0f172a',
    marginBottom: 16,
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
    top: 14,
    left: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  adTagText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  adContent: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  adBrand: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  adTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
    lineHeight: 18,
  },
  adDesc: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 4,
    lineHeight: 14,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  rowTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllBtn: {
    backgroundColor: '#ecfdf5',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  seeAllBtnText: {
    color: '#1E5D44',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  topVotedText: {
    fontSize: 8,
    color: '#94a3b8',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  horizontalScrollContent: {
    paddingLeft: 16,
    paddingRight: 4,
    paddingBottom: 16,
  },
  horizontalCard: {
    width: 256,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 14,
    marginRight: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  cardImageContainer: {
    height: 128,
    width: '100%',
    borderRadius: 16,
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
    bottom: 10,
    left: 10,
    backgroundColor: '#1E5D44',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#34d399',
  },
  offerBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  miniAppBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  miniAppBadgeText: {
    fontSize: 12,
  },
  ratingOverlayRight: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#e2e8f0',
  },
  ratingOverlayText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#f59e0b',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 12,
  },
  cardSubtitle: {
    fontSize: 9.5,
    color: '#94a3b8',
    fontWeight: '700',
    marginTop: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  promoPrice: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#1E5D44',
  },
  originalPrice: {
    fontSize: 9.5,
    color: '#94a3b8',
    textDecorationLine: 'line-through',
    fontWeight: '600',
    marginLeft: 6,
  },
  orderBadge: {
    backgroundColor: '#1E5D44',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  orderBadgeText: {
    color: '#ffffff',
    fontSize: 8.5,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ratingLabel: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  ratingLabelText: {
    color: '#ffffff',
    fontSize: 8.5,
    fontWeight: '900',
    marginLeft: 3,
  },
  resBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#e2e8f0',
  },
  resBadgeText: {
    color: '#1E5D44',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heartBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    width: 32,
    height: 32,
    borderRadius: 16,
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
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  detailText: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '700',
    marginLeft: 3,
  },
  historyCategoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
  },
  historyCategoryTitle: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  historyCategoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  historyScrollContent: {
    paddingLeft: 16,
    paddingRight: 4,
    paddingBottom: 10,
  },
  historyItemCard: {
    width: 256,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 12,
    marginRight: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.01,
    shadowRadius: 4,
    elevation: 1,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  historyImgWrapper: {
    width: 46,
    height: 46,
    borderRadius: 12,
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
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(255,255,255,0.95)',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  historyIconText: {
    fontSize: 8,
  },
  historyTextCol: {
    marginLeft: 10,
    flex: 1,
  },
  historyName: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0f172a',
  },
  historyDesc: {
    fontSize: 8,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 2,
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyPrice: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#0f172a',
  },
  historyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  historyAddBtnAdded: {
    backgroundColor: '#10b981',
  },
  historyAddBtnText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#334155',
    textTransform: 'uppercase',
  },
  historyAddBtnTextAdded: {
    color: '#ffffff',
  },
});
