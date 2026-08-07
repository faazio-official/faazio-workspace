import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Image, Animated } from 'react-native';
import {
  Shirt,
  Smartphone,
  Sparkles,
  Star,
  ShoppingCart,
  CheckCircle,
  ShoppingBag,
  TrendingUp,
  Gift,
  BookOpen,
  Armchair,
  Clock,
  MapPin,
  ShieldCheck,
  AlertCircle,
  RotateCcw,
  ChevronRight,
  Store,
} from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { hs, vs, ms } from '@/utils/responsive';
import { martProducts } from '@data/mart/products';
import { martStores } from '@data/mart/stores';
import type { StoreProfile, MartProduct } from '@data/types';
import MartProductCard from '@/features/ecommerce/cards/MartProductCard';
import StoreCardBase from '@/components/shared/StoreCardBase';
import AppText from '@/components/AppText';

const badgeBgHex: Record<string, string> = {
  'bg-amber': '#f59e0b',
  'bg-red': '#ef4444',
  'bg-blue': '#3b82f6',
  'bg-indigo': '#6366f1',
  'bg-emerald': '#10b981',
  'bg-rose': '#f43f5e',
  'bg-purple': '#a855f7',
  'bg-sky': '#0ea5e9',
  'bg-stone': '#78716c',
  'bg-slate': '#64748b',
};

const resolveBadgeBg = (bg: string): string => {
  const prefix = Object.keys(badgeBgHex).find((k) => bg.startsWith(k));
  return prefix ? badgeBgHex[prefix] : '#1162D3';
};

const matchCategory = (product: MartProduct, catName: string): boolean => {
  if (catName === 'All') return true;
  const mapping: Record<string, string[]> = {
    'Mobile & Electronics': ['Mobiles', 'Electronics'],
    'Toys & Gifts': ['Toys', 'Toys & Gifts'],
    'Books & Stationery': ['Books & Stationery'],
    'Home Appliances': ['Home Appliances'],
    'Furniture': ['Furniture'],
  };
  if (catName === 'Fashion') return product.category === 'Fashion';
  if (catName === 'Beauty') return product.category === 'Beauty';
  if (catName === 'Sports') return product.category === 'Sports';
  const cats = mapping[catName];
  if (!cats) return product.category === catName;
  return cats.includes(product.category);
};

const formatCountdown = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}h : ${String(m).padStart(2, '0')}m : ${String(sec).padStart(2, '0')}s`;
};

interface FaMartScreenProps {
  addToCart?: (id: string, name: string, price: number, emoji: string) => void;
  onProductClick?: (product: any) => void;
  searchQuery?: string;
}

export function FaMartScreen({ addToCart, onProductClick, searchQuery = '' }: FaMartScreenProps) {
  const [selectedSubCat, setSelectedSubCat] = useState<string>('All');
  const [selectedStore, setSelectedStore] = useState<StoreProfile | null>(null);
  const [displayedBannerIdx, setDisplayedBannerIdx] = useState<number>(0);
  const [addedAnimationId, setAddedAnimationId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(2 * 3600 + 14 * 60 + 45);

  const bannerAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 4000,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [rotateAnim]);

  useEffect(() => {
    if (selectedSubCat !== 'All') return;
    const timer = setInterval(() => {
      Animated.timing(bannerAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setDisplayedBannerIdx((prev) => (prev + 1) % banners.length);
        Animated.timing(bannerAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [selectedSubCat, bannerAnim]);

  const banners = [
    {
      title: 'Electronic Bonanza Sale',
      subtitle: 'UP TO 50% OFF',
      desc: 'Top deals on audio & smartphones with premium glass screens',
      image:
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=600&h=300',
      accent: '#1162D3',
      category: 'Mobile & Electronics',
    },
    {
      title: 'Great Winter Collection',
      subtitle: 'FLAT 40% OFF',
      desc: 'Chic luxury fashion curated for modern premium street style',
      image:
        'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=600&h=300',
      accent: '#E040FB',
      category: 'Fashion',
    },
    {
      title: 'Smart Home Upgrades',
      subtitle: 'UP TO 60% OFF',
      desc: 'Air purifiers, smart lights & kitchen appliances at unbeatable prices',
      image:
        'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&q=80&w=600&h=300',
      accent: '#10B981',
      category: 'Home Appliances',
    },
  ];

  const subCategories = [
    { name: 'All', icon: ShoppingBag },
    { name: 'Mobile & Electronics', icon: Smartphone },
    { name: 'Fashion', icon: Shirt },
    { name: 'Beauty', icon: Sparkles },
    { name: 'Toys & Gifts', icon: Gift },
    { name: 'Books & Stationery', icon: BookOpen },
    { name: 'Home Appliances', icon: Armchair },
    { name: 'Furniture', icon: Armchair },
    { name: 'Sports', icon: TrendingUp },
  ];

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredStores =
    selectedSubCat === 'All'
      ? martStores
      : martStores.filter((s) => s.categories.includes(selectedSubCat));
  const filteredStoresWithSearch = normalizedSearch
    ? filteredStores.filter((s) => s.name.toLowerCase().includes(normalizedSearch))
    : filteredStores;

  const flashDealProducts = martProducts.slice(0, 6);

  const filteredProducts =
    selectedSubCat === 'All'
      ? martProducts
      : martProducts.filter((p) => matchCategory(p, selectedSubCat));
  const filteredProductsWithSearch = normalizedSearch
    ? filteredProducts.filter((p) => p.name.toLowerCase().includes(normalizedSearch))
    : filteredProducts;

  const currentBannerData =
    selectedSubCat === 'All'
      ? banners[displayedBannerIdx]
      : banners.find((b) => b.category === selectedSubCat) || banners[0];

  const handleAddWithFeedback = (id: string, name: string, price: number, emoji: string) => {
    if (addToCart) addToCart(id, name, price, emoji);
    setAddedAnimationId(id);
    setTimeout(() => {
      setAddedAnimationId(null);
    }, 1500);
  };

  const handleChipPress = (name: string) => {
    setSelectedSubCat(name);
    setSelectedStore(null);
    if (name !== 'All') return;
    Animated.timing(bannerAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setDisplayedBannerIdx(0);
      Animated.timing(bannerAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const renderBannerImage = (banner: (typeof banners)[0], index: number) => {
    const isCrossfade =
      selectedSubCat === 'All' &&
      index !== displayedBannerIdx &&
      index === (displayedBannerIdx - 1 + banners.length) % banners.length;

    const animStyle =
      isCrossfade
        ? {
            opacity: bannerAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0],
            }),
          }
        : index === displayedBannerIdx || selectedSubCat !== 'All'
          ? { opacity: selectedSubCat === 'All' ? bannerAnim : 1 }
          : { opacity: 0 };

    return (
      <Animated.View
        key={index}
        style={[
          styles.bannerAbsolute,
          animStyle,
          { zIndex: index === displayedBannerIdx || selectedSubCat !== 'All' ? 2 : 1 },
        ]}
      >
        <Image source={{ uri: banner.image }} style={styles.bannerBgImage} resizeMode="cover" />
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`banner-grad-${index}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={banner.accent} stopOpacity="0.95" />
              <Stop offset="0.5" stopColor={banner.accent} stopOpacity="0.7" />
              <Stop offset="1" stopColor="transparent" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#banner-grad-${index})`} />
        </Svg>
        <View style={styles.bannerContent}>
          <AppText style={styles.bannerSubtitle}>{banner.subtitle}</AppText>
          <AppText style={styles.bannerTitle}>{banner.title}</AppText>
          <AppText style={styles.bannerDesc} numberOfLines={2}>
            {banner.desc}
          </AppText>
          <View style={styles.bannerActionRow}>
            <TouchableOpacity
              style={[styles.bannerBtn, { backgroundColor: banner.accent }]}
              activeOpacity={0.8}
              onPress={() => {
                if (banner.category === 'Mobile & Electronics') setSelectedSubCat('Mobile & Electronics');
                else setSelectedSubCat(banner.category);
                setSelectedStore(null);
              }}
            >
              <AppText style={styles.bannerBtnText}>{`Explore ${banner.category}`}</AppText>
            </TouchableOpacity>
            <Animated.View style={{ opacity: pulseAnim }}>
              <View style={styles.countdownChip}>
                <Clock size={ms(9)} color="#be123c" />
                <AppText style={styles.countdownChipText}>{formatCountdown(timeLeft)}</AppText>
              </View>
            </Animated.View>
          </View>
          {selectedSubCat === 'All' && (
            <View style={styles.dotsRow}>
              {banners.map((_, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.dot,
                    displayedBannerIdx === idx ? styles.activeDot : styles.inactiveDot,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => {
                    Animated.timing(bannerAnim, {
                      toValue: 0,
                      duration: 200,
                      useNativeDriver: true,
                    }).start(() => {
                      setDisplayedBannerIdx(idx);
                      Animated.timing(bannerAnim, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: true,
                      }).start();
                    });
                  }}
                />
              ))}
            </View>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
      {/* Category chips */}
      <View style={styles.sectionContainer}>
        <AppText style={styles.sectionTitle}>Explore Mall Categories</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subCatScrollList}>
          {subCategories.map((sub) => {
            const isSelected = selectedSubCat === sub.name;
            const Icon = sub.icon;
            return (
              <TouchableOpacity
                key={sub.name}
                style={[styles.subCatBtn, isSelected ? styles.subCatBtnActive : styles.subCatBtnInactive]}
                activeOpacity={0.8}
                onPress={() => handleChipPress(sub.name)}
              >
                <View style={[styles.subCatIconBg, { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : '#f1f5f9' }]}>
                  <Icon size={ms(12)} color={isSelected ? '#ffffff' : '#475569'} />
                </View>
                <AppText style={[styles.subCatText, isSelected ? styles.subCatTextActive : styles.subCatTextInactive]}>
                  {sub.name}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Banner */}
      <View style={styles.bannerContainer}>
        <View style={styles.bannerBg}>
          {selectedSubCat === 'All'
            ? banners.map((b, i) => renderBannerImage(b, i))
            : renderBannerImage(currentBannerData, 0)}
        </View>
      </View>

      {/* Flash Deals */}
      <View style={styles.flashDealsSection}>
        <View style={styles.flashDealsHeader}>
          <View style={styles.flashDealsTitleGroup}>
            <TrendingUp size={ms(14)} color="#ef4444" />
            <AppText style={styles.flashDealsTitle}>Flash Deals</AppText>
            <Animated.View style={{ transform: [{ rotate: rotation }] }}>
              <Clock size={ms(13)} color="#1162D3" />
            </Animated.View>
          </View>
          <Animated.View style={{ opacity: pulseAnim }}>
            <View style={styles.countdownChipSm}>
              <AppText style={styles.countdownChipSmText}>Ends in {formatCountdown(timeLeft)}</AppText>
            </View>
          </Animated.View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.flashDealsScroll}>
          {flashDealProducts.map((product) => {
            const isAdded = addedAnimationId === product.id;
            return (
              <TouchableOpacity
                key={product.id}
                style={styles.flashCard}
                activeOpacity={0.8}
                onPress={() => onProductClick && onProductClick({ ...product, app: 'MART' })}
              >
                <View style={styles.flashImageContainer}>
                  <Image source={{ uri: product.image }} style={styles.flashImage} resizeMode="cover" />
                  <View style={styles.flashBadge}>
                    <AppText style={styles.flashBadgeText}>FLASH SALE</AppText>
                  </View>
                </View>
                <View style={styles.flashInfo}>
                  <View style={styles.flashRatingRow}>
                    <AppText style={styles.flashCategory}>{product.category}</AppText>
                    <View style={styles.flashStarRow}>
                      <Star size={ms(8)} color="#f59e0b" fill="#f59e0b" />
                      <AppText style={styles.flashRatingText}>{product.rating}</AppText>
                    </View>
                  </View>
                  <AppText style={styles.flashName} numberOfLines={1}>
                    {product.name}
                  </AppText>
                  <View style={styles.flashPriceRow}>
                    <AppText style={styles.flashPrice}>₹{(product.price * 0.7).toFixed(0)}</AppText>
                    <AppText style={styles.flashOriginalPrice}>₹{(product.price * 1.3).toFixed(0)}</AppText>
                  </View>
                  <TouchableOpacity
                    style={[styles.flashAddBtn, isAdded && styles.flashAddBtnSuccess]}
                    activeOpacity={0.8}
                    onPress={() =>
                      handleAddWithFeedback(product.id, product.name, product.price, product.emoji)
                    }
                  >
                    {isAdded ? (
                      <View style={styles.flashAddedRow}>
                        <CheckCircle size={ms(10)} color="#ffffff" />
                        <AppText style={styles.flashAddBtnText}>Added</AppText>
                      </View>
                    ) : (
                      <AppText style={styles.flashAddBtnText}>+ Add</AppText>
                    )}
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Vendors Directory */}
      <View style={styles.vendorSection}>
        <View style={styles.vendorHeader}>
          <View style={styles.vendorTitleGroup}>
            <Store size={ms(14)} color="#1162D3" />
            <AppText style={styles.vendorTitle}>
              {selectedSubCat === 'All' ? 'All Mall Vendors' : `${selectedSubCat} Vendors`}
            </AppText>
          </View>
          <View style={styles.vendorCountChip}>
            <AppText style={styles.vendorCountText}>{filteredStoresWithSearch.length} stores</AppText>
          </View>
        </View>
        {filteredStoresWithSearch.map((store) => (
          <TouchableOpacity
            key={store.id}
            style={styles.vendorCard}
            activeOpacity={0.8}
            onPress={() => setSelectedStore(store)}
          >
            <View style={styles.vendorCoverContainer}>
              <Image source={{ uri: store.coverImage }} style={styles.vendorCoverImage} resizeMode="cover" />
              <Svg style={styles.vendorCoverGradient}>
                <Defs>
                  <LinearGradient id={`vendor-${store.id}`} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="transparent" stopOpacity="0" />
                    <Stop offset="1" stopColor="rgba(15,23,42,0.7)" stopOpacity="0.7" />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill={`url(#vendor-${store.id})`} />
              </Svg>
              <AppText style={styles.vendorEmojiOverlay}>{store.emoji}</AppText>
            </View>
            <View style={styles.vendorInfo}>
              <View style={styles.vendorNameRow}>
                <AppText style={styles.vendorName} numberOfLines={1}>
                  {store.name}
                </AppText>
                <View style={styles.vendorRatingChip}>
                  <Star size={ms(9)} color="#f59e0b" fill="#f59e0b" />
                  <AppText style={styles.vendorRatingText}>{store.rating}</AppText>
                </View>
              </View>
              <View style={styles.vendorMetaRow}>
                <View style={styles.vendorMetaChip}>
                  <Clock size={ms(9)} color="#64748b" />
                  <AppText style={styles.vendorMetaText}>{store.deliveryTime}</AppText>
                </View>
                <View style={styles.vendorMetaChip}>
                  <MapPin size={ms(9)} color="#64748b" />
                  <AppText style={styles.vendorMetaText}>{store.distance}</AppText>
                </View>
                {store.offerTag && (
                  <View style={styles.vendorOfferChip}>
                    <AppText style={styles.vendorOfferText} numberOfLines={1}>
                      🔥 {store.offerTag}
                    </AppText>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.vendorChevron}>
              <ChevronRight size={ms(16)} color="#94a3b8" />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Store Profile drill-in */}
      {selectedStore ? (
        <View style={styles.storeProfileSection}>
          {/* Back pill */}
          <TouchableOpacity
            style={styles.backPill}
            activeOpacity={0.8}
            onPress={() => setSelectedStore(null)}
          >
            <AppText style={styles.backPillText}>← Back to {selectedSubCat}</AppText>
          </TouchableOpacity>

          {/* Verified Partner */}
          <View style={styles.verifiedChip}>
            <ShieldCheck size={ms(10)} color="#ffffff" />
            <AppText style={styles.verifiedChipText}>Verified Partner</AppText>
          </View>

          {/* Hero cover */}
          <View style={styles.storeHero}>
            <Image source={{ uri: selectedStore.coverImage }} style={styles.storeHeroImage} resizeMode="cover" />
            <View style={styles.storeHeroOverlay} />
            <View style={styles.storeRatingPill}>
              <Star size={ms(10)} color="#f59e0b" fill="#f59e0b" />
              <AppText style={styles.storeRatingText}>{selectedStore.rating}</AppText>
              {selectedStore.reviewsCount && (
                <AppText style={styles.storeReviewsText}>({selectedStore.reviewsCount})</AppText>
              )}
            </View>
          </View>

          {/* Emoji tile */}
          <View style={styles.storeEmojiTile}>
            <AppText style={styles.storeEmojiText}>{selectedStore.emoji}</AppText>
          </View>

          {/* Pulsing offer tag */}
          {selectedStore.offerTag && (
            <Animated.View style={[styles.storeOfferTag, { opacity: pulseAnim }]}>
              <AlertCircle size={ms(10)} color="#dc2626" />
              <AppText style={styles.storeOfferText}>{selectedStore.offerTag}</AppText>
            </Animated.View>
          )}

          {/* Store name & categories */}
          <AppText style={styles.storeProfileName}>{selectedStore.name}</AppText>
          <AppText style={styles.storeProfileDesc}>{selectedStore.desc}</AppText>
          <AppText style={styles.storeCategoriesText}>{selectedStore.categories.join(' • ')}</AppText>

          {/* Product catalog header */}
          <View style={styles.storeCatalogHeader}>
            <AppText style={styles.storeCatalogTitle}>Store Product Catalog</AppText>
            <View style={styles.deliveryPill}>
              <Clock size={ms(9)} color="#ffffff" />
              <AppText style={styles.deliveryPillText}>Instant Delivery</AppText>
            </View>
          </View>

          {/* 2-column product grid */}
          <View style={styles.storeProductsGrid}>
            {martProducts.map((product) => (
              <MartProductCard
                key={product.id}
                product={{ ...product, shop: selectedStore.name }}
                isAdded={addedAnimationId === product.id}
                onPress={() => onProductClick && onProductClick({ ...product, app: 'MART', shop: selectedStore.name })}
                onAdd={() => handleAddWithFeedback(product.id, product.name, product.price, product.emoji)}
              />
            ))}
          </View>
        </View>
      ) : selectedSubCat === 'All' ? (
        /* Product Grid (only when 'All') */
        <View style={styles.gridSection}>
          <View style={styles.gridHeader}>
            <View style={styles.gridTitleGroup}>
              <TrendingUp size={ms(14)} color="#1162D3" />
              <AppText style={styles.gridTitleText}>All Trending Products</AppText>
            </View>
            <View style={styles.authenticChip}>
              <ShieldCheck size={ms(9)} color="#ffffff" />
              <AppText style={styles.authenticChipText}>100% Authentic</AppText>
            </View>
          </View>
          <View style={styles.productsGrid}>
            {filteredProductsWithSearch.map((product) => (
              <MartProductCard
                key={product.id}
                product={{ ...product, app: 'MART' as const }}
                isAdded={addedAnimationId === product.id}
                onPress={() => onProductClick && onProductClick({ ...product, app: 'MART' })}
                onAdd={() => handleAddWithFeedback(product.id, product.name, product.price, product.emoji)}
              />
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  contentContainer: {
    paddingBottom: vs(24),
  },
  sectionContainer: {
    marginTop: vs(16),
  },
  sectionTitle: {
    fontSize: ms(11),
    fontWeight: '900',
    color: '#0f172a',
    paddingHorizontal: hs(20),
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: vs(8),
  },
  subCatScrollList: {
    paddingHorizontal: hs(16),
    gap: hs(10),
  },
  subCatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
    paddingHorizontal: hs(12),
    paddingVertical: vs(8),
    borderRadius: ms(16),
    borderWidth: 1,
  },
  subCatBtnActive: {
    backgroundColor: '#1162D3',
    borderColor: '#1162D3',
    transform: [{ scale: 1.05 }],
  },
  subCatBtnInactive: {
    backgroundColor: '#ffffff',
    borderColor: '#f1f5f9',
  },
  subCatIconBg: {
    width: hs(22),
    height: hs(22),
    borderRadius: ms(7),
    alignItems: 'center',
    justifyContent: 'center',
  },
  subCatText: {
    fontSize: ms(10),
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  subCatTextActive: {
    color: '#ffffff',
  },
  subCatTextInactive: {
    color: '#334155',
  },
  bannerContainer: {
    paddingHorizontal: hs(16),
    paddingTop: vs(12),
  },
  bannerBg: {
    height: vs(150),
    borderRadius: ms(20),
    overflow: 'hidden',
    position: 'relative',
  },
  bannerAbsolute: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: ms(20),
    overflow: 'hidden',
  },
  bannerBgImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  bannerContent: {
    position: 'absolute',
    left: hs(20),
    right: hs(20),
    top: vs(16),
    bottom: vs(16),
    zIndex: 10,
    justifyContent: 'center',
    maxWidth: '65%',
  },
  bannerSubtitle: {
    fontSize: ms(9),
    fontWeight: '900',
    letterSpacing: 1.5,
    color: '#34d399',
    textTransform: 'uppercase',
  },
  bannerTitle: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#ffffff',
    marginTop: vs(4),
  },
  bannerDesc: {
    fontSize: ms(10),
    color: '#e2e8f0',
    fontWeight: '500',
    marginTop: vs(6),
    lineHeight: ms(14),
  },
  bannerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    marginTop: vs(10),
  },
  bannerBtn: {
    paddingHorizontal: hs(16),
    paddingVertical: vs(6),
    borderRadius: ms(16),
  },
  bannerBtnText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: ms(9),
    letterSpacing: 1,
  },
  countdownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: hs(8),
    paddingVertical: vs(4),
    borderRadius: ms(12),
  },
  countdownChipText: {
    color: '#be123c',
    fontSize: ms(8),
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  countdownChipSm: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: hs(8),
    paddingVertical: vs(3),
    borderRadius: ms(10),
  },
  countdownChipSmText: {
    color: '#be123c',
    fontSize: ms(8),
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    marginTop: vs(8),
  },
  dot: {
    height: vs(6),
    borderRadius: ms(3),
  },
  activeDot: {
    width: hs(14),
    backgroundColor: '#ffffff',
  },
  inactiveDot: {
    width: hs(6),
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  flashDealsSection: {
    marginTop: vs(20),
    paddingLeft: hs(16),
  },
  flashDealsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: hs(16),
    marginBottom: vs(12),
  },
  flashDealsTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
  },
  flashDealsTitle: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#0f172a',
  },
  flashDealsScroll: {
    gap: hs(10),
    paddingRight: hs(16),
  },
  flashCard: {
    width: hs(140),
    backgroundColor: '#ffffff',
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  flashImageContainer: {
    width: '100%',
    height: vs(112),
    position: 'relative',
    backgroundColor: '#f8fafc',
  },
  flashImage: {
    width: '100%',
    height: '100%',
  },
  flashBadge: {
    position: 'absolute',
    top: vs(6),
    left: hs(6),
    backgroundColor: '#f43f5e',
    paddingHorizontal: hs(6),
    paddingVertical: vs(2),
    borderRadius: ms(6),
  },
  flashBadgeText: {
    color: '#ffffff',
    fontSize: ms(7),
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  flashInfo: {
    padding: hs(10),
  },
  flashRatingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(4),
  },
  flashCategory: {
    fontSize: ms(8),
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  flashStarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(2),
  },
  flashRatingText: {
    fontSize: ms(8),
    fontWeight: '900',
    color: '#0f172a',
  },
  flashName: {
    fontSize: ms(10),
    fontWeight: '900',
    color: '#0f172a',
    lineHeight: ms(13),
    marginBottom: vs(4),
  },
  flashPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    marginBottom: vs(6),
  },
  flashPrice: {
    fontSize: ms(12),
    fontWeight: '900',
    color: '#dc2626',
  },
  flashOriginalPrice: {
    fontSize: ms(9),
    fontWeight: '700',
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  flashAddBtn: {
    backgroundColor: '#1162D3',
    borderRadius: ms(8),
    paddingVertical: vs(5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashAddBtnSuccess: {
    backgroundColor: '#10b981',
  },
  flashAddBtnText: {
    color: '#ffffff',
    fontSize: ms(9),
    fontWeight: '900',
  },
  flashAddedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
  },
  vendorSection: {
    marginTop: vs(24),
    paddingHorizontal: hs(16),
  },
  vendorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(12),
  },
  vendorTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
  },
  vendorTitle: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#0f172a',
  },
  vendorCountChip: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: hs(10),
    paddingVertical: vs(3),
    borderRadius: ms(10),
  },
  vendorCountText: {
    color: '#1162D3',
    fontSize: ms(9),
    fontWeight: '900',
  },
  vendorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: hs(10),
    marginBottom: vs(10),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  vendorCoverContainer: {
    width: hs(64),
    height: vs(64),
    borderRadius: ms(12),
    overflow: 'hidden',
    position: 'relative',
  },
  vendorCoverImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  vendorCoverGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  vendorEmojiOverlay: {
    fontSize: ms(24),
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: vs(-12),
  },
  vendorInfo: {
    flex: 1,
    marginLeft: hs(12),
  },
  vendorNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(4),
  },
  vendorName: {
    fontSize: ms(12),
    fontWeight: '900',
    color: '#0f172a',
    flex: 1,
  },
  vendorRatingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(2),
    backgroundColor: '#fffbeb',
    paddingHorizontal: hs(6),
    paddingVertical: vs(2),
    borderRadius: ms(6),
    marginLeft: hs(6),
  },
  vendorRatingText: {
    fontSize: ms(9),
    fontWeight: '900',
    color: '#b45309',
  },
  vendorMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
    flexWrap: 'wrap',
  },
  vendorMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(3),
  },
  vendorMetaText: {
    fontSize: ms(8),
    fontWeight: '700',
    color: '#64748b',
  },
  vendorOfferChip: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: hs(6),
    paddingVertical: vs(1),
    borderRadius: ms(6),
    maxWidth: hs(120),
  },
  vendorOfferText: {
    fontSize: ms(7),
    fontWeight: '800',
    color: '#dc2626',
  },
  vendorChevron: {
    width: hs(28),
    height: hs(28),
    borderRadius: ms(14),
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: hs(8),
  },
  storeProfileSection: {
    paddingHorizontal: hs(16),
    marginTop: vs(16),
  },
  backPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: hs(14),
    paddingVertical: vs(6),
    borderRadius: ms(16),
    marginBottom: vs(8),
  },
  backPillText: {
    fontSize: ms(10),
    fontWeight: '900',
    color: '#475569',
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    backgroundColor: '#10b981',
    alignSelf: 'flex-start',
    paddingHorizontal: hs(10),
    paddingVertical: vs(3),
    borderRadius: ms(10),
    marginBottom: vs(10),
  },
  verifiedChipText: {
    color: '#ffffff',
    fontSize: ms(9),
    fontWeight: '900',
  },
  storeHero: {
    height: vs(140),
    borderRadius: ms(20),
    overflow: 'hidden',
    position: 'relative',
    marginBottom: vs(8),
  },
  storeHeroImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  storeHeroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(15,23,42,0.6)',
  },
  storeRatingPill: {
    position: 'absolute',
    top: vs(10),
    right: hs(10),
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(3),
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: hs(8),
    paddingVertical: vs(3),
    borderRadius: ms(8),
  },
  storeRatingText: {
    fontSize: ms(10),
    fontWeight: '900',
    color: '#0f172a',
  },
  storeReviewsText: {
    fontSize: ms(8),
    fontWeight: '700',
    color: '#64748b',
  },
  storeEmojiTile: {
    width: hs(56),
    height: hs(56),
    borderRadius: ms(14),
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: vs(-24),
    marginBottom: vs(8),
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  storeEmojiText: {
    fontSize: ms(24),
  },
  storeOfferTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    backgroundColor: '#fef2f2',
    paddingHorizontal: hs(10),
    paddingVertical: vs(4),
    borderRadius: ms(10),
    alignSelf: 'flex-start',
    marginBottom: vs(8),
  },
  storeOfferText: {
    fontSize: ms(9),
    fontWeight: '800',
    color: '#dc2626',
  },
  storeProfileName: {
    fontSize: ms(18),
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: vs(2),
  },
  storeProfileDesc: {
    fontSize: ms(10),
    fontWeight: '600',
    color: '#64748b',
    marginBottom: vs(4),
    lineHeight: ms(14),
  },
  storeCategoriesText: {
    fontSize: ms(10),
    fontWeight: '700',
    color: '#1162D3',
    marginBottom: vs(16),
  },
  storeCatalogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(12),
  },
  storeCatalogTitle: {
    fontSize: ms(13),
    fontWeight: '900',
    color: '#0f172a',
  },
  deliveryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    backgroundColor: '#1162D3',
    paddingHorizontal: hs(10),
    paddingVertical: vs(3),
    borderRadius: ms(10),
  },
  deliveryPillText: {
    color: '#ffffff',
    fontSize: ms(8),
    fontWeight: '900',
  },
  storeProductsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  storeProductCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: ms(16),
    marginBottom: vs(12),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  storeProductImageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
    backgroundColor: '#f8fafc',
  },
  storeProductImage: {
    width: '100%',
    height: '100%',
  },
  storeProductBadge: {
    position: 'absolute',
    top: vs(8),
    left: hs(8),
    paddingHorizontal: hs(8),
    paddingVertical: vs(3),
    borderRadius: ms(7),
  },
  storeProductBadgeText: {
    color: '#ffffff',
    fontSize: ms(7),
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  storeProductInfo: {
    padding: hs(10),
  },
  storeProductCategoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(4),
  },
  storeProductCategory: {
    fontSize: ms(8),
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  storeProductStarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(2),
  },
  storeProductRating: {
    fontSize: ms(8),
    fontWeight: '900',
    color: '#0f172a',
  },
  storeProductName: {
    fontSize: ms(10),
    fontWeight: '900',
    color: '#0f172a',
    lineHeight: ms(13),
    marginBottom: vs(2),
  },
  storeProductDesc: {
    fontSize: ms(8),
    fontWeight: '600',
    color: '#64748b',
    lineHeight: ms(11),
    marginBottom: vs(6),
  },
  storeProductFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storeProductPrice: {
    fontSize: ms(12),
    fontWeight: '900',
    color: '#1162D3',
  },
  storeProductOriginal: {
    fontSize: ms(8),
    fontWeight: '700',
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  storeAddBtn: {
    backgroundColor: '#1162D3',
    borderRadius: ms(8),
    paddingHorizontal: hs(10),
    paddingVertical: vs(5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeAddBtnSuccess: {
    backgroundColor: '#10b981',
  },
  storeAddBtnText: {
    color: '#ffffff',
    fontSize: ms(9),
    fontWeight: '900',
  },
  storeAddedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(3),
  },
  gridSection: {
    marginTop: vs(20),
    paddingHorizontal: hs(16),
  },
  gridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(12),
  },
  gridTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
  },
  gridTitleText: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#0f172a',
  },
  authenticChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    backgroundColor: '#10b981',
    paddingHorizontal: hs(8),
    paddingVertical: vs(3),
    borderRadius: ms(10),
  },
  authenticChipText: {
    color: '#ffffff',
    fontSize: ms(8),
    fontWeight: '900',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  productCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: ms(24),
    marginBottom: vs(12),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  productImageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
    backgroundColor: '#f8fafc',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productBadge: {
    position: 'absolute',
    top: vs(8),
    left: hs(8),
    paddingHorizontal: hs(8),
    paddingVertical: vs(3),
    borderRadius: ms(8),
  },
  productBadgeText: {
    color: '#ffffff',
    fontSize: ms(7),
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  productInfo: {
    padding: hs(12),
  },
  productCategoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(4),
  },
  productCategory: {
    fontSize: ms(9),
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  productStarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(2),
  },
  productRatingText: {
    fontSize: ms(9),
    fontWeight: '900',
    color: '#0f172a',
  },
  productName: {
    fontSize: ms(11),
    fontWeight: '900',
    color: '#0f172a',
    lineHeight: ms(14),
    marginBottom: vs(2),
  },
  productDesc: {
    fontSize: ms(9),
    fontWeight: '600',
    color: '#64748b',
    lineHeight: ms(12),
    marginBottom: vs(8),
  },
  productFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    fontSize: ms(13),
    fontWeight: '900',
    color: '#1162D3',
  },
  productOriginalPrice: {
    fontSize: ms(9),
    fontWeight: '700',
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  addBtn: {
    borderRadius: ms(8),
    paddingHorizontal: hs(10),
    paddingVertical: vs(5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDefault: {
    backgroundColor: '#1162D3',
  },
  addBtnSuccess: {
    backgroundColor: '#10b981',
  },
  addBtnLabel: {
    color: '#ffffff',
    fontSize: ms(9),
    fontWeight: '900',
  },
  addedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(3),
  },
});
