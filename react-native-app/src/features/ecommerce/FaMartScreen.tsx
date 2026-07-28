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
import {
  Shirt,
  Smartphone,
  Sparkles,
  Laptop,
  Gamepad,
  Trophy,
  Tv,
  Star,
  ShoppingCart,
  TrendingUp,
  Percent,
  CheckCircle,
  ShoppingBag
} from 'lucide-react-native';
import { martProducts } from '../../data/mockProducts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface FaMartScreenProps {
  addToCart?: (id: string, name: string, price: number, emoji: string) => void;
  onProductClick?: (product: any) => void;
  favorites?: string[];
  toggleFavorite?: (id: string) => void;
}

export function FaMartScreen({ addToCart, onProductClick }: FaMartScreenProps) {
  const [selectedSubCat, setSelectedSubCat] = useState<string>('All');
  const [activeBanner, setActiveBanner] = useState<number>(0);
  const [addedAnimationId, setAddedAnimationId] = useState<string | null>(null);

  const banners = [
    {
      title: "Electronic Bonanza Sale",
      subtitle: "UP TO 50% OFF",
      desc: "Top deals on audio & smartphones with premium glass screens",
      image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=600&h=300",
      bgGradient: ['rgba(30, 58, 138, 0.9)', 'rgba(15, 23, 42, 0.8)', 'transparent'],
      accent: "#2F80ED"
    },
    {
      title: "Great Winter Collection",
      subtitle: "FLAT 40% OFF",
      desc: "Chic luxury fashion curated for modern premium street style",
      image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=600&h=300",
      bgGradient: ['rgba(88, 28, 135, 0.95)', 'rgba(88, 28, 135, 0.85)', 'transparent'],
      accent: "#E040FB"
    }
  ];

  const subCategories = [
    { name: 'All', icon: ShoppingBag, color: '#475569', bg: '#f1f5f9' },
    { name: 'Fashion', icon: Shirt, color: '#f43f5e', bg: '#fff1f2' },
    { name: 'Mobiles', icon: Smartphone, color: '#3b82f6', bg: '#eff6ff' },
    { name: 'Beauty', icon: Sparkles, color: '#f59e0b', bg: '#fffbeb' },
    { name: 'Electronics', icon: Laptop, color: '#6366f1', bg: '#eef2ff' },
    { name: 'Toys', icon: Gamepad, color: '#10b981', bg: '#ecfdf5' },
    { name: 'Sports', icon: Trophy, color: '#f97316', bg: '#fff7ed' },
    { name: 'Appliances', icon: Tv, color: '#a855f7', bg: '#faf5ff' },
  ];

  const filteredProducts = selectedSubCat === 'All' 
    ? martProducts 
    : martProducts.filter(p => p.category === selectedSubCat);

  const handleAddWithFeedback = (id: string, name: string, price: number, emoji: string) => {
    if (addToCart) addToCart(id, name, price, emoji);
    setAddedAnimationId(id);
    setTimeout(() => {
      setAddedAnimationId(null);
    }, 1500);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
      
      {/* Banner */}
      <View style={styles.bannerContainer}>
        <ImageBackground 
          source={{ uri: banners[activeBanner].image }} 
          style={styles.bannerBg}
          imageStyle={styles.bannerImageStyle}
        >
          <View style={[styles.bannerOverlay, { backgroundColor: banners[activeBanner].bgGradient[0] }]} />
          
          <View style={styles.bannerContent}>
            <Text style={styles.bannerSubtitle}>{banners[activeBanner].subtitle}</Text>
            <Text style={styles.bannerTitle}>{banners[activeBanner].title}</Text>
            <Text style={styles.bannerDesc} numberOfLines={2}>{banners[activeBanner].desc}</Text>
            
            <View style={styles.bannerActionRow}>
              <TouchableOpacity 
                style={[styles.bannerBtn, { backgroundColor: banners[activeBanner].accent }]}
                onPress={() => {
                  if (activeBanner === 0) setSelectedSubCat('Electronics');
                  else setSelectedSubCat('Fashion');
                }}
              >
                <Text style={styles.bannerBtnText}>SHOP NOW</Text>
              </TouchableOpacity>

              <View style={styles.dotsRow}>
                {banners.map((_, idx) => (
                  <TouchableOpacity 
                    key={idx}
                    style={[styles.dot, activeBanner === idx ? styles.activeDot : styles.inactiveDot]}
                    onPress={() => setActiveBanner(idx)}
                  />
                ))}
              </View>
            </View>
          </View>
        </ImageBackground>
      </View>

      {/* Subcategories */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>EXPLORE CATEGORIES</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subCatScrollList}>
          {subCategories.map((sub, index) => {
            const isSelected = selectedSubCat === sub.name;
            const Icon = sub.icon;
            return (
              <TouchableOpacity
                key={index}
                style={[styles.subCatBtn, isSelected ? styles.subCatBtnActive : styles.subCatBtnInactive]}
                onPress={() => setSelectedSubCat(sub.name)}
              >
                <View style={[styles.subCatIconBg, { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : sub.bg }]}>
                  <Icon size={14} color={isSelected ? '#ffffff' : sub.color} />
                </View>
                <Text style={[styles.subCatText, isSelected ? styles.subCatTextActive : styles.subCatTextInactive]}>
                  {sub.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Products list header */}
      <View style={styles.productsHeaderRow}>
        <View style={styles.productsTitleGroup}>
          <TrendingUp size={14} color="#1162D3" />
          <Text style={styles.productsTitleText}>
            {selectedSubCat === 'All' ? 'Trending Products' : `${selectedSubCat} Deals`}
          </Text>
        </View>
        <Text style={styles.productsCountText}>{filteredProducts.length} items</Text>
      </View>

      {/* Grid of products */}
      <View style={styles.productsGrid}>
        {filteredProducts.map((product) => {
          const isAdded = addedAnimationId === product.id;
          return (
            <TouchableOpacity 
              key={product.id}
              style={styles.productCard}
              activeOpacity={0.9}
              onPress={() => onProductClick && onProductClick(product)}
            >
              <View style={styles.productImageContainer}>
                <Image source={{ uri: product.image }} style={styles.productImage} resizeMode="cover" />
                {product.badge && (
                  <View style={[styles.productBadge, { backgroundColor: product.badgeBg || '#1162D3' }]}>
                    <Text style={styles.productBadgeText}>{product.badge}</Text>
                  </View>
                )}
                
                {/* Rating pill */}
                <View style={styles.ratingPill}>
                  <Text style={styles.ratingText}>{product.rating}</Text>
                  <Star size={8} color="#f59e0b" fill="#f59e0b" />
                  <Text style={styles.ratingCount}>({product.reviews})</Text>
                </View>
              </View>

              <View style={styles.productInfo}>
                <Text style={styles.productCategory}>{product.category}</Text>
                <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                <Text style={styles.productDesc} numberOfLines={1}>{product.desc}</Text>
                
                <View style={styles.productFooterRow}>
                  <View>
                    <Text style={styles.productPrice}>₹{product.price}</Text>
                  </View>
                  
                  <TouchableOpacity
                    style={[styles.addBtn, isAdded ? styles.addBtnSuccess : styles.addBtnDefault]}
                    onPress={() => handleAddWithFeedback(product.id, product.name, product.price, product.emoji)}
                  >
                    {isAdded ? (
                      <CheckCircle size={14} color="#ffffff" />
                    ) : (
                      <ShoppingCart size={14} color="#ffffff" />
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
    height: 150,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingLeft: 24,
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
    opacity: 0.85,
  },
  bannerContent: {
    zIndex: 10,
    maxWidth: '65%',
  },
  bannerSubtitle: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: '#34d399',
    textTransform: 'uppercase',
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 4,
  },
  bannerDesc: {
    fontSize: 10,
    color: '#e2e8f0',
    fontWeight: '500',
    marginTop: 6,
    lineHeight: 14,
  },
  bannerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  bannerBtn: {
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 16,
  },
  bannerBtnText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 9,
    letterSpacing: 1,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    width: 14,
    backgroundColor: '#ffffff',
  },
  inactiveDot: {
    width: 6,
    backgroundColor: 'rgba(255,255,255,0.4)',
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
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  subCatBtnActive: {
    backgroundColor: '#1162D3',
    borderColor: '#1162D3',
  },
  subCatBtnInactive: {
    backgroundColor: '#ffffff',
    borderColor: '#f1f5f9',
  },
  subCatIconBg: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
  productsTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  productsTitleText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  productsCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    justifyContent: 'space-between',
  },
  productCard: {
    width: (SCREEN_WIDTH - 36) / 2, // 2 columns with padding
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginBottom: 12,
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
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  productBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ratingPill: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#0f172a',
  },
  ratingCount: {
    fontSize: 8,
    fontWeight: '700',
    color: '#64748b',
  },
  productInfo: {
    padding: 12,
  },
  productCategory: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  productName: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0f172a',
    lineHeight: 16,
    marginBottom: 4,
  },
  productDesc: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 10,
  },
  productFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1162D3',
  },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDefault: {
    backgroundColor: '#0f172a',
  },
  addBtnSuccess: {
    backgroundColor: '#10b981',
  },
});
