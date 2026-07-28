import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { ShoppingCart, Star, Tag, ShoppingBag, Heart, ArrowLeft, ArrowRight } from 'lucide-react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function EcommerceScreen() {
  const [activeCategory, setActiveCategory] = useState('All Mart');
  const [cartCount, setCartCount] = useState(0);

  const categories = ['All Mart', 'Apparel', 'Footwear', 'Accessories', 'Tech'];

  const products = [
    { 
      id: 'em-1', 
      name: 'Faazio Premium Fit Hoodie', 
      price: '₹3,499', 
      rating: '4.9', 
      image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&q=80&w=300&h=300',
      tag: 'FA SPECIAL',
      category: 'Apparel'
    },
    { 
      id: 'em-2', 
      name: 'Milano Leather Boots', 
      price: '₹8,999', 
      rating: '4.8', 
      image: 'https://images.unsplash.com/photo-1520639888713-7851133b1ed0?auto=format&fit=crop&q=80&w=300&h=300',
      tag: 'EXCLUSIVE',
      category: 'Footwear'
    },
    { 
      id: 'em-3', 
      name: 'Minimalist Thermal Bottle', 
      price: '₹1,299', 
      rating: '4.7', 
      image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&q=80&w=300&h=300',
      tag: 'TRENDING',
      category: 'Accessories'
    },
    { 
      id: 'em-4', 
      name: 'Noise-Canceling Pods Pro', 
      price: '₹4,499', 
      rating: '4.9', 
      image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=300&h=300',
      tag: 'NEW LAUNCH',
      category: 'Tech'
    },
  ];

  const filteredProducts = activeCategory === 'All Mart' 
    ? products 
    : products.filter(p => p.category === activeCategory);

  const handleAddToCart = (name: string) => {
    setCartCount(prev => prev + 1);
    Alert.alert('Basket Updated', `"${name}" added successfully to your Faazio Mart basket.`);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Mini App Top Header Row */}
      <View style={styles.appHeader}>
        <View style={styles.appTitleWrapper}>
          <View style={styles.logoBadge}>
            <ShoppingBag size={14} color="#e11d48" />
          </View>
          <View>
            <Text style={styles.appTitle}>FA Mart</Text>
            <Text style={styles.appSubtitle}>Curated Brands, Delivered Instantly</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.cartIconWrapper}
          onPress={() => Alert.alert('Mart Checkout', `Your basket has ${cartCount} items. Ready to place your order?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Checkout Now', onPress: () => {
              setCartCount(0);
              Alert.alert('Order Placed!', 'Your custom boutique order has been booked with Faazio Partners.');
            }}
          ])}
          activeOpacity={0.8}
        >
          <ShoppingCart size={18} color="#e11d48" />
          {cartCount > 0 && (
            <View style={styles.badgeCount}>
              <Text style={styles.badgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={styles.promotionBanner}>
          <View style={styles.promoTextCol}>
            <View style={styles.dealTag}>
              <Tag size={10} color="#e11d48" style={{ marginRight: 4 }} />
              <Text style={styles.dealTagText}>LIMITED TIME DEAL</Text>
            </View>
            <Text style={styles.promoTitle}>Boutique Wardrobe Sale</Text>
            <Text style={styles.promoDesc}>Get up to 40% discount on global fashion labels today.</Text>
          </View>
          <View style={styles.discountBadge}>
            <Text style={styles.discountNum}>40%</Text>
            <Text style={styles.discountOff}>OFF</Text>
          </View>
        </View>

        {/* Section categories */}
        <Text style={styles.sectionHeading}>Browse Collections</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesRow}>
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setActiveCategory(cat)}
                style={[styles.categoryBtn, isActive && styles.categoryBtnActive]}
                activeOpacity={0.8}
              >
                <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Product Grid */}
        <Text style={styles.sectionHeading}>Featured Products</Text>
        <View style={styles.productGrid}>
          {filteredProducts.map((item) => (
            <View key={item.id} style={styles.productCard}>
              <View style={styles.imageWrapper}>
                <Image source={{ uri: item.image }} style={styles.productImage} />
                <View style={styles.productBadge}>
                  <Text style={styles.badgeLabel}>{item.tag}</Text>
                </View>
                <TouchableOpacity style={styles.favBtn} activeOpacity={0.8}>
                  <Heart size={14} color="#e11d48" fill="#e11d48" />
                </TouchableOpacity>
              </View>

              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                <View style={styles.ratingRow}>
                  <Star size={10} color="#f59e0b" fill="#f59e0b" />
                  <Text style={styles.ratingValue}>{item.rating}</Text>
                  <Text style={styles.dotSeparator}>•</Text>
                  <Text style={styles.deliveryTime}>Instant Delivery</Text>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.priceValue}>{item.price}</Text>
                  <TouchableOpacity 
                    onPress={() => handleAddToCart(item.name)}
                    style={styles.addBtn}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.addBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
  appTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#fff1f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  appTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  appSubtitle: {
    fontSize: 9.5,
    color: '#64748b',
    fontWeight: '600',
  },
  cartIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#fff1f2',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeCount: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#e11d48',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: SCREEN_HEIGHT < 700 ? 16 : 32,
  },
  promotionBanner: {
    backgroundColor: '#fff1f2',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ffe4e6',
  },
  promoTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  dealTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  dealTagText: {
    color: '#e11d48',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  promoTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#9f1239',
  },
  promoDesc: {
    fontSize: 10,
    color: '#be123c',
    marginTop: 4,
    lineHeight: 14,
    fontWeight: '500',
  },
  discountBadge: {
    backgroundColor: '#e11d48',
    borderRadius: 14,
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountNum: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  discountOff: {
    color: '#ffffff',
    fontSize: 7,
    fontWeight: '900',
    marginTop: -2,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  categoriesRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  categoryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  categoryBtnActive: {
    backgroundColor: '#e11d48',
    borderColor: '#e11d48',
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  categoryTextActive: {
    color: '#ffffff',
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  productCard: {
    width: '48%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    marginBottom: 6,
  },
  imageWrapper: {
    width: '100%',
    height: SCREEN_HEIGHT < 700 ? 110 : 130,
    position: 'relative',
    backgroundColor: '#f8fafc',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#e2e8f0',
  },
  badgeLabel: {
    fontSize: 7,
    fontWeight: '900',
    color: '#e11d48',
  },
  favBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingValue: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    marginLeft: 3,
  },
  dotSeparator: {
    fontSize: 8,
    color: '#94a3b8',
    marginHorizontal: 4,
  },
  deliveryTime: {
    fontSize: 9,
    color: '#10b981',
    fontWeight: '800',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
  },
  addBtn: {
    backgroundColor: '#e11d48',
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
});
