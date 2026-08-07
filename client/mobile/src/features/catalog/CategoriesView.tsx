import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Animated,
} from 'react-native';
import {
  Filter,
  Search,
  Grid,
  Heart,
  Plus,
  Check,
} from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { hs, vs, ms } from '@/utils/responsive';
import EnterpriseIcon from './EnterpriseIcon';
import { categoriesSearchDatabase } from '@data/categories/searchDatabase';
import { exploreStacks } from '@data/explore/stacks';

interface CategoriesViewProps {
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  addToCart: (id: string, name: string, price: number, emoji: string) => void;
  onProductClick?: (product: any) => void;
  favorites?: string[];
  toggleFavorite?: (productId: string) => void;
  onScroll?: (offsetY: number) => void;
}

export default function CategoriesView({
  selectedCategory,
  setSelectedCategory,
  addToCart,
  onProductClick,
  favorites = [],
  toggleFavorite,
  onScroll,
}: CategoriesViewProps) {
  const [selectedApp, setSelectedApp] = useState<'ALL' | 'FOOD' | 'MART' | 'GROCERY' | 'PHARMA'>('ALL');
  const [activeSubCat, setActiveSubCat] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [addedItem, setAddedItem] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (addedItem) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.6, duration: 400, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ])
      );
      anim.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (anim) anim.stop();
      pulseAnim.setValue(1);
    };
  }, [addedItem, pulseAnim]);

  const appFilters = [
    { id: 'ALL' as const, label: 'All Apps', emoji: '✨', activeBg: '#0f172a', activeColor: '#ffffff' },
    { id: 'FOOD' as const, label: 'FOOD', emoji: '🍲', activeBg: '#1E5D44', activeColor: '#ffffff' },
    { id: 'MART' as const, label: 'MART', emoji: '🛍️', activeBg: '#1162D3', activeColor: '#ffffff' },
    { id: 'GROCERY' as const, label: 'GROCERY', emoji: '🍏', activeBg: '#10B981', activeColor: '#ffffff' },
    { id: 'PHARMA' as const, label: 'PHARMA', emoji: '💊', activeBg: '#065F46', activeColor: '#ffffff' },
  ];

  const categoriesList = [
    { id: 'food-main', name: 'Sizzling Entrees', emoji: '🍛', app: 'FOOD', bg: '#ecfdf5', text: '#065f46', border: '#d1fae5', ringColor: '#1E5D44' },
    { id: 'food-snack', name: 'Combos & Snacks', emoji: '🌯', app: 'FOOD', bg: '#fff1f2', text: '#9f1239', border: '#ffe4e6', ringColor: '#f43f5e' },
    { id: 'food-dessert', name: 'Desserts & Shakes', emoji: '🥞', app: 'FOOD', bg: '#fef3c7', text: '#92400e', border: '#fde68a', ringColor: '#fbbf24' },
    { id: 'mart-tech', name: 'Tech & Keyboards', emoji: '⌨️', app: 'MART', bg: '#eff6ff', text: '#1e40af', border: '#dbeafe', ringColor: '#1162D3' },
    { id: 'mart-foot', name: 'Footwear & Kicks', emoji: '👟', app: 'MART', bg: '#eef2ff', text: '#3730a3', border: '#e0e7ff', ringColor: '#6366f1' },
    { id: 'mart-lounge', name: 'Cozywear Lounge', emoji: '🧥', app: 'MART', bg: '#f5f5f4', text: '#44403c', border: '#e7e5e4', ringColor: '#78716c' },
    { id: 'groc-green', name: 'Fresh Greens', emoji: '🥦', app: 'GROCERY', bg: '#f0fdf4', text: '#166534', border: '#dcfce7', ringColor: '#10B981' },
    { id: 'groc-soda', name: 'Cold Sips & Soda', emoji: '🥤', app: 'GROCERY', bg: '#ecfeff', text: '#155e75', border: '#cffafe', ringColor: '#06b6d4' },
    { id: 'groc-dairy', name: 'Dairy & Milks', emoji: '🥛', app: 'GROCERY', bg: '#f0f9ff', text: '#075985', border: '#e0f2fe', ringColor: '#0ea5e9' },
    { id: 'ph-wellness', name: 'Wellness Gummies', emoji: '🍊', app: 'PHARMA', bg: '#fff7ed', text: '#9a3412', border: '#ffedd5', ringColor: '#f97316' },
    { id: 'ph-sos', name: 'Late-Night SOS', emoji: '🩹', app: 'PHARMA', bg: '#fef2f2', text: '#991b1b', border: '#fee2e2', ringColor: '#ef4444' },
    { id: 'ph-beauty', name: 'K-Beauty Glow', emoji: '✨', app: 'PHARMA', bg: '#f0fdfa', text: '#0f766e', border: '#ccfbf1', ringColor: '#065F46' }
  ];

  const filteredCategoriesList = categoriesList.filter(
    (cat) => selectedApp === 'ALL' || cat.app === selectedApp
  );

  useEffect(() => {
    setActiveSubCat('all');
  }, [selectedApp]);

  const triggerAddToCart = (id: string, name: string, price: number, emoji: string) => {
    addToCart(id, name, price, emoji);
    setAddedItem(id);
    setTimeout(() => {
      setAddedItem(null);
    }, 1200);
  };

  const getFilteredProducts = () => {
    let list: any[] = [];

    filteredCategoriesList.forEach((cat) => {
      if (activeSubCat === 'all' || activeSubCat === cat.id) {
        const items = categoriesSearchDatabase[cat.id] || [];
        items.forEach((item: any) => {
          list.push({
            ...item,
            image: item.image || item.img,
            catId: cat.id,
            catName: cat.name,
            app: cat.app,
          });
        });
      }
    });

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.desc.toLowerCase().includes(q) ||
          item.catName.toLowerCase().includes(q)
      );
    } else if (activeSubCat === 'all') {
      const curatedIds = ['cat-fm-1', 'cat-mt-1', 'cat-gg-2', 'cat-pb-1'];
      list = list.filter((item) => curatedIds.includes(item.id));
    }

    return list;
  };

  const displayedProducts = getFilteredProducts();

  const searchInputHeight = Math.max(38, vs(38));

  const gradColors: Record<string, string> = {
    FOOD: 'rgba(236,253,245,0.25)',
    MART: 'rgba(239,246,255,0.2)',
    GROCERY: 'rgba(240,253,244,0.25)',
    PHARMA: 'rgba(240,253,250,0.25)',
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
      onScroll={onScroll ? (e) => onScroll(e.nativeEvent.contentOffset.y) : undefined}
      scrollEventThrottle={16}>

      {/* 1. TOP APP LEVEL FILTER PILLS */}
      <View style={styles.filterSection}>
        <View style={styles.filterHeaderRow}>
          <View style={styles.filterLeftTitle}>
            <Filter size={ms(10)} color="#94a3b8" />
            <Text style={styles.filterLabelText}>Explore Departments</Text>
          </View>
          <View style={styles.activeChannelBadge}>
            <Text style={styles.activeChannelText}>
              {selectedApp === 'ALL' ? 'All Channels' : `${selectedApp} Active`}
            </Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.appPillsScroll}>
          {appFilters.map((f) => {
            const isSel = selectedApp === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setSelectedApp(f.id)}
                style={[
                  styles.appPill,
                  isSel ? {
                    backgroundColor: f.activeBg,
                    borderColor: f.activeBg,
                    shadowOpacity: 0.15,
                    shadowRadius: 4,
                    elevation: 2,
                    shadowColor: f.activeBg,
                  } : null,
                ]}
                activeOpacity={0.8}
              >
                <EnterpriseIcon emoji={f.emoji} variant="flat" size={ms(11)} />
                <Text style={[styles.appPillText, isSel ? { color: f.activeColor } : null]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 2. INSTANT SEARCH BAR */}
      <View style={[styles.searchContainer, isFocused && styles.searchContainerFocused]}>
        <View style={styles.searchIconWrap}>
          <Search size={ms(12)} color="#94a3b8" />
        </View>
        <TextInput
          placeholder="Search catalog by product name or details..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={[styles.searchInput, { height: searchInputHeight }]}
          placeholderTextColor="#94a3b8"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </View>

      {/* 3. ENTERPRISE CATEGORY GRID SELECTOR */}
      <View style={styles.gridContainer}>
        <View style={styles.gridHeaderRow}>
          <Text style={styles.gridHeaderLabel}>Select Category Filter</Text>
          <TouchableOpacity
            onPress={() => setActiveSubCat('all')}
            style={[
              styles.showAllBtn,
              activeSubCat === 'all' ? styles.showAllBtnActive : null,
            ]}
            activeOpacity={0.8}
          >
            <Text style={[styles.showAllBtnText, activeSubCat === 'all' ? styles.showAllBtnTextActive : null]}>
              Show All
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.categoryGrid}>
          {filteredCategoriesList.map((cat) => {
            const isSel = activeSubCat === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setActiveSubCat(cat.id)}
                style={[
                  styles.categoryCard,
                  { backgroundColor: cat.bg, borderColor: isSel ? cat.ringColor : cat.border },
                  isSel ? {
                    borderWidth: 2,
                    backgroundColor: '#ffffff',
                    transform: [{ scale: 1.03 }],
                    shadowColor: cat.ringColor,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.15,
                    shadowRadius: 4,
                    elevation: 3,
                  } : null,
                ]}
                activeOpacity={0.8}
              >
                <View style={styles.categoryIconWrap}>
                  <EnterpriseIcon emoji={cat.emoji} variant="circle" size={ms(32)} bgColor="rgba(255,255,255,0.9)" />
                </View>
                <Text style={[styles.categoryName, { color: cat.text }]} numberOfLines={1}>
                  {cat.name.split(' ')[0]}
                </Text>
                <Text style={styles.categorySubBrand}>{cat.app}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 4. PRODUCTS CONTENT */}
      <View style={styles.productsSection}>
        <View style={styles.productsHeader}>
          <View style={styles.productsTitleWrap}>
            <Grid size={ms(11)} color="#64748b" />
            <Text style={styles.productsTitle}>
              {activeSubCat === 'all'
                ? searchQuery.trim() !== '' ? 'Search Results' : 'Handpicked Highlights'
                : categoriesList.find((c) => c.id === activeSubCat)?.name}
            </Text>
          </View>
          <Text style={styles.productsCount}>
            {displayedProducts.length} {displayedProducts.length === 1 ? 'result' : 'results'}
          </Text>
        </View>

        {activeSubCat === 'all' && searchQuery.trim() === '' ? (
          <View style={styles.stacksContainer}>
            {exploreStacks
              .filter((stack) => selectedApp === 'ALL' || stack.type === selectedApp)
              .map((stack) => (
                <View key={stack.id} style={styles.stackWrapper}>
                  <View style={styles.stackHeader}>
                    <View>
                      <Text style={styles.stackTitle}>{stack.title}</Text>
                      <Text style={styles.stackSubtitle}>{stack.subtitle}</Text>
                    </View>
                    <View style={styles.stackBadge}>
                      <Text style={styles.stackBadgeText}>{stack.type}</Text>
                    </View>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stackHorizontalScroll}>
                    {stack.items.map((item) => {
                      const isAdded = addedItem === item.id;
                      const isFav = favorites.includes(item.id);

                      const productObj = {
                        id: item.id,
                        name: item.name,
                        price: item.price,
                        rating: Number(item.rating),
                        emoji: item.emoji,
                        image: item.img,
                        desc: `Special premium pick curated from ${item.shop}. 100% genuine quality with high-priority rapid delivery.`,
                        app: stack.type,
                        catId: stack.id,
                        catName: stack.title,
                        shop: item.shop,
                      };

                      let btnBg = '#1162D3';
                      if (stack.type === 'FOOD') btnBg = '#1E5D44';
                      else if (stack.type === 'GROCERY') btnBg = '#10B981';
                      else if (stack.type === 'PHARMA') btnBg = '#065F46';

                      return (
                        <TouchableOpacity
                          key={item.id}
                          onPress={() => onProductClick && onProductClick(productObj)}
                          style={styles.stackProductCard}
                          activeOpacity={0.9}
                        >
                          <Svg style={StyleSheet.absoluteFill}>
                            <Defs>
                              <LinearGradient id={`bg-${stack.type}`} x1="0" y1="0" x2="1" y2="1">
                                <Stop offset="0" stopColor={gradColors[stack.type] || '#fff'} stopOpacity="1" />
                                <Stop offset="1" stopColor="#fff" stopOpacity="1" />
                              </LinearGradient>
                            </Defs>
                            <Rect width="100%" height="100%" fill={`url(#bg-${stack.type})`} />
                          </Svg>

                          <View style={styles.stackProductImgWrap}>
                            <View style={styles.stackEnterpriseStamp}>
                              <EnterpriseIcon emoji={item.emoji} variant="square" size={ms(28)} />
                            </View>
                            <Image source={{ uri: item.img }} style={styles.stackProductImg} />

                            <TouchableOpacity
                              onPress={() => toggleFavorite && toggleFavorite(item.id)}
                              style={styles.stackHeartBtn}
                              activeOpacity={0.8}
                            >
                              <Heart size={ms(10)} color="#f43f5e" fill={isFav ? '#f43f5e' : 'transparent'} />
                            </TouchableOpacity>

                            <View style={styles.stackRatingOverlay}>
                              <Text style={styles.stackRatingText}>★ {item.rating}</Text>
                            </View>
                          </View>

                          <View style={styles.stackProductInfo}>
                            <Text style={styles.stackShopName} numberOfLines={1}>{item.shop}</Text>
                            <Text style={styles.stackProductName} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.stackProductDesc} numberOfLines={2}>
                              Fresh curation from {item.shop}. Premium local favorite.
                            </Text>
                          </View>

                          <View style={styles.stackProductFooter}>
                            <Text style={styles.stackProductPrice}>₹{item.price.toLocaleString('en-IN')}</Text>
                            <TouchableOpacity
                              onPress={() => triggerAddToCart(item.id, item.name, item.price, item.emoji)}
                              style={[styles.stackAddBtn, { backgroundColor: isAdded ? '#10b981' : btnBg }]}
                              activeOpacity={0.8}
                            >
                              <Animated.View style={{ flexDirection: 'row', alignItems: 'center', opacity: isAdded ? pulseAnim : 1 }}>
                                {isAdded ? <Check size={ms(8)} color="#ffffff" /> : <Plus size={ms(8)} color="#ffffff" />}
                                <Text style={styles.stackAddBtnText}>{isAdded ? 'Added' : 'Add'}</Text>
                              </Animated.View>
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ))}
          </View>
        ) : (
          <View style={styles.productsGrid}>
            {displayedProducts.map((item) => {
              const isAdded = addedItem === item.id;

              let btnBg = '#1162D3';
              if (item.app === 'FOOD') btnBg = '#1E5D44';
              else if (item.app === 'GROCERY') btnBg = '#10B981';
              else if (item.app === 'PHARMA') btnBg = '#065F46';

              let appBadgeBg = '#eff6ff';
              let appBadgeText = '#1e40af';
              if (item.app === 'FOOD') {
                appBadgeBg = '#ecfdf5';
                appBadgeText = '#065f46';
              } else if (item.app === 'GROCERY') {
                appBadgeBg = '#f0fdf4';
                appBadgeText = '#166534';
              } else if (item.app === 'PHARMA') {
                appBadgeBg = '#f0fdfa';
                appBadgeText = '#0f766e';
              }

              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => onProductClick && onProductClick(item)}
                  style={styles.gridProductCard}
                  activeOpacity={0.9}
                >
                  <View style={styles.gridProductImgWrap}>
                    <Image source={{ uri: item.image }} style={styles.gridProductImg} />
                    <View style={styles.gridRatingOverlay}>
                      <Text style={styles.gridRatingText}>★ {item.rating}</Text>
                    </View>
                  </View>

                  <View style={styles.gridContentBlock}>
                    <View style={styles.gridProductMetaRow}>
                      <View style={[styles.gridAppBadge, { backgroundColor: appBadgeBg, borderColor: appBadgeText }]}>
                        <Text style={[styles.gridAppBadgeText, { color: appBadgeText }]}>{item.app}</Text>
                      </View>
                      <Text style={styles.gridCatName} numberOfLines={1}>{item.catName}</Text>
                    </View>
                    <Text style={styles.gridProductName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.gridProductDesc} numberOfLines={2}>{item.desc}</Text>

                    <View style={styles.gridProductFooter}>
                      <Text style={styles.gridProductPrice}>₹{item.price.toLocaleString('en-IN')}</Text>
                      <TouchableOpacity
                        onPress={() => triggerAddToCart(item.id, item.name, item.price, item.emoji)}
                        style={[styles.gridAddBtn, { backgroundColor: isAdded ? '#10b981' : btnBg }]}
                        activeOpacity={0.8}
                      >
                        {isAdded ? <Check size={ms(8)} color="#ffffff" /> : <Plus size={ms(8)} color="#ffffff" />}
                        <Text style={styles.gridAddBtnText}>{isAdded ? 'Added' : 'Add'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {displayedProducts.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Search size={ms(18)} color="#94a3b8" />
            </View>
            <Text style={styles.emptyTitle}>No matching products</Text>
            <Text style={styles.emptyDesc}>We couldn't find items matching "{searchQuery}" under this category.</Text>
            <Text style={styles.emptySubText}>Let's try another one!</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingHorizontal: hs(16),
    paddingBottom: vs(40),
  },
  filterSection: {
    marginTop: vs(14),
  },
  filterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(8),
  },
  filterLeftTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterLabelText: {
    fontSize: ms(9),
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: hs(4),
  },
  activeChannelBadge: {
    backgroundColor: '#eff6ff',
    paddingVertical: vs(2),
    paddingHorizontal: hs(6),
    borderRadius: 999,
  },
  activeChannelText: {
    fontSize: ms(8.5),
    color: '#2563eb',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  appPillsScroll: {
    paddingVertical: vs(2),
  },
  appPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: ms(20),
    paddingVertical: vs(6),
    paddingHorizontal: hs(12),
    marginRight: hs(8),
  },
  appPillText: {
    fontSize: ms(9.5),
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(12),
    marginBottom: vs(12),
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: ms(12),
  },
  searchContainerFocused: {
    borderColor: '#cbd5e1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  searchIconWrap: {
    paddingLeft: hs(16),
  },
  searchInput: {
    flex: 1,
    paddingLeft: hs(8),
    paddingRight: hs(12),
    fontSize: ms(10.5),
    fontWeight: '600',
    color: '#1e293b',
  },
  gridContainer: {
    backgroundColor: 'rgba(248,250,252,0.5)',
    borderRadius: ms(24),
    padding: ms(12),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: vs(16),
  },
  gridHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(10),
  },
  gridHeaderLabel: {
    fontSize: ms(9),
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  showAllBtn: {
    paddingVertical: vs(2),
    paddingHorizontal: hs(6),
    borderRadius: ms(4),
  },
  showAllBtnActive: {
    backgroundColor: '#0f172a',
  },
  showAllBtnText: {
    fontSize: ms(8),
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  showAllBtnTextActive: {
    color: '#ffffff',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: hs(8),
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '31%',
    borderRadius: ms(12),
    borderWidth: 1,
    paddingVertical: vs(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(4),
  },
  categoryName: {
    fontSize: ms(8),
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  categorySubBrand: {
    fontSize: ms(6),
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: vs(1),
    letterSpacing: 0.3,
  },
  productsSection: {
    marginBottom: vs(20),
  },
  productsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(10),
  },
  productsTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productsTitle: {
    fontSize: ms(9.5),
    fontWeight: '900',
    color: '#475569',
    textTransform: 'uppercase',
    marginLeft: hs(6),
  },
  productsCount: {
    fontSize: ms(8.5),
    color: '#94a3b8',
    fontWeight: '700',
  },
  stacksContainer: {
    width: '100%',
  },
  stackWrapper: {
    marginBottom: vs(16),
  },
  stackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(10),
  },
  stackTitle: {
    fontSize: ms(11),
    fontWeight: '900',
    color: '#1e293b',
    textTransform: 'uppercase',
  },
  stackSubtitle: {
    fontSize: ms(8),
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: vs(2),
  },
  stackBadge: {
    backgroundColor: 'rgba(255,74,107,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,74,107,0.1)',
    borderRadius: ms(12),
    paddingVertical: vs(2),
    paddingHorizontal: hs(6),
  },
  stackBadgeText: {
    fontSize: ms(7),
    fontWeight: '900',
    color: '#FF4A6B',
    textTransform: 'uppercase',
  },
  stackHorizontalScroll: {
    paddingBottom: vs(4),
  },
  stackProductCard: {
    width: hs(165),
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: ms(24),
    overflow: 'hidden',
    padding: ms(10),
    marginRight: hs(10),
  },
  stackProductImgWrap: {
    width: '100%',
    height: vs(112),
    borderRadius: ms(16),
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f8fafc',
  },
  stackProductImg: {
    width: '100%',
    height: '100%',
  },
  stackEnterpriseStamp: {
    position: 'absolute',
    top: vs(6),
    left: hs(6),
    zIndex: 2,
  },
  stackHeartBtn: {
    position: 'absolute',
    top: vs(6),
    right: hs(6),
    backgroundColor: 'rgba(255,255,255,0.95)',
    width: ms(22),
    height: ms(22),
    borderRadius: ms(11),
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackRatingOverlay: {
    position: 'absolute',
    bottom: vs(6),
    right: hs(6),
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingVertical: vs(2),
    paddingHorizontal: hs(4),
    borderRadius: ms(4),
  },
  stackRatingText: {
    color: '#ffffff',
    fontSize: ms(6.5),
    fontWeight: '900',
  },
  stackProductInfo: {
    marginTop: vs(8),
    flex: 1,
  },
  stackShopName: {
    fontSize: ms(7),
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  stackProductName: {
    fontSize: ms(9.5),
    fontWeight: '900',
    color: '#0f172a',
    marginTop: vs(2),
  },
  stackProductDesc: {
    fontSize: ms(7.5),
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: vs(2),
    lineHeight: ms(10),
  },
  stackProductPrice: {
    fontSize: ms(9.5),
    fontWeight: '900',
    color: '#0f172a',
  },
  stackProductFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: vs(8),
    paddingTop: vs(6),
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  stackAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vs(3),
    paddingHorizontal: hs(8),
    borderRadius: ms(6),
  },
  stackAddBtnText: {
    color: '#ffffff',
    fontSize: ms(7),
    fontWeight: '900',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: hs(12),
    justifyContent: 'space-between',
  },
  gridProductCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: ms(24),
    overflow: 'hidden',
    marginBottom: vs(6),
  },
  gridProductImgWrap: {
    width: '100%',
    height: vs(128),
    position: 'relative',
    backgroundColor: '#f8fafc',
  },
  gridProductImg: {
    width: '100%',
    height: '100%',
  },
  gridRatingOverlay: {
    position: 'absolute',
    bottom: vs(6),
    right: hs(6),
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: vs(2),
    paddingHorizontal: hs(4),
    borderRadius: ms(4),
  },
  gridRatingText: {
    fontSize: ms(7.5),
    color: '#fbbf24',
    fontWeight: '900',
  },
  gridContentBlock: {
    paddingHorizontal: vs(14),
    paddingVertical: vs(12),
  },
  gridProductMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
  },
  gridAppBadge: {
    paddingVertical: vs(1),
    paddingHorizontal: hs(4),
    borderRadius: ms(4),
    borderWidth: 1,
  },
  gridAppBadgeText: {
    fontSize: ms(6),
    fontWeight: '900',
  },
  gridCatName: {
    fontSize: ms(7),
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  gridProductName: {
    fontSize: ms(9.5),
    fontWeight: '900',
    color: '#0f172a',
    marginTop: vs(2),
  },
  gridProductDesc: {
    fontSize: ms(7.5),
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: vs(2),
    lineHeight: ms(10),
  },
  gridProductPrice: {
    fontSize: ms(10.5),
    fontWeight: '900',
    color: '#0f172a',
  },
  gridProductFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: vs(8),
    paddingTop: vs(6),
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  gridAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vs(3),
    paddingHorizontal: hs(8),
    borderRadius: ms(6),
  },
  gridAddBtnText: {
    color: '#ffffff',
    fontSize: ms(7),
    fontWeight: '900',
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: ms(28),
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: vs(64),
    marginTop: vs(10),
  },
  emptyIconContainer: {
    width: ms(48),
    height: ms(48),
    borderRadius: ms(24),
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  emptyTitle: {
    fontSize: ms(10.5),
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
    marginTop: vs(10),
  },
  emptyDesc: {
    fontSize: ms(8),
    color: '#94a3b8',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: vs(4),
    paddingHorizontal: hs(20),
  },
  emptySubText: {
    fontSize: ms(9),
    color: '#94a3b8',
    fontWeight: '700',
    marginTop: vs(8),
  },
});
