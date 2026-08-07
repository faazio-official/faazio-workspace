import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Image, Animated } from 'react-native';
import {
  Heart,
  Plus,
  Check,
} from 'lucide-react-native';
import { categoriesSearchDatabase } from '@data/categories/searchDatabase';
import { exploreStacks } from '@data/explore/stacks';
import { hs, vs, ms } from '@/utils/responsive';
import EnterpriseIcon from '@/components/EnterpriseIcon';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle } from 'react-native-svg';
import AppText from '@/components/AppText';

interface FavouritesViewProps {
  contentInset?: number;
  addToCart: (id: string, name: string, price: number, emoji: string) => void;
  onProductClick?: (product: any) => void;
  favorites: string[];
  toggleFavorite: (productId: string) => void;
  onScroll?: (offsetY: number) => void;
}

export default function FavouritesView({
  contentInset = 0,
  addToCart,
  onProductClick,
  favorites = [],
  toggleFavorite,
  onScroll,
}: FavouritesViewProps) {
  const [addedItem, setAddedItem] = useState<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const handleAddToCart = (id: string, name: string, price: number, emoji: string) => {
    addToCart(id, name, price, emoji);
    setAddedItem(id);
    setTimeout(() => {
      setAddedItem(null);
    }, 1200);
  };

  const getAllProducts = () => {
    const list: any[] = [];

    Object.entries(categoriesSearchDatabase).forEach(([catId, items]: [string, any]) => {
      let app: 'FOOD' | 'MART' | 'GROCERY' | 'PHARMA' = 'MART';
      if (catId.startsWith('food-') || catId.startsWith('fd-')) app = 'FOOD';
      else if (catId.startsWith('groc-') || catId.startsWith('gr-')) app = 'GROCERY';
      else if (catId.startsWith('ph-')) app = 'PHARMA';

      items.forEach((item: any) => {
        list.push({
          ...item,
          app,
          catId,
          catName: item.catName || catId,
          image: item.image || item.img,
        });
      });
    });

    exploreStacks.forEach((stack) => {
      stack.items.forEach((item) => {
        list.push({
          id: item.id,
          name: item.name,
          price: item.price,
          rating: Number(item.rating),
          emoji: item.emoji,
          image: item.img,
          desc: `Premium GenZ favorite curated from ${item.shop}. 100% genuine quality with lightning speed delivery.`,
          app: stack.type,
          catId: stack.id,
          catName: stack.title,
          shop: item.shop,
        });
      });
    });

    return list;
  };

  const favoriteProducts = getAllProducts().filter((p) => favorites.includes(p.id));

  const categorized = {
    FOOD: favoriteProducts.filter((p) => p.app === 'FOOD'),
    MART: favoriteProducts.filter((p) => p.app === 'MART'),
    GROCERY: favoriteProducts.filter((p) => p.app === 'GROCERY'),
    PHARMA: favoriteProducts.filter((p) => p.app === 'PHARMA'),
  };

  const hasAnyFavorites = favoriteProducts.length > 0;

  const sectorStyles = {
    FOOD: {
      title: 'Food Delivery & Dining',
      emoji: '🍲',
      textColor: '#047857',
      borderColor: '#d1fae5',
      badgeBg: '#ecfdf5',
      badgeText: '#047857',
      btnBg: '#1E5D44',
      cardBg: '#f0fdf4',
    },
    MART: {
      title: 'Fashion, Tech & Lifestyle',
      emoji: '🛍️',
      textColor: '#1d4ed8',
      borderColor: '#dbeafe',
      badgeBg: '#eff6ff',
      badgeText: '#1d4ed8',
      btnBg: '#1162D3',
      cardBg: '#f0f9ff',
    },
    GROCERY: {
      title: 'Grocery & Fresh Essentials',
      emoji: '🍏',
      textColor: '#15803d',
      borderColor: '#dcfce7',
      badgeBg: '#f0fdf4',
      badgeText: '#15803d',
      btnBg: '#10B981',
      cardBg: '#f0fdf4',
    },
    PHARMA: {
      title: 'Pharma & Wellness Care',
      emoji: '💊',
      textColor: '#0f766e',
      borderColor: '#ccfbf1',
      badgeBg: '#f0fdfa',
      badgeText: '#0f766e',
      btnBg: '#065F46',
      cardBg: '#f0fdfa',
    },
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.scrollContent, { paddingTop: contentInset }]} showsVerticalScrollIndicator={false}
      onScroll={onScroll ? (e) => onScroll(e.nativeEvent.contentOffset.y) : undefined}
      scrollEventThrottle={16}>
      
      {/* 1. Header Banner */}
      <View style={styles.headerBanner}>
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="favBannerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#4c0519" />
              <Stop offset="60%" stopColor="#0f172a" />
              <Stop offset="100%" stopColor="#172033" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#favBannerGrad)" />
          <Circle cx="110%" cy="110%" r={hs(72)} fill="rgba(244,63,94,0.10)" />
          <Circle cx="-10%" cy="-10%" r={hs(72)} fill="rgba(59,130,246,0.10)" />
        </Svg>
        <View style={styles.headerBannerContent}>
          <View style={styles.wishlistBadge}>
            <AppText style={styles.wishlistBadgeText}>Personal Wishlists</AppText>
          </View>
          <AppText style={styles.headerTitle}>My Curated Favourites</AppText>
          <AppText style={styles.headerDesc}>Your saved items categorized across active sub apps</AppText>
        </View>
      </View>

      {/* 2. Categorized Sections */}
      {hasAnyFavorites ? (
        <View style={styles.sectionsList}>
          {(Object.keys(categorized) as Array<keyof typeof categorized>).map((key) => {
            const items = categorized[key];
            if (items.length === 0) return null;

            const style = sectorStyles[key];

            return (
              <View key={key} style={styles.sectorSection}>
                <View style={styles.sectorHeaderRow}>
                  <View style={styles.sectorTitleWrap}>
                    <EnterpriseIcon emoji={style.emoji} variant="flat" size={ms(11)} />
                    <AppText style={[styles.sectorTitle, { color: style.textColor }]}>
                      {style.title}
                    </AppText>
                  </View>
                  <AppText style={styles.sectorCount}>
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                  </AppText>
                </View>

                <View style={styles.grid}>
                  {items.map((item) => {
                    const isAdded = addedItem === item.id;

                    return (
                      <View key={item.id} style={[styles.card, { backgroundColor: style.cardBg }]}>
                        <TouchableOpacity
                          onPress={() => onProductClick && onProductClick(item)}
                          style={styles.cardPressable}
                          activeOpacity={0.9}
                        >
                          <View style={styles.cardImgWrap}>
                            <Image source={{ uri: item.image }} style={styles.cardImg} />
                            
                            <View style={styles.enterpriseIconStamp}>
                              <EnterpriseIcon emoji={item.emoji || '🛍️'} variant="circle" size={ms(28)} bgColor="rgba(255,255,255,0.95)" />
                            </View>

                            <TouchableOpacity
                              onPress={() => toggleFavorite(item.id)}
                              style={styles.heartBtn}
                              activeOpacity={0.8}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <Heart size={ms(12)} color="#f43f5e" fill="#f43f5e" />
                            </TouchableOpacity>

                            <View style={styles.ratingOverlay}>
                              <AppText style={styles.ratingText}>★ {item.rating}</AppText>
                            </View>
                          </View>

                          <View style={styles.cardContent}>
                            <View style={styles.metaRow}>
                              <View style={[styles.appBadge, { backgroundColor: style.badgeBg, borderColor: style.borderColor }]}>
                                <AppText style={[styles.appBadgeText, { color: style.badgeText }]}>{item.app}</AppText>
                              </View>
                              {item.shop ? (
                                <AppText style={styles.shopName} numberOfLines={1}>
                                  {item.shop}
                                </AppText>
                              ) : null}
                            </View>

                            <AppText style={styles.productName} numberOfLines={1}>
                              {item.name}
                            </AppText>
                            <AppText style={styles.productDesc} numberOfLines={2}>
                              {item.desc}
                            </AppText>
                          </View>
                        </TouchableOpacity>

                        <View style={styles.cardFooter}>
                          <AppText style={styles.priceText}>₹{item.price.toLocaleString('en-IN')}</AppText>
                          <TouchableOpacity
                            onPress={() => handleAddToCart(item.id, item.name, item.price, item.emoji)}
                            style={[
                              styles.addBtn,
                              { backgroundColor: isAdded ? '#059669' : style.btnBg },
                            ]}
                            activeOpacity={0.8}
                          >
                            {isAdded ? (
                              <Check size={ms(8)} strokeWidth={3} color="#ffffff" />
                            ) : (
                              <Plus size={ms(8)} color="#ffffff" />
                            )}
                            <AppText style={styles.addBtnText}>{isAdded ? 'Added' : 'Add'}</AppText>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        /* Empty State */
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconCircle}>
            <Animated.View style={{ opacity: pulseAnim }}>
              <Heart size={ms(20)} color="#fb7185" strokeWidth={2} />
            </Animated.View>
          </View>
          <AppText style={styles.emptyTitle}>No Favourites Yet</AppText>
          <AppText style={styles.emptyDesc}>
            Tap the heart icon on any product in our categories or explore feeds to add them to your curated shortlist here!
          </AppText>
        </View>
      )}

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
  headerBanner: {
    backgroundColor: '#0f172a',
    borderRadius: ms(26),
    padding: ms(16),
    marginTop: vs(14),
    marginBottom: vs(16),
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e293b',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 1,
  },
  headerBannerContent: {
    zIndex: 1,
  },
  wishlistBadge: {
    backgroundColor: 'rgba(255, 74, 107, 0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 74, 107, 0.2)',
    paddingVertical: vs(2),
    paddingHorizontal: hs(10),
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginBottom: vs(6),
  },
  wishlistBadgeText: {
    fontSize: ms(8),
    color: '#FF4A6B',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: -0.3,
  },
  headerDesc: {
    fontSize: ms(9.5),
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: vs(4),
  },
  sectionsList: {
    width: '100%',
  },
  sectorSection: {
    marginBottom: vs(16),
  },
  sectorHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: vs(6),
    marginBottom: vs(10),
  },
  sectorTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
  },
  sectorTitle: {
    fontSize: ms(11),
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectorCount: {
    fontSize: ms(9),
    color: '#94a3b8',
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: hs(14),
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    borderRadius: ms(24),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
  },
  cardPressable: {
    flexDirection: 'column',
  },
  cardImgWrap: {
    width: '100%',
    height: vs(128),
    position: 'relative',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(241,245,249,0.5)',
  },
  cardImg: {
    width: '100%',
    height: '100%',
  },
  enterpriseIconStamp: {
    position: 'absolute',
    top: vs(10),
    left: hs(10),
    zIndex: 2,
    borderWidth: 1,
    borderColor: 'rgba(241,245,249,0.3)',
    borderRadius: ms(14),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  heartBtn: {
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
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  ratingOverlay: {
    position: 'absolute',
    bottom: vs(10),
    left: hs(10),
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingVertical: vs(2),
    paddingHorizontal: hs(6),
    borderRadius: ms(6),
  },
  ratingText: {
    color: '#ffffff',
    fontSize: ms(7.5),
    fontWeight: '900',
  },
  cardContent: {
    padding: vs(12),
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
  },
  appBadge: {
    paddingVertical: vs(1),
    paddingHorizontal: hs(4),
    borderRadius: ms(4),
    borderWidth: 1,
    letterSpacing: 0.5,
  },
  appBadgeText: {
    fontSize: ms(6),
    fontWeight: '900',
  },
  shopName: {
    fontSize: ms(7.5),
    color: '#94a3b8',
    fontWeight: '700',
    textTransform: 'uppercase',
    maxWidth: hs(80),
  },
  productName: {
    fontSize: ms(10),
    fontWeight: '900',
    color: '#020617',
    marginTop: vs(4),
  },
  productDesc: {
    fontSize: ms(8),
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: vs(2),
    lineHeight: ms(10),
    minHeight: vs(22),
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#f8fafc',
    backgroundColor: 'rgba(255,255,255,0.5)',
    paddingTop: vs(8),
    paddingHorizontal: hs(10),
    paddingBottom: vs(10),
  },
  priceText: {
    fontSize: ms(10.5),
    fontWeight: '900',
    color: '#0f172a',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: Math.max(26, vs(26)),
    paddingHorizontal: hs(8),
    borderRadius: ms(8),
    gap: hs(2),
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: ms(7),
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: ms(32),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    paddingVertical: vs(64),
    paddingHorizontal: hs(16),
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  emptyIconCircle: {
    width: ms(64),
    height: ms(64),
    borderRadius: ms(32),
    backgroundColor: '#fff1f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(12),
    borderWidth: 2,
    borderColor: '#fb7185',
  },
  emptyTitle: {
    fontSize: ms(12),
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: -0.3,
  },
  emptyDesc: {
    fontSize: ms(10),
    color: '#94a3b8',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: vs(6),
    lineHeight: ms(14),
    maxWidth: hs(260),
  },
});
