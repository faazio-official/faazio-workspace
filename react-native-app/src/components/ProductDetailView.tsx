import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {
  X,
  Heart,
  Star,
  ShieldCheck,
  Truck,
  ThumbsUp,
  Plus,
  Minus,
  Info,
  RotateCcw,
  Share2,
} from 'lucide-react-native';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface Product {
  id: string;
  name: string;
  price: number;
  emoji: string;
  rating: number;
  desc: string;
  app: 'FOOD' | 'MART' | 'GROCERY' | 'PHARMA';
  catName?: string;
  category?: string;
}

interface ProductDetailViewProps {
  product: Product;
  onClose: () => void;
  addToCart: (id: string, name: string, price: number, emoji: string) => void;
  cartItems: { id: string; name: string; price: number; quantity: number; emoji: string }[];
  updateCartQuantity: (id: string, delta: number) => void;
  favorites?: string[];
  toggleFavorite?: (productId: string) => void;
}

function getEnhancedProductDetails(item: Product) {
  const isFood = item.app === 'FOOD' || item.id.startsWith('cat-fm') || item.id.startsWith('cat-fs') || item.id.startsWith('cat-fd') || item.id.startsWith('tow');
  const isMart = item.app === 'MART' || item.id.startsWith('cat-mt') || item.id.startsWith('cat-mf') || item.id.startsWith('cat-ml');
  const isGrocery = item.app === 'GROCERY' || item.id.startsWith('cat-gg') || item.id.startsWith('cat-gs') || item.id.startsWith('cat-gd') || item.id.startsWith('gr-');
  const isPharma = item.app === 'PHARMA' || item.id.startsWith('cat-pw') || item.id.startsWith('cat-ps') || item.id.startsWith('cat-pb') || item.id.startsWith('ph-');

  let detectedApp: 'FOOD' | 'MART' | 'GROCERY' | 'PHARMA' = 'MART';
  if (isFood) detectedApp = 'FOOD';
  else if (isGrocery) detectedApp = 'GROCERY';
  else if (isPharma) detectedApp = 'PHARMA';

  let specs: { label: string; value: string }[] = [];
  if (detectedApp === 'FOOD') {
    specs = [
      { label: 'Prep Time', value: '15-20 Mins' },
      { label: 'Dietary', value: item.name.toLowerCase().includes('chicken') || item.name.toLowerCase().includes('mutton') ? 'Non-Veg' : '100% Vegetarian' },
      { label: 'Serving Size', value: 'Ideal for 1-2' },
      { label: 'Spiciness', value: item.name.toLowerCase().includes('spicy') || item.name.toLowerCase().includes('sriracha') ? '🔥 High' : 'Medium' }
    ];
  } else if (detectedApp === 'MART') {
    specs = [
      { label: 'Warranty', value: '1 Year Brand Warranty' },
      { label: 'Return Policy', value: '7 Days Replacement' },
      { label: 'Shipping', value: 'Same Day Delivery' },
      { label: 'Condition', value: '100% Genuine Sealed' }
    ];
  } else if (detectedApp === 'GROCERY') {
    specs = [
      { label: 'Shelf Life', value: 'Fresh (2-5 Days)' },
      { label: 'Source', value: 'Hydroponic Local Farm' },
      { label: 'Organic', value: 'Yes, certified organic' },
      { label: 'Storage', value: 'Keep refrigerated' }
    ];
  } else {
    specs = [
      { label: 'Dosage Form', value: item.name.toLowerCase().includes('gummies') ? 'Gummy Chews' : 'Standard Formula' },
      { label: 'Prescription', value: 'Not Required' },
      { label: 'Pack Size', value: 'Standard Consumer Pack' },
      { label: 'Safety', value: 'FDA compliant, certified' }
    ];
  }

  let reviews = [];
  if (detectedApp === 'FOOD') {
    reviews = [
      { id: 'rev-f1', user: 'Aarav Sharma', rating: 5, comment: 'Absolutely mouthwatering! Arrived piping hot, packaging was pristine. Definitely ordering again.', date: 'Today' },
      { id: 'rev-f2', user: 'Priya Patel', rating: 4, comment: 'Excellent flavor and rich taste. Portion size was very generous. Slightly spicy but incredible.', date: 'Yesterday' }
    ];
  } else if (detectedApp === 'MART') {
    reviews = [
      { id: 'rev-m1', user: 'Rohan Mehra', rating: 5, comment: 'Premium build quality. Exceeded expectations! Sleek design and works flawlessly.', date: 'Yesterday' },
      { id: 'rev-m2', user: 'Ananya Rao', rating: 5, comment: 'Super fast delivery by Faazio. Item looks beautiful, absolute value for money.', date: '2 days ago' }
    ];
  } else if (detectedApp === 'GROCERY') {
    reviews = [
      { id: 'rev-g1', user: 'Meera Nair', rating: 5, comment: 'Unbelievably fresh, looks like it was harvested this morning. Will buy weekly!', date: 'Today' },
      { id: 'rev-g2', user: 'Arjun Verma', rating: 5, comment: 'Premium quality produce. Safely packed and prompt delivery inside 15 minutes!', date: 'Yesterday' }
    ];
  } else {
    reviews = [
      { id: 'rev-p1', user: 'Dr. Sarah Alvi', rating: 5, comment: 'Excellent formula. Highly effective with very safe clinical benchmarks. Recommended.', date: 'Yesterday' },
      { id: 'rev-p2', user: 'Rajesh G.', rating: 5, comment: 'Great packaging and genuine seal. Very convenient to order via Faazio Pharma.', date: '4 days ago' }
    ];
  }

  let highlights = [];
  if (detectedApp === 'FOOD') {
    highlights = [
      'Freshly prepared on order by vetted gourmet chefs',
      'Hygiene-rated Grade A kitchen preparation standards',
      'Insulated thermal-bag delivery to retain kitchen-hot state',
      'No added preservatives, MSG, or artificial coloring agents'
    ];
  } else if (detectedApp === 'MART') {
    highlights = [
      '100% original manufacturer seal & retail carton',
      'Eligible for brand warranty assistance & registration',
      'Secured transit insurance protection from warehouse to doorstep',
      'Verified zero-defect QC pass checklist certified'
    ];
  } else if (detectedApp === 'GROCERY') {
    highlights = [
      'Ethically sourced from local pesticide-free farms',
      'Chilled-crate supply chain preserving maximum nutrient density',
      'Eco-friendly biodegradable and breathable paper pack bag',
      'Rigorous triple-wash hygiene checklist compliance'
    ];
  } else {
    highlights = [
      'Double-sealed pharmaceutical integrity packing standard',
      'Vetted storage under temperature-regulated environment',
      'Sourced exclusively from WHO-GMP certified clinical partners',
      'Complimentary consultation assistance on dosage from specialists'
    ];
  }

  return { specs, reviews, highlights, app: detectedApp };
}

export default function ProductDetailView({
  product,
  onClose,
  addToCart,
  cartItems,
  updateCartQuantity,
  favorites = [],
  toggleFavorite,
}: ProductDetailViewProps) {
  const isFavorite = favorites.includes(product.id);
  const handleToggleFavorite = () => {
    if (toggleFavorite) {
      toggleFavorite(product.id);
    }
  };

  const [helpfulCounts, setHelpfulCounts] = useState<{ [key: string]: number }>({});
  const [likedReviews, setLikedReviews] = useState<{ [key: string]: boolean }>({});

  const { specs, reviews, highlights, app } = getEnhancedProductDetails(product);

  const cartItem = cartItems.find((item) => item.id === product.id);
  const currentQuantity = cartItem ? cartItem.quantity : 0;

  const brandStyles = {
    FOOD: {
      accent: '#1e293b',
      bgColorGradient: '#f0fdf4',
      badgeBg: '#ecfdf5',
      badgeText: '#047857',
      badgeBorder: '#d1fae5',
      btnBg: '#1E5D44',
    },
    MART: {
      accent: '#1e293b',
      bgColorGradient: '#f0f9ff',
      badgeBg: '#eff6ff',
      badgeText: '#1d4ed8',
      badgeBorder: '#dbeafe',
      btnBg: '#1162D3',
    },
    GROCERY: {
      accent: '#1e293b',
      bgColorGradient: '#f0fdf4',
      badgeBg: '#f0fdf4',
      badgeText: '#15803d',
      badgeBorder: '#dcfce7',
      btnBg: '#10B981',
    },
    PHARMA: {
      accent: '#1e293b',
      bgColorGradient: '#f0fdfa',
      badgeBg: '#f0fdfa',
      badgeText: '#0f766e',
      badgeBorder: '#ccfbf1',
      btnBg: '#065F46',
    },
  }[app];

  const handleHelpfulToggle = (reviewId: string) => {
    if (likedReviews[reviewId]) {
      setHelpfulCounts((prev) => ({ ...prev, [reviewId]: (prev[reviewId] || 0) - 1 }));
      setLikedReviews((prev) => ({ ...prev, [reviewId]: false }));
    } else {
      setHelpfulCounts((prev) => ({ ...prev, [reviewId]: (prev[reviewId] || 0) + 1 }));
      setLikedReviews((prev) => ({ ...prev, [reviewId]: true }));
    }
  };

  return (
    <Modal visible animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          
          {/* Header Row */}
          <View style={styles.navBar}>
            <TouchableOpacity onPress={onClose} style={styles.navBtn} activeOpacity={0.8}>
              <X size={16} color="#0f172a" />
            </TouchableOpacity>

            <View style={styles.navBarRight}>
              <TouchableOpacity style={styles.navBtn} activeOpacity={0.8}>
                <Share2 size={14} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleToggleFavorite} style={styles.navBtn} activeOpacity={0.8}>
                <Heart size={14} color={isFavorite ? '#f43f5e' : '#64748b'} fill={isFavorite ? '#f43f5e' : 'none'} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Scrollable Contents */}
          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            
            {/* 1. Hero visual with backdrop gradient */}
            <View style={[styles.heroArea, { backgroundColor: brandStyles.bgColorGradient }]}>
              <View style={styles.emojiOuterRing}>
                <Text style={styles.emojiHero}>{product.emoji}</Text>
                <View style={styles.ratingStarsOverlay}>
                  <Text style={styles.ratingStarsText}>★ {product.rating}</Text>
                </View>
              </View>

              <View style={styles.deliverySpeedTag}>
                <Truck size={10} color="#7CE045" style={{ marginRight: 4 }} />
                <Text style={styles.deliverySpeedText}>DELIVERS IN 12-15 MINS</Text>
              </View>
            </View>

            {/* 2. Product title and metadata */}
            <View style={styles.metaPaddingBox}>
              <View style={styles.metaRow}>
                <View style={[styles.appBadge, { backgroundColor: brandStyles.badgeBg, borderColor: brandStyles.badgeBorder }]}>
                  <Text style={[styles.appBadgeText, { color: brandStyles.badgeText }]}>{app}</Text>
                </View>
                <Text style={styles.catNameText}>
                  {product.catName || product.category || 'Premium Pick'}
                </Text>
              </View>

              <View style={styles.titlePriceRow}>
                <Text style={styles.productNameText} numberOfLines={2}>{product.name}</Text>
                <View style={styles.priceColumn}>
                  <Text style={styles.priceValueText}>₹{product.price.toLocaleString('en-IN')}</Text>
                  <Text style={styles.taxLabel}>Incl. of taxes</Text>
                </View>
              </View>

              <Text style={styles.productDescText}>{product.desc}</Text>

              {/* Highlights list */}
              <View style={styles.highlightsContainer}>
                <Text style={styles.sectionHeadingText}>Key Highlights</Text>
                {highlights.map((hlt, idx) => (
                  <View key={idx} style={styles.highlightRow}>
                    <View style={styles.bulletCheckCircle}>
                      <Text style={styles.bulletCheckText}>✓</Text>
                    </View>
                    <Text style={styles.highlightText}>{hlt}</Text>
                  </View>
                ))}
              </View>

              {/* Dynamic Bank Offer */}
              <View style={styles.promoBanner}>
                <Text style={styles.promoEmoji}>🏷️</Text>
                <View style={styles.promoContentCol}>
                  <Text style={styles.promoTitle}>EXCLUSIVE BANK OFFER</Text>
                  <Text style={styles.promoDesc}>
                    Get extra 10% cashback up to ₹250 on UPI or OneCard payments. Auto-applied during checkout!
                  </Text>
                </View>
              </View>

              {/* Guarantees row */}
              <View style={styles.guaranteeGrid}>
                <View style={styles.guaranteeBox}>
                  <ShieldCheck size={14} color="#10b981" />
                  <View style={styles.guaranteeTextCol}>
                    <Text style={styles.guaranteeHeading}>Quality Verified</Text>
                    <Text style={styles.guaranteeSub}>100% genuine product</Text>
                  </View>
                </View>

                <View style={styles.guaranteeBox}>
                  <RotateCcw size={14} color="#3b82f6" />
                  <View style={styles.guaranteeTextCol}>
                    <Text style={styles.guaranteeHeading}>Hassle-Free Returns</Text>
                    <Text style={styles.guaranteeSub}>Complimentary replacement</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* 3. Specifications */}
            <View style={styles.specificationsBox}>
              <View style={styles.specHeaderRow}>
                <Info size={11} color="#94a3b8" style={{ marginRight: 6 }} />
                <Text style={styles.sectionHeadingText}>Product Specifications</Text>
              </View>
              <View style={styles.specsGrid}>
                {specs.map((spec, idx) => (
                  <View key={idx} style={styles.specCard}>
                    <Text style={styles.specLabel}>{spec.label}</Text>
                    <Text style={styles.specValue}>{spec.value}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 4. Reviews section */}
            <View style={styles.reviewsBox}>
              <View style={styles.reviewsHeaderRow}>
                <Text style={styles.sectionHeadingText}>Customer Reviews ({reviews.length})</Text>
                <View style={styles.reviewsAvgBadge}>
                  <Text style={styles.reviewsAvgText}>★ {product.rating} Average</Text>
                </View>
              </View>

              {/* Progress bars block */}
              <View style={styles.reviewProgressCard}>
                <View style={styles.reviewProgressRow}>
                  <Text style={styles.progressLabel}>5 Star</Text>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: '88%', backgroundColor: '#f59e0b' }]} />
                  </View>
                  <Text style={styles.progressPercent}>88%</Text>
                </View>
                <View style={styles.reviewProgressRow}>
                  <Text style={styles.progressLabel}>4 Star</Text>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: '10%', backgroundColor: '#f59e0b' }]} />
                  </View>
                  <Text style={styles.progressPercent}>10%</Text>
                </View>
                <View style={styles.reviewProgressRow}>
                  <Text style={styles.progressLabel}>3 Star</Text>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: '2%', backgroundColor: '#f59e0b' }]} />
                  </View>
                  <Text style={styles.progressPercent}>2%</Text>
                </View>
              </View>

              {/* Individual Reviews list */}
              <View style={styles.reviewsList}>
                {reviews.map((rev) => {
                  const liked = likedReviews[rev.id];
                  return (
                    <View key={rev.id} style={styles.reviewRow}>
                      <View style={styles.reviewUserHeader}>
                        <View style={styles.reviewUserLeft}>
                          <View style={styles.reviewUserPlaceholderCircle}>
                            <Text style={styles.reviewUserPlaceholderText}>{rev.user.charAt(0)}</Text>
                          </View>
                          <View style={{ marginLeft: 8 }}>
                            <Text style={styles.reviewUserName}>{rev.user}</Text>
                            <Text style={styles.reviewUserDate}>{rev.date}</Text>
                          </View>
                        </View>
                        <View style={styles.starsRow}>
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} size={8.5} color={i < rev.rating ? '#f59e0b' : '#cbd5e1'} fill={i < rev.rating ? '#f59e0b' : 'none'} />
                          ))}
                        </View>
                      </View>

                      <Text style={styles.reviewComment}>"{rev.comment}"</Text>

                      <View style={styles.reviewFooterRow}>
                        <TouchableOpacity onPress={() => handleHelpfulToggle(rev.id)} style={[styles.helpfulBtn, liked ? styles.helpfulBtnLiked : null]} activeOpacity={0.8}>
                          <ThumbsUp size={10} color={liked ? '#10b981' : '#64748b'} fill={liked ? '#10b981' : 'none'} style={{ marginRight: 4 }} />
                          <Text style={[styles.helpfulText, liked ? { color: '#10b981' } : null]}>Helpful ({12 + (helpfulCounts[rev.id] || 0)})</Text>
                        </TouchableOpacity>

                        <View style={styles.verifiedPurchaseRow}>
                          <ShieldCheck size={9} color="#10b981" style={{ marginRight: 2 }} />
                          <Text style={styles.verifiedPurchaseText}>Verified Purchase</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

          </ScrollView>

          {/* Sticky Bottom Action bar */}
          <View style={styles.stickyFooter}>
            <View>
              <Text style={styles.footerPriceLabel}>Total Price</Text>
              <Text style={styles.footerPriceValue}>
                ₹{(product.price * (currentQuantity || 1)).toLocaleString('en-IN')}
              </Text>
            </View>

            {currentQuantity === 0 ? (
              <TouchableOpacity
                onPress={() => addToCart(product.id, product.name, product.price, product.emoji)}
                style={[styles.addToCartBtn, { backgroundColor: brandStyles.btnBg }]}
                activeOpacity={0.8}
              >
                <Plus size={12} color="#ffffff" style={{ marginRight: 4 }} />
                <Text style={styles.addToCartBtnText}>Add to Bag</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.footerQuantityWidget}>
                <TouchableOpacity onPress={() => updateCartQuantity(product.id, -1)} style={styles.footerQtyBtn} activeOpacity={0.8}>
                  <Minus size={12} color="#0f172a" />
                </TouchableOpacity>
                <Text style={styles.footerQtyValue}>{currentQuantity}</Text>
                <TouchableOpacity onPress={() => updateCartQuantity(product.id, 1)} style={styles.footerQtyBtn} activeOpacity={0.8}>
                  <Plus size={12} color="#0f172a" />
                </TouchableOpacity>
              </View>
            )}
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#ffffff',
    width: '100%',
    height: SCREEN_HEIGHT * 0.9,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    overflow: 'hidden',
    position: 'relative',
  },
  navBar: {
    position: 'absolute',
    top: 14,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  navBarRight: {
    flexDirection: 'row',
    gap: 8,
  },
  navBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  heroArea: {
    height: SCREEN_HEIGHT * 0.3,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  emojiOuterRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
    position: 'relative',
  },
  emojiHero: {
    fontSize: 54,
  },
  ratingStarsOverlay: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  ratingStarsText: {
    color: '#ffffff',
    fontSize: 7.5,
    fontWeight: '900',
  },
  deliverySpeedTag: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  deliverySpeedText: {
    color: '#ffffff',
    fontSize: 7,
    fontWeight: '900',
  },
  metaPaddingBox: {
    padding: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  appBadge: {
    borderWidth: 0.5,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  appBadgeText: {
    fontSize: 7.5,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  catNameText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  titlePriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 8,
  },
  productNameText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    flex: 1,
  },
  priceColumn: {
    alignItems: 'flex-end',
  },
  priceValueText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  taxLabel: {
    fontSize: 7.5,
    fontWeight: '900',
    color: '#10b981',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  productDescText: {
    fontSize: 9.5,
    color: '#64748b',
    fontWeight: '600',
    lineHeight: 14,
    marginBottom: 16,
  },
  highlightsContainer: {
    borderTopWidth: 0.5,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
    marginBottom: 16,
  },
  sectionHeadingText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  bulletCheckCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    marginTop: 2,
  },
  bulletCheckText: {
    color: '#10b981',
    fontSize: 7.5,
    fontWeight: '900',
  },
  highlightText: {
    fontSize: 9,
    color: '#475569',
    fontWeight: '600',
    flex: 1,
  },
  promoBanner: {
    backgroundColor: '#fffbeb',
    borderWidth: 0.5,
    borderColor: '#fef3c7',
    borderRadius: 14,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  promoEmoji: {
    fontSize: 14,
    marginRight: 8,
  },
  promoContentCol: {
    flex: 1,
  },
  promoTitle: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#1e293b',
    textTransform: 'uppercase',
  },
  promoDesc: {
    fontSize: 7.5,
    color: '#64748b',
    fontWeight: '600',
    lineHeight: 11,
    marginTop: 2,
  },
  guaranteeGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  guaranteeBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 0.5,
    borderColor: '#f1f5f9',
    borderRadius: 12,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  guaranteeTextCol: {
    marginLeft: 6,
    flex: 1,
  },
  guaranteeHeading: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#1e293b',
  },
  guaranteeSub: {
    fontSize: 7,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 1,
  },
  specificationsBox: {
    backgroundColor: '#ffffff',
    borderTopWidth: 8,
    borderTopColor: '#f8fafc',
    borderBottomWidth: 8,
    borderBottomColor: '#f8fafc',
    padding: 16,
  },
  specHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  specCard: {
    width: '48%',
    backgroundColor: '#f8fafc',
    borderWidth: 0.5,
    borderColor: '#f1f5f9',
    borderRadius: 10,
    padding: 8,
  },
  specLabel: {
    fontSize: 7,
    color: '#94a3b8',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  specValue: {
    fontSize: 9,
    fontWeight: '900',
    color: '#334155',
    marginTop: 2,
  },
  reviewsBox: {
    backgroundColor: '#ffffff',
    padding: 16,
  },
  reviewsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewsAvgBadge: {
    backgroundColor: '#fffbeb',
    borderWidth: 0.5,
    borderColor: '#fef3c7',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  reviewsAvgText: {
    fontSize: 8,
    color: '#d97706',
    fontWeight: '900',
  },
  reviewProgressCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 0.5,
    borderColor: '#f1f5f9',
    padding: 10,
    borderRadius: 16,
    gap: 4,
    marginBottom: 16,
  },
  reviewProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressLabel: {
    width: 32,
    fontSize: 7.5,
    fontWeight: '900',
    color: '#64748b',
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressPercent: {
    width: 24,
    fontSize: 7.5,
    fontWeight: '900',
    color: '#64748b',
    textAlign: 'right',
  },
  reviewsList: {
    width: '100%',
  },
  reviewRow: {
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f1f5f9',
  },
  reviewUserHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewUserLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewUserPlaceholderCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewUserPlaceholderText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748b',
  },
  reviewUserName: {
    fontSize: 9,
    fontWeight: '900',
    color: '#1e293b',
  },
  reviewUserDate: {
    fontSize: 7,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 1,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 1,
  },
  reviewComment: {
    fontSize: 9,
    color: '#475569',
    fontWeight: '600',
    lineHeight: 13,
    marginTop: 8,
    paddingLeft: 32,
  },
  reviewFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingLeft: 32,
  },
  helpfulBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  helpfulBtnLiked: {
    backgroundColor: '#ecfdf5',
  },
  helpfulText: {
    fontSize: 7.5,
    color: '#94a3b8',
    fontWeight: '900',
  },
  verifiedPurchaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifiedPurchaseText: {
    fontSize: 7,
    color: '#94a3b8',
    fontWeight: '700',
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
  },
  footerPriceLabel: {
    fontSize: 7,
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  footerPriceValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },
  addToCartBtn: {
    height: 38,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addToCartBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  footerQuantityWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 3,
  },
  footerQtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerQtyValue: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0f172a',
    marginHorizontal: 10,
    minWidth: 16,
    textAlign: 'center',
  },
});
