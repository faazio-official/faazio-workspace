import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
} from 'react-native';
import { Minus, Plus, CheckCircle } from 'lucide-react-native';
import { hs, vs, ms, SCREEN_W } from '@/utils/responsive';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { groceryProducts } from '@data/grocery/products';
import GroceryProductCard from '@/components/shared/GroceryProductCard';

interface GroceryScreenProps {
  addToCart?: (id: string, name: string, price: number, emoji: string) => void;
  cartItems?: { id: string; name: string; price: number; quantity: number; emoji: string }[];
  updateCartQuantity?: (id: string, delta: number) => void;
  onProductClick?: (product: any) => void;
}

function PulseButton({ children, ...props }: any) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.6, duration: 400, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={{ opacity }}>
      <TouchableOpacity {...props}>{children}</TouchableOpacity>
    </Animated.View>
  );
}

const getDisplayPrice = (price: number) => {
  try {
    return `₹${price.toLocaleString('en-IN')}`;
  } catch {
    return `₹${price}`;
  }
};

export function GroceryScreen({ addToCart, cartItems, updateCartQuantity, onProductClick }: GroceryScreenProps) {
  const [selectedGrocCat, setSelectedGrocCat] = useState('All');
  const [addedFeedbackId, setAddedFeedbackId] = useState<string | null>(null);

  const subCategories = [
    { name: 'All', emoji: '🍏' },
    { name: 'Fresh Produce', emoji: '🥦' },
    { name: 'Dairy & Eggs', emoji: '🥚' },
    { name: 'Bakery', emoji: '🍞' },
    { name: 'Beverages', emoji: '🥛' },
    { name: 'Snacks', emoji: '🍿' },
  ];

  const filteredProducts = selectedGrocCat === 'All' 
    ? groceryProducts 
    : groceryProducts.filter(p => p.category === selectedGrocCat);

  const getItemQuantity = (id: string) => {
    const item = cartItems?.find(i => i.id === id);
    return item ? item.quantity : 0;
  };

  const handleAddWithFeedback = (id: string, name: string, price: number, emoji: string) => {
    if (addToCart) addToCart(id, name, price, emoji);
    setAddedFeedbackId(id);
    setTimeout(() => {
      setAddedFeedbackId(null);
    }, 1200);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
      
      {/* Grocery Supermarket Promo Banner */}
      <View style={styles.bannerContainer}>
        <View style={styles.bannerWrapper}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=500&h=250' }} 
            style={styles.bannerBg}
          />
          <Svg style={styles.bannerSvgOverlay}>
            <Defs>
              <LinearGradient id="bannerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#022c22" stopOpacity="0.95" />
                <Stop offset="50%" stopColor="rgba(15,23,42,0.95)" stopOpacity="0.85" />
                <Stop offset="100%" stopColor="transparent" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#bannerGrad)" />
          </Svg>
          
          <View style={styles.bannerContent}>
            <View style={styles.rocketBadge}>
              <Text style={styles.rocketBadgeText}>🚀 FA FAST</Text>
            </View>
            <Text style={styles.bannerTitle}>Daily Grocery & Fresh Essentials</Text>
            <Text style={styles.bannerDesc}>Delivered to Sunnambukkara Street in exactly 10 minutes!</Text>
          </View>
        </View>
      </View>

      {/* Horizontal Subcategories Row */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>SUPERMARKET AISLES</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subCatScrollList}>
          {subCategories.map((sub, index) => {
            const isSelected = selectedGrocCat === sub.name;
            return (
              <TouchableOpacity
                key={index}
                style={[styles.subCatBtn, isSelected ? styles.subCatBtnActive : styles.subCatBtnInactive]}
                onPress={() => setSelectedGrocCat(sub.name)}
                activeOpacity={0.8}
              >
                <Text style={styles.subCatEmoji}>{sub.emoji}</Text>
                <Text style={[styles.subCatText, isSelected ? styles.subCatTextActive : styles.subCatTextInactive]}>
                  {sub.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Product List header */}
      <View style={styles.productsHeaderRow}>
        <View>
          <Text style={styles.productsTitleText}>
            {selectedGrocCat === 'All' ? 'FARM-FRESH STAPLES' : `${selectedGrocCat.toUpperCase()} COLLECTION`}
          </Text>
          <Text style={styles.productsCountText}>{filteredProducts.length} items packed with care</Text>
        </View>
      </View>

      {/* Grid of grocery products */}
      <View style={styles.productsGrid}>
        {filteredProducts.map((product) => {
          const qty = getItemQuantity(product.id);
          return (
            <GroceryProductCard
              key={product.id}
              product={{ ...product, app: 'GROCERY' as const }}
              quantity={qty}
              isAdded={addedFeedbackId === product.id}
              onPress={() => onProductClick && onProductClick({ ...product, app: 'GROCERY' })}
              onAdd={() => handleAddWithFeedback(product.id, product.name, product.price, product.emoji)}
              onIncrement={() => updateCartQuantity && updateCartQuantity(product.id, 1)}
              onDecrement={() => updateCartQuantity && updateCartQuantity(product.id, -1)}
            />
          );
        })}
      </View>

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
  bannerContainer: {
    paddingHorizontal: hs(16),
    paddingTop: vs(16),
  },
  bannerWrapper: {
    height: vs(128),
    borderRadius: ms(24),
    overflow: 'hidden',
    justifyContent: 'center',
    paddingLeft: hs(20),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerBg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  bannerSvgOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  bannerContent: {
    zIndex: 10,
    maxWidth: '70%',
  },
  rocketBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: hs(8),
    paddingVertical: vs(2),
    borderRadius: ms(4),
    marginBottom: vs(4),
  },
  rocketBadgeText: {
    fontSize: ms(8.5),
    fontWeight: '900',
    color: '#56B821',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  bannerTitle: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#ffffff',
  },
  bannerDesc: {
    fontSize: ms(9),
    color: '#cbd5e1',
    fontWeight: '500',
    marginTop: vs(4),
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
    paddingHorizontal: hs(14),
    paddingVertical: vs(10),
    borderRadius: ms(16),
    borderWidth: 1,
  },
  subCatBtnActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
    transform: [{ scale: 1.05 }],
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  subCatBtnInactive: {
    backgroundColor: '#ffffff',
    borderColor: '#f1f5f9',
  },
  subCatEmoji: {
    fontSize: ms(16),
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
  productsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    marginTop: vs(20),
    marginBottom: vs(12),
  },
  productsTitleText: {
    fontSize: ms(12),
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productsCountText: {
    fontSize: ms(9),
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: vs(2),
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: hs(12),
    justifyContent: 'space-between',
  },
  productCard: {
    width: (SCREEN_W - hs(36)) / 2,
    backgroundColor: '#ffffff',
    borderRadius: ms(24),
    marginBottom: vs(14),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
  },
  productImageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f8fafc',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productBadge: {
    position: 'absolute',
    top: vs(8),
    left: hs(8),
    backgroundColor: '#10b981',
    paddingHorizontal: hs(8),
    paddingVertical: vs(2),
    borderRadius: 999,
  },
  productBadgeText: {
    fontSize: ms(7),
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  productInfo: {
    padding: hs(14),
    paddingTop: vs(10),
  },
  ratingUnitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    marginBottom: vs(4),
  },
  ratingPill: {
    backgroundColor: '#ecfdf5',
    borderColor: '#d1fae5',
    borderWidth: 1,
    paddingHorizontal: hs(6),
    paddingVertical: vs(2),
    borderRadius: ms(4),
  },
  ratingText: {
    fontSize: ms(7.5),
    fontWeight: '900',
    color: '#059669',
  },
  unitText: {
    fontSize: ms(7.5),
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  productName: {
    fontSize: ms(10),
    fontWeight: '900',
    color: '#020617',
    marginBottom: vs(4),
  },
  productDesc: {
    fontSize: ms(8),
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: vs(12),
    minHeight: vs(22),
  },
  priceActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
    paddingTop: vs(10),
    paddingHorizontal: hs(14),
    paddingBottom: vs(12),
  },
  productPrice: {
    fontSize: ms(11),
    fontWeight: '900',
    color: '#0f172a',
  },
  qtyControlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#d1fae5',
    padding: vs(2),
    borderRadius: ms(8),
  },
  qtyBtn: {
    width: ms(20),
    height: ms(20),
    borderRadius: ms(6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: ms(9.5),
    fontWeight: '900',
    color: '#065f46',
    minWidth: ms(12),
    textAlign: 'center',
  },
  addBtn: {
    height: vs(26),
    paddingHorizontal: hs(12),
    borderRadius: ms(8),
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: hs(2),
  },
  addBtnDefault: {
    backgroundColor: '#10b981',
  },
  addBtnSuccess: {
    backgroundColor: '#059669',
  },
  addBtnText: {
    fontSize: ms(8),
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
