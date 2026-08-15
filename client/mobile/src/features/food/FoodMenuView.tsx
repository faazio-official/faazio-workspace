import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { Search, Bell } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { foodProducts } from '@data/food/products';
import FoodProductCard from '@/features/food/cards/FoodProductCard';
import AppTextInput from '@/components/AppTextInput';
import AppText from '@/components/AppText';

interface FoodMenuViewProps {
  addToCart?: (id: string, name: string, price: number, emoji: string) => void;
  addedId?: string | null;
  handleAddToCartWithFeedback?: (id: string, name: string, price: number, emoji: string) => void;
  onProductClick?: (product: any) => void;
}

export default function FoodMenuView({ addToCart, addedId: externalAddedId, handleAddToCartWithFeedback: externalHandleAddToCart, onProductClick }: FoodMenuViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [localAddedId, setLocalAddedId] = useState<string | null>(null);
  const bellPulse = useRef(new Animated.Value(1)).current;
  const underlineAnim = useRef(new Animated.Value(0)).current;
  const tabPositions = useRef<number[]>([]);
  
  const addedId = externalAddedId || localAddedId;
  
  const handleAddToCartWithFeedback = externalHandleAddToCart || ((id: string, name: string, price: number, emoji: string) => {
    if (addToCart) addToCart(id, name, price, emoji);
    setLocalAddedId(id);
    setTimeout(() => setLocalAddedId(null), 1500);
  });

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(bellPulse, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
        Animated.timing(bellPulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const categories = ['All', ...new Set(foodProducts.flatMap(p => p.categories).filter(c => c !== 'All'))];
  
  const filteredProducts = foodProducts.filter(p => {
    if (activeCategory !== 'All' && !p.categories.includes(activeCategory)) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q);
  });

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentPadding}>
      {/* Header */}
      <View style={styles.headerRow}>
        <AppText style={styles.headerTitle}>FOOD MENU</AppText>
        <Animated.View style={{ opacity: bellPulse }}>
          <Bell size={ms(18)} color="#1E5D44" />
        </Animated.View>
      </View>
      
      {/* Dark Toast */}
      <View style={styles.toast}>
        <AppText style={styles.toastText}>Signature Handpicked Faazio Chef Delivery</AppText>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Search size={ms(14)} color="#94a3b8" style={styles.searchIcon} />
        <AppTextInput
          style={styles.searchInput}
          placeholder="Search menu..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Category Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map((cat, idx) => {
            const isActive = activeCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => {
                  setActiveCategory(cat);
                  if (tabPositions.current[idx] !== undefined) {
                    Animated.spring(underlineAnim, {
                      toValue: tabPositions.current[idx],
                      useNativeDriver: true,
                      stiffness: 300,
                      damping: 30,
                    }).start();
                  }
                }}
                onLayout={(e) => { tabPositions.current[idx] = e.nativeEvent.layout.x; }}
                style={styles.tabBtn}
                activeOpacity={0.8}
              >
                <AppText style={[styles.tabText, isActive && styles.tabTextActive]}>{cat}</AppText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <Animated.View style={[styles.tabUnderline, { transform: [{ translateX: underlineAnim }] }]} />
      </View>

      {/* Product Grid */}
      {filteredProducts.length === 0 ? (
        <View style={styles.emptyState}>
          <AppText style={styles.emptyEmoji}>🍽️</AppText>
          <AppText style={styles.emptyTitle}>No dishes found</AppText>
          <AppText style={styles.emptyDesc}>Try a different category or search term</AppText>
        </View>
      ) : (
        <View style={styles.productGrid}>
          {filteredProducts.map((product) => {
            const isAdded = addedId === product.id;
            return (
              <FoodProductCard
                key={product.id}
                product={product}
                isAdded={isAdded}
                onPress={() => onProductClick && onProductClick(product)}
                onAdd={() => handleAddToCartWithFeedback(product.id, product.name, product.price, product.emoji)}
              />
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  contentPadding: { paddingBottom: 40, paddingHorizontal: hs(16), paddingTop: hs(16) },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: vs(12) },
  headerTitle: { fontSize: ms(22), fontWeight: '900', color: '#0f172a' },
  toast: { backgroundColor: '#1e293b', borderRadius: ms(12), paddingVertical: vs(10), paddingHorizontal: hs(16), marginBottom: vs(16) },
  toastText: { color: '#ffffff', fontSize: ms(10), fontWeight: '700', textAlign: 'center' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff',
    borderRadius: ms(16), paddingHorizontal: hs(12), height: vs(44), marginBottom: vs(12),
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  searchIcon: { marginRight: hs(8) },
  searchInput: {
    flex: 1,
    fontSize: ms(12),
    fontWeight: '700',
    color: '#0f172a',
    paddingVertical: 0,
    height: vs(26),
    textAlignVertical: 'center',
  },
  tabsContainer: { marginBottom: vs(16), position: 'relative' },
  tabBtn: { paddingHorizontal: hs(14), paddingVertical: vs(8), marginRight: hs(4) },
  tabText: { fontSize: ms(11), fontWeight: '800', color: '#94a3b8' },
  tabTextActive: { color: '#1E5D44' },
  tabUnderline: { position: 'absolute', bottom: 0, width: ms(20), height: vs(3), backgroundColor: '#1E5D44', borderRadius: ms(1.5) },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: vs(60) },
  emptyEmoji: { fontSize: ms(40), marginBottom: vs(12) },
  emptyTitle: { fontSize: ms(12), fontWeight: '900', color: '#0f172a' },
  emptyDesc: { fontSize: ms(9.5), color: '#94a3b8', fontWeight: '600', marginTop: vs(4) },
});
