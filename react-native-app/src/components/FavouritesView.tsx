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
  Heart,
  Plus,
  Check,
  Star,
} from 'lucide-react-native';
import { categoriesSearchDatabase } from '../data/mockProducts';
import { exploreStacks } from '../data/exploreData';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface FavouritesViewProps {
  addToCart: (id: string, name: string, price: number, emoji: string) => void;
  onProductClick?: (product: any) => void;
  favorites: string[];
  toggleFavorite: (productId: string) => void;
}

export default function FavouritesView({
  addToCart,
  onProductClick,
  favorites = [],
  toggleFavorite,
}: FavouritesViewProps) {
  const [addedItem, setAddedItem] = useState<string | null>(null);

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
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      
      {/* 1. Header Banner */}
      <View style={styles.headerBanner}>
        <View style={styles.headerBannerContent}>
          <View style={styles.wishlistBadge}>
            <Text style={styles.wishlistBadgeText}>Personal Wishlists</Text>
          </View>
          <Text style={styles.headerTitle}>My Curated Favourites</Text>
          <Text style={styles.headerDesc}>Your saved items categorized across active sub apps</Text>
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
                    <Text style={styles.sectorEmoji}>{style.emoji}</Text>
                    <Text style={[styles.sectorTitle, { color: style.textColor }]}>
                      {style.title}
                    </Text>
                  </View>
                  <Text style={styles.sectorCount}>
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                  </Text>
                </View>

                <View style={styles.grid}>
                  {items.map((item) => {
                    const isAdded = addedItem === item.id;

                    return (
                      <View key={item.id} style={[styles.card, { backgroundColor: '#ffffff' }]}>
                        <TouchableOpacity
                          onPress={() => onProductClick && onProductClick(item)}
                          style={styles.cardPressable}
                          activeOpacity={0.9}
                        >
                          <View style={styles.cardImgWrap}>
                            <Image source={{ uri: item.image }} style={styles.cardImg} />
                            
                            <TouchableOpacity
                              onPress={() => toggleFavorite(item.id)}
                              style={styles.heartBtn}
                              activeOpacity={0.8}
                            >
                              <Heart size={12} color="#f43f5e" fill="#f43f5e" />
                            </TouchableOpacity>

                            <View style={styles.ratingOverlay}>
                              <Text style={styles.ratingText}>★ {item.rating}</Text>
                            </View>
                          </View>

                          <View style={styles.cardContent}>
                            <View style={styles.metaRow}>
                              <View style={[styles.appBadge, { backgroundColor: style.badgeBg }]}>
                                <Text style={[styles.appBadgeText, { color: style.badgeText }]}>{item.app}</Text>
                              </View>
                              {item.shop ? (
                                <Text style={styles.shopName} numberOfLines={1}>
                                  {item.shop}
                                </Text>
                              ) : null}
                            </View>

                            <Text style={styles.productName} numberOfLines={1}>
                              {item.name}
                            </Text>
                            <Text style={styles.productDesc} numberOfLines={2}>
                              {item.desc || 'Premium curation from selected local stores.'}
                            </Text>
                          </View>
                        </TouchableOpacity>

                        <View style={styles.cardFooter}>
                          <Text style={styles.priceText}>₹{item.price.toLocaleString('en-IN')}</Text>
                          <TouchableOpacity
                            onPress={() => handleAddToCart(item.id, item.name, item.price, item.emoji)}
                            style={[
                              styles.addBtn,
                              { backgroundColor: isAdded ? '#10b981' : style.btnBg },
                            ]}
                            activeOpacity={0.8}
                          >
                            <Plus size={8} color="#ffffff" style={{ marginRight: 2 }} />
                            <Text style={styles.addBtnText}>{isAdded ? 'Added' : 'Add'}</Text>
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
            <Heart size={28} color="#f43f5e" />
          </View>
          <Text style={styles.emptyTitle}>No Favourites Yet</Text>
          <Text style={styles.emptyDesc}>
            Tap the heart icon on any product in our categories or explore feeds to add them to your curated shortlist here!
          </Text>
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
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  headerBanner: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 16,
    marginTop: 14,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  headerBannerContent: {
    zIndex: 1,
  },
  wishlistBadge: {
    backgroundColor: 'rgba(255, 74, 107, 0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 74, 107, 0.2)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  wishlistBadgeText: {
    fontSize: 7.5,
    color: '#FF4A6B',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  headerDesc: {
    fontSize: 9.5,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 4,
  },
  sectionsList: {
    width: '100%',
  },
  sectorSection: {
    marginBottom: 16,
  },
  sectorHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 6,
    marginBottom: 10,
  },
  sectorTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectorEmoji: {
    fontSize: 12,
    marginRight: 6,
  },
  sectorTitle: {
    fontSize: 10.5,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  sectorCount: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
  },
  cardPressable: {
    flexDirection: 'column',
  },
  cardImgWrap: {
    width: '100%',
    height: 110,
    position: 'relative',
    backgroundColor: '#f8fafc',
  },
  cardImg: {
    width: '100%',
    height: '100%',
  },
  heartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    width: 24,
    height: 24,
    borderRadius: 12,
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
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  ratingText: {
    color: '#ffffff',
    fontSize: 7,
    fontWeight: '900',
  },
  cardContent: {
    padding: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  appBadge: {
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  appBadgeText: {
    fontSize: 6,
    fontWeight: '900',
  },
  shopName: {
    fontSize: 7.5,
    color: '#94a3b8',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  productName: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 4,
  },
  productDesc: {
    fontSize: 7.5,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  priceText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0f172a',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 7,
    fontWeight: '900',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    paddingVertical: 40,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff1f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
  },
  emptyDesc: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 14,
    paddingHorizontal: 20,
  },
});
