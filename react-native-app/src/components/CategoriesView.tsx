import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import {
  Filter,
  Search,
  Grid,
  Heart,
  Plus,
  Check,
  Star,
} from 'lucide-react-native';
import { categoriesSearchDatabase } from '../data/mockProducts';
import { exploreStacks } from '../data/exploreData';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CategoriesViewProps {
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  addToCart: (id: string, name: string, price: number, emoji: string) => void;
  onProductClick?: (product: any) => void;
  favorites?: string[];
  toggleFavorite?: (productId: string) => void;
}

export default function CategoriesView({
  selectedCategory,
  setSelectedCategory,
  addToCart,
  onProductClick,
  favorites = [],
  toggleFavorite,
}: CategoriesViewProps) {
  const [selectedApp, setSelectedApp] = useState<'ALL' | 'FOOD' | 'MART' | 'GROCERY' | 'PHARMA'>('ALL');
  const [activeSubCat, setActiveSubCat] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [addedItem, setAddedItem] = useState<string | null>(null);

  const appFilters = [
    { id: 'ALL' as const, label: 'All Apps', emoji: '✨', activeBg: '#0f172a', activeColor: '#ffffff' },
    { id: 'FOOD' as const, label: 'FOOD', emoji: '🍲', activeBg: '#1E5D44', activeColor: '#ffffff' },
    { id: 'MART' as const, label: 'MART', emoji: '🛍️', activeBg: '#1162D3', activeColor: '#ffffff' },
    { id: 'GROCERY' as const, label: 'GROCERY', emoji: '🍏', activeBg: '#10B981', activeColor: '#ffffff' },
    { id: 'PHARMA' as const, label: 'PHARMA', emoji: '💊', activeBg: '#065F46', activeColor: '#ffffff' },
  ];

  const categoriesList = [
    // FOOD
    { id: 'food-main', name: 'Sizzling Entrees', emoji: '🍛', app: 'FOOD', bg: '#ecfdf5', text: '#065f46', border: '#d1fae5', ringColor: '#1E5D44' },
    { id: 'food-snack', name: 'Combos & Snacks', emoji: '🌯', app: 'FOOD', bg: '#fff1f2', text: '#9f1239', border: '#ffe4e6', ringColor: '#f43f5e' },
    { id: 'food-dessert', name: 'Desserts & Shakes', emoji: '🥞', app: 'FOOD', bg: '#fef3c7', text: '#92400e', border: '#fde68a', ringColor: '#fbbf24' },
    // MART
    { id: 'mart-tech', name: 'Tech & Keyboards', emoji: '⌨️', app: 'MART', bg: '#eff6ff', text: '#1e40af', border: '#dbeafe', ringColor: '#1162D3' },
    { id: 'mart-foot', name: 'Footwear & Kicks', emoji: '👟', app: 'MART', bg: '#eef2ff', text: '#3730a3', border: '#e0e7ff', ringColor: '#6366f1' },
    { id: 'mart-lounge', name: 'Cozywear Lounge', emoji: '🧥', app: 'MART', bg: '#f5f5f4', text: '#44403c', border: '#e7e5e4', ringColor: '#78716c' },
    // GROCERY
    { id: 'groc-green', name: 'Fresh Greens', emoji: '🥦', app: 'GROCERY', bg: '#f0fdf4', text: '#166534', border: '#dcfce7', ringColor: '#10B981' },
    { id: 'groc-soda', name: 'Cold Sips & Soda', emoji: '🥤', app: 'GROCERY', bg: '#ecfeff', text: '#155e75', border: '#cffafe', ringColor: '#06b6d4' },
    { id: 'groc-dairy', name: 'Dairy & Milks', emoji: '🥛', app: 'GROCERY', bg: '#f0f9ff', text: '#075985', border: '#e0f2fe', ringColor: '#0ea5e9' },
    // PHARMA
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      
      {/* 1. TOP APP LEVEL FILTER PILLS */}
      <View style={styles.filterSection}>
        <View style={styles.filterHeaderRow}>
          <View style={styles.filterLeftTitle}>
            <Filter size={10} color="#94a3b8" />
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
                  isSel ? { backgroundColor: f.activeBg, borderColor: f.activeBg } : null,
                ]}
                activeOpacity={0.8}
              >
                <Text style={styles.appPillEmoji}>{f.emoji}</Text>
                <Text style={[styles.appPillText, isSel ? { color: f.activeColor } : null]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 2. INSTANT SEARCH BAR */}
      <View style={styles.searchContainer}>
        <TextInput
          placeholder="Search catalog by product name or details..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
          placeholderTextColor="#94a3b8"
        />
        <Search size={12} color="#94a3b8" style={styles.searchIcon} />
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
                  isSel ? { borderWidth: 2 } : null,
                ]}
                activeOpacity={0.8}
              >
                <View style={styles.categoryIconWrap}>
                  <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
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
            <Grid size={11} color="#64748b" />
            <Text style={styles.productsTitle}>
              {activeSubCat === 'all'
                ? searchQuery.trim() !== '' ? 'Search Results' : '🔥 Handpicked Highlights'
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
                          <View style={styles.stackProductImgWrap}>
                            <Image source={{ uri: item.img }} style={styles.stackProductImg} />
                            
                            <TouchableOpacity
                              onPress={() => toggleFavorite && toggleFavorite(item.id)}
                              style={styles.stackHeartBtn}
                              activeOpacity={0.8}
                            >
                              <Heart size={10} color="#f43f5e" fill={isFav ? '#f43f5e' : 'transparent'} />
                            </TouchableOpacity>

                            <View style={styles.stackRatingOverlay}>
                              <Text style={styles.stackRatingText}>★ {item.rating}</Text>
                            </View>
                          </View>

                          <View style={styles.stackProductInfo}>
                            <Text style={styles.stackShopName} numberOfLines={1}>{item.shop}</Text>
                            <Text style={styles.stackProductName} numberOfLines={1}>{item.name}</Text>
                          </View>

                          <View style={styles.stackProductFooter}>
                            <Text style={styles.stackProductPrice}>₹{item.price.toLocaleString('en-IN')}</Text>
                            <TouchableOpacity
                              onPress={() => triggerAddToCart(item.id, item.name, item.price, item.emoji)}
                              style={[styles.stackAddBtn, { backgroundColor: isAdded ? '#10b981' : btnBg }]}
                              activeOpacity={0.8}
                            >
                              <Plus size={8} color="#ffffff" style={{ marginRight: 2 }} />
                              <Text style={styles.stackAddBtnText}>{isAdded ? 'Added' : 'Add'}</Text>
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

                  <View style={styles.gridProductInfo}>
                    <View style={styles.gridProductMetaRow}>
                      <View style={[styles.gridAppBadge, { backgroundColor: appBadgeBg }]}>
                        <Text style={[styles.gridAppBadgeText, { color: appBadgeText }]}>{item.app}</Text>
                      </View>
                      <Text style={styles.gridCatName} numberOfLines={1}>{item.catName}</Text>
                    </View>
                    <Text style={styles.gridProductName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.gridProductDesc} numberOfLines={2}>{item.desc}</Text>
                  </View>

                  <View style={styles.gridProductFooter}>
                    <Text style={styles.gridProductPrice}>₹{item.price.toLocaleString('en-IN')}</Text>
                    <TouchableOpacity
                      onPress={() => triggerAddToCart(item.id, item.name, item.price, item.emoji)}
                      style={[styles.gridAddBtn, { backgroundColor: isAdded ? '#10b981' : btnBg }]}
                      activeOpacity={0.8}
                    >
                      <Plus size={8} color="#ffffff" style={{ marginRight: 2 }} />
                      <Text style={styles.gridAddBtnText}>{isAdded ? 'Added' : 'Add'}</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {displayedProducts.length === 0 && (
          <View style={styles.emptyState}>
            <Search size={24} color="#94a3b8" />
            <Text style={styles.emptyTitle}>No matching products</Text>
            <Text style={styles.emptyDesc}>We couldn't find items matching "{searchQuery}" under this category.</Text>
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
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  filterSection: {
    marginTop: 14,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterLeftTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterLabelText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  activeChannelBadge: {
    backgroundColor: '#eff6ff',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  activeChannelText: {
    fontSize: 8,
    color: '#2563eb',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  appPillsScroll: {
    paddingVertical: 2,
  },
  appPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  appPillEmoji: {
    fontSize: 10,
    marginRight: 4,
  },
  appPillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748b',
  },
  searchContainer: {
    position: 'relative',
    marginTop: 12,
    marginBottom: 12,
  },
  searchInput: {
    height: 38,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 12,
    paddingLeft: 36,
    paddingRight: 12,
    fontSize: 10,
    fontWeight: '600',
    color: '#1e293b',
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    top: 13,
  },
  gridContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 16,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  gridHeaderLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  showAllBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  showAllBtnActive: {
    backgroundColor: '#0f172a',
  },
  showAllBtnText: {
    fontSize: 8,
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
    gap: 8,
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '31%',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconWrap: {
    width: 28,
    height: 28,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    marginBottom: 4,
  },
  categoryEmoji: {
    fontSize: 12,
  },
  categoryName: {
    fontSize: 8.5,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  categorySubBrand: {
    fontSize: 6.5,
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: 1,
  },
  productsSection: {
    marginBottom: 20,
  },
  productsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  productsTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productsTitle: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#475569',
    textTransform: 'uppercase',
    marginLeft: 6,
  },
  productsCount: {
    fontSize: 8.5,
    color: '#94a3b8',
    fontWeight: '700',
  },
  stacksContainer: {
    width: '100%',
  },
  stackWrapper: {
    marginBottom: 16,
  },
  stackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  stackTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1e293b',
    textTransform: 'uppercase',
  },
  stackSubtitle: {
    fontSize: 8,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 2,
  },
  stackBadge: {
    backgroundColor: '#ffe4e6',
    borderWidth: 1,
    borderColor: '#ffe4e6',
    borderRadius: 12,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  stackBadgeText: {
    fontSize: 7,
    fontWeight: '900',
    color: '#e11d48',
    textTransform: 'uppercase',
  },
  stackHorizontalScroll: {
    paddingBottom: 4,
  },
  stackProductCard: {
    width: 146,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 20,
    padding: 10,
    marginRight: 10,
  },
  stackProductImgWrap: {
    width: '100%',
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f8fafc',
  },
  stackProductImg: {
    width: '100%',
    height: '100%',
  },
  stackHeartBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackRatingOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  stackRatingText: {
    color: '#ffffff',
    fontSize: 6.5,
    fontWeight: '900',
  },
  stackProductInfo: {
    marginTop: 8,
    flex: 1,
  },
  stackShopName: {
    fontSize: 7,
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  stackProductName: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },
  stackProductPrice: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#0f172a',
  },
  stackProductFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  stackAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  stackAddBtnText: {
    color: '#ffffff',
    fontSize: 7,
    fontWeight: '900',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  gridProductCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 20,
    padding: 10,
    marginBottom: 6,
  },
  gridProductImgWrap: {
    width: '100%',
    height: 110,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f8fafc',
  },
  gridProductImg: {
    width: '100%',
    height: '100%',
  },
  gridRatingOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  gridRatingText: {
    fontSize: 7,
    color: '#fbbf24',
    fontWeight: '900',
  },
  gridProductInfo: {
    marginTop: 8,
  },
  gridProductMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gridAppBadge: {
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  gridAppBadgeText: {
    fontSize: 6,
    fontWeight: '900',
  },
  gridCatName: {
    fontSize: 7,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  gridProductName: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },
  gridProductDesc: {
    fontSize: 7.5,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 10,
  },
  gridProductPrice: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0f172a',
  },
  gridProductFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  gridAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  gridAddBtnText: {
    color: '#ffffff',
    fontSize: 7,
    fontWeight: '900',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#e2e8f0',
    borderRadius: 20,
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
    marginTop: 10,
  },
  emptyDesc: {
    fontSize: 8,
    color: '#94a3b8',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
});
