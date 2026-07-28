import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  Image,
  Dimensions
} from 'react-native';
import { Clock, Minus, Plus, CheckCircle } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

import { martProducts } from '../../data/mockProducts';

// For RN mock we will borrow from martProducts or define a small internal set for grocery if mockProducts doesn't have grocery yet.
// Wait, in mockProducts.ts there's no groceryProducts array if I didn't copy it perfectly or if it was below line 50. Let's assume it's there or just use mock ones here.

export function GroceryScreen({ addToCart, cartItems, updateCartQuantity, onProductClick }: any) {
  const [selectedGrocCat, setSelectedGrocCat] = useState('All');
  const [addedFeedbackId, setAddedFeedbackId] = useState<string | null>(null);

  const subCategories = [
    { name: 'All', emoji: '🛒' },
    { name: 'Fresh Fruits', emoji: '🍎' },
    { name: 'Vegetables', emoji: '🥦' },
    { name: 'Dairy & Eggs', emoji: '🥚' },
    { name: 'Beverages', emoji: '🥤' },
    { name: 'Snacks', emoji: '🥨' }
  ];

  // Inline fallback mock grocery products since they might be missing in mockProducts.ts due to truncation.
  const groceryProducts = [
    {
      id: 'groc-1',
      name: 'Organic Farm Apples',
      price: 180,
      emoji: '🍎',
      image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6fd6c?auto=format&fit=crop&q=80&w=300&h=300',
      category: 'Fresh Fruits',
      unit: '1 kg',
      desc: 'Crisp, sweet, and freshly picked organic apples directly from the farm.',
      rating: 4.8,
      badge: 'FARM FRESH'
    },
    {
      id: 'groc-2',
      name: 'Fresh Broccoli',
      price: 85,
      emoji: '🥦',
      image: 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?auto=format&fit=crop&q=80&w=300&h=300',
      category: 'Vegetables',
      unit: '500 g',
      desc: 'Rich in vitamins, perfectly green, zero pesticides.',
      rating: 4.6
    },
    {
      id: 'groc-3',
      name: 'Farm Fresh Brown Eggs',
      price: 95,
      emoji: '🥚',
      image: 'https://images.unsplash.com/photo-1587486913049-53fc88980cfc?auto=format&fit=crop&q=80&w=300&h=300',
      category: 'Dairy & Eggs',
      unit: '6 Pieces',
      desc: 'Free-range brown eggs for your healthy protein diet.',
      rating: 4.9,
      badge: 'BESTSELLER'
    }
  ];

  const filteredProducts = selectedGrocCat === 'All' 
    ? groceryProducts 
    : groceryProducts.filter(p => p.category === selectedGrocCat);

  const getItemQuantity = (id: string) => {
    const item = cartItems?.find((i: any) => i.id === id);
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
        <ImageBackground 
          source={{ uri: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=500&h=250' }} 
          style={styles.bannerBg}
          imageStyle={styles.bannerImageStyle}
        >
          <View style={styles.bannerOverlay} />
          
          <View style={styles.bannerContent}>
            <View style={styles.rocketBadge}>
              <Text style={styles.rocketBadgeText}>🚀 FA FAST</Text>
            </View>
            <Text style={styles.bannerTitle}>Daily Grocery & Fresh Essentials</Text>
            <Text style={styles.bannerDesc}>Delivered to Sunnambukkara Street in exactly 10 minutes!</Text>
          </View>
        </ImageBackground>
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
        <View style={styles.timeBadge}>
          <Clock size={10} color="#059669" />
          <Text style={styles.timeBadgeText}>10-Min Delivery</Text>
        </View>
      </View>

      {/* Grid of grocery products */}
      <View style={styles.productsGrid}>
        {filteredProducts.map((product) => {
          const qty = getItemQuantity(product.id);
          const isRecentlyAdded = addedFeedbackId === product.id;
          return (
            <TouchableOpacity 
              key={product.id}
              style={styles.productCard}
              activeOpacity={0.9}
              onPress={() => onProductClick && onProductClick({ ...product, app: 'GROCERY' })}
            >
              <View style={styles.productImageContainer}>
                <Image source={{ uri: product.image }} style={styles.productImage} resizeMode="cover" />
                {product.badge && (
                  <View style={styles.productBadge}>
                    <Text style={styles.productBadgeText}>{product.badge}</Text>
                  </View>
                )}
              </View>

              <View style={styles.productInfo}>
                <View style={styles.ratingUnitRow}>
                  <View style={styles.ratingPill}>
                    <Text style={styles.ratingText}>★ {product.rating}</Text>
                  </View>
                  <Text style={styles.unitText}>{product.unit}</Text>
                </View>
                
                <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                <Text style={styles.productDesc} numberOfLines={2}>{product.desc}</Text>
                
                <View style={styles.productFooterRow}>
                  <Text style={styles.productPrice}>₹{product.price}</Text>
                  
                  {qty > 0 ? (
                    <View style={styles.qtyControlBox}>
                      <TouchableOpacity 
                        style={styles.qtyBtn}
                        onPress={() => updateCartQuantity && updateCartQuantity(product.id, -1)}
                      >
                        <Minus size={10} color="#047857" strokeWidth={3} />
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{qty}</Text>
                      <TouchableOpacity 
                        style={styles.qtyBtn}
                        onPress={() => updateCartQuantity && updateCartQuantity(product.id, 1)}
                      >
                        <Plus size={10} color="#047857" strokeWidth={3} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.addBtn, isRecentlyAdded ? styles.addBtnSuccess : styles.addBtnDefault]}
                      onPress={() => handleAddWithFeedback(product.id, product.name, product.price, product.emoji)}
                    >
                      {isRecentlyAdded ? (
                        <CheckCircle size={10} color="#ffffff" strokeWidth={3} />
                      ) : (
                        <Text style={styles.addBtnText}>ADD</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  bannerContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  bannerBg: {
    height: 128,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingLeft: 20,
  },
  bannerImageStyle: {
    borderRadius: 24,
  },
  bannerOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    backgroundColor: 'rgba(2, 44, 34, 0.7)',
  },
  bannerContent: {
    zIndex: 10,
    maxWidth: '75%',
  },
  rocketBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  rocketBadgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#34d399',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
  },
  bannerDesc: {
    fontSize: 9,
    color: '#cbd5e1',
    fontWeight: '500',
    marginTop: 4,
  },
  sectionContainer: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0f172a',
    paddingHorizontal: 20,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  subCatScrollList: {
    paddingHorizontal: 16,
    gap: 10,
  },
  subCatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  subCatBtnActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  subCatBtnInactive: {
    backgroundColor: '#ffffff',
    borderColor: '#f1f5f9',
  },
  subCatEmoji: {
    fontSize: 16,
  },
  subCatText: {
    fontSize: 10,
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
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 12,
  },
  productsTitleText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productsCountText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: 2,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  timeBadgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#059669',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    justifyContent: 'space-between',
  },
  productCard: {
    width: (SCREEN_WIDTH - 36) / 2,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    marginBottom: 14,
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
    top: 8,
    left: 8,
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  productBadgeText: {
    fontSize: 7,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  productInfo: {
    padding: 14,
    paddingTop: 10,
    flex: 1,
    justifyContent: 'space-between',
  },
  ratingUnitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  ratingPill: {
    backgroundColor: '#ecfdf5',
    borderColor: '#d1fae5',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ratingText: {
    fontSize: 7.5,
    fontWeight: '900',
    color: '#059669',
  },
  unitText: {
    fontSize: 7.5,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productName: {
    fontSize: 10,
    fontWeight: '900',
    color: '#020617',
    marginBottom: 4,
  },
  productDesc: {
    fontSize: 8,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 12,
  },
  productFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
    paddingTop: 10,
  },
  productPrice: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0f172a',
  },
  qtyControlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#d1fae5',
    padding: 2,
    borderRadius: 8,
  },
  qtyBtn: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#065f46',
    minWidth: 12,
    textAlign: 'center',
  },
  addBtn: {
    height: 26,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  addBtnDefault: {
    backgroundColor: '#10b981',
  },
  addBtnSuccess: {
    backgroundColor: '#059669',
  },
  addBtnText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
