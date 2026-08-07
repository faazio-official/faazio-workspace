import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
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
  Check,
} from 'lucide-react-native';
import { hs, vs, ms, SCREEN_W } from '@/utils/responsive';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

interface Product {
  id: string;
  name: string;
  price: number;
  emoji?: string;
  rating?: number;
  desc?: string;
  app?: 'FOOD' | 'MART' | 'GROCERY' | 'PHARMA';
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

const avatarMap: Record<string, string> = {
  'Aarav Sharma': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=60&h=60',
  'Priya Patel': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=60&h=60',
  'Vikram Singh': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=60&h=60',
  'Rohan Mehra': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=60&h=60',
  'Ananya Rao': 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=60&h=60',
  'Kunal Kapoor': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=60&h=60',
  'Meera Nair': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=60&h=60',
  'Arjun Verma': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=60&h=60',
  'Dr. Sarah Alvi': 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=60&h=60',
  'Rajesh G.': 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&q=80&w=60&h=60',
};

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

  let reviews: { id: string; user: string; rating: number; comment: string; date: string }[] = [];
  if (detectedApp === 'FOOD') {
    reviews = [
      { id: 'rev-f1', user: 'Aarav Sharma', rating: 5, comment: 'Absolutely mouthwatering! Arrived piping hot, packaging was pristine. Definitely ordering again.', date: 'Today' },
      { id: 'rev-f2', user: 'Priya Patel', rating: 4, comment: 'Excellent flavor and rich taste. Portion size was very generous. Slightly spicy but incredible.', date: 'Yesterday' },
      { id: 'rev-f3', user: 'Vikram Singh', rating: 5, comment: 'Best biryani I have had in a long time! The aroma, the taste, everything was perfect. Highly recommend the Hyderabadi edition.', date: '3 days ago' }
    ];
  } else if (detectedApp === 'MART') {
    reviews = [
      { id: 'rev-m1', user: 'Rohan Mehra', rating: 5, comment: 'Premium build quality. Exceeded expectations! Sleek design and works flawlessly.', date: 'Yesterday' },
      { id: 'rev-m2', user: 'Ananya Rao', rating: 5, comment: 'Super fast delivery by Faazio. Item looks beautiful, absolute value for money.', date: '2 days ago' },
      { id: 'rev-m3', user: 'Kunal Kapoor', rating: 4, comment: 'Solid build. The product photos accurately represent what you get. Delivery was surprisingly quick.', date: '1 week ago' }
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

  let highlights: string[] = [];
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

const gradientConfig: Record<string, { stops: string[] }> = {
  FOOD: { stops: ['#047857', '#f0fdf4', 'white'] },
  MART: { stops: ['#1d4ed8', '#eff6ff', 'white'] },
  GROCERY: { stops: ['#15803d', '#f0fdf4', 'white'] },
  PHARMA: { stops: ['#0f766e', '#f0fdfa', 'white'] },
};

export default function ProductDetailView({
  product,
  onClose,
  addToCart,
  cartItems,
  updateCartQuantity,
  favorites = [],
  toggleFavorite,
}: ProductDetailViewProps) {
  const safeEmoji = product.emoji ?? '🛍️';
  const safeRating = product.rating ?? 4.5;
  const safeDesc = product.desc ?? 'Premium quality product';
  const safePrice = Number(product.price) || 0;

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
      bgColorGradient: '#eff6ff',
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

  const gradient = gradientConfig[app];

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
              <X size={ms(20)} color="#0f172a" strokeWidth={2.5} />
            </TouchableOpacity>

            <View style={styles.navBarRight}>
              <TouchableOpacity style={styles.navBtn} activeOpacity={0.8}>
                <Share2 size={ms(18)} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleToggleFavorite} style={styles.heartBtn} activeOpacity={0.8}>
                <Heart size={ms(18)} color={isFavorite ? '#f43f5e' : '#64748b'} fill={isFavorite ? '#f43f5e' : 'none'} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Scrollable Contents */}
          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

            {/* 1. Hero visual with backdrop gradient */}
            <View style={[styles.heroArea, { backgroundColor: brandStyles.bgColorGradient }]}>
              <Svg style={StyleSheet.absoluteFill}>
                <Defs>
                  <LinearGradient id="heroGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <Stop offset="10%" stopColor={gradient.stops[0]} stopOpacity={0.15} />
                    <Stop offset="10%" stopColor={gradient.stops[1]} />
                    <Stop offset="100%" stopColor={gradient.stops[2]} />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#heroGrad)" />
              </Svg>
              <View style={styles.emojiOuterRing}>
                <Text style={styles.emojiHero}>{safeEmoji}</Text>
                <View style={styles.ratingStarsOverlay}>
                  <Text style={styles.ratingStarsText}>★ {safeRating}</Text>
                </View>
              </View>

              <View style={styles.deliverySpeedTag}>
                <Truck size={ms(10)} color="#7CE045" style={{ marginRight: hs(4) }} />
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
                  <Text style={styles.priceValueText}>₹{safePrice.toLocaleString('en-IN')}</Text>
                  <Text style={styles.taxLabel}>Incl. of taxes</Text>
                </View>
              </View>

              <Text style={styles.productDescText}>{safeDesc}</Text>

              {/* Highlights list */}
              <View style={styles.highlightsContainer}>
                <Text style={styles.sectionHeadingText}>Key Highlights</Text>
                {highlights.map((hlt, idx) => (
                  <View key={idx} style={styles.highlightRow}>
                    <View style={styles.bulletCheckCircle}>
                      <Check size={ms(11)} strokeWidth={3.5} color="#059669" />
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
                  <ShieldCheck size={ms(14)} color="#059669" />
                  <View style={styles.guaranteeTextCol}>
                    <Text style={styles.guaranteeHeading}>Quality Verified</Text>
                    <Text style={styles.guaranteeSub}>100% genuine product</Text>
                  </View>
                </View>

                <View style={styles.guaranteeBox}>
                  <RotateCcw size={ms(14)} color="#2563eb" />
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
                <Info size={ms(11)} color="#94a3b8" style={{ marginRight: hs(6) }} />
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
                  <Text style={styles.reviewsAvgText}>★ {safeRating} Average</Text>
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
                          <Image source={{ uri: avatarMap[rev.user] }} style={{ width: ms(28), height: ms(28), borderRadius: ms(14) }} />
                          <View style={{ marginLeft: hs(8) }}>
                            <Text style={styles.reviewUserName}>{rev.user}</Text>
                            <Text style={styles.reviewUserDate}>{rev.date}</Text>
                          </View>
                        </View>
                        <View style={styles.starsRow}>
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} size={ms(8.5)} color={i < rev.rating ? '#f59e0b' : '#cbd5e1'} fill={i < rev.rating ? '#f59e0b' : 'none'} />
                          ))}
                        </View>
                      </View>

                      <Text style={styles.reviewComment}>"{rev.comment}"</Text>

                      <View style={styles.reviewFooterRow}>
                        <TouchableOpacity onPress={() => handleHelpfulToggle(rev.id)} style={[styles.helpfulBtn, liked ? styles.helpfulBtnLiked : null]} activeOpacity={0.8}>
                          <ThumbsUp size={ms(10)} color={liked ? '#10b981' : '#64748b'} fill={liked ? '#10b981' : 'none'} style={{ marginRight: hs(4) }} />
                          <Text style={[styles.helpfulText, liked ? { color: '#10b981' } : null]}>Helpful ({12 + (helpfulCounts[rev.id] || 0)})</Text>
                        </TouchableOpacity>

                        <View style={styles.verifiedPurchaseRow}>
                          <ShieldCheck size={ms(9)} color="#10b981" style={{ marginRight: hs(2) }} />
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
                ₹{(safePrice * (currentQuantity || 1)).toLocaleString('en-IN')}
              </Text>
            </View>

            {currentQuantity === 0 ? (
              <TouchableOpacity
                onPress={() => addToCart(product.id, product.name, safePrice, safeEmoji)}
                style={[styles.addToCartBtn, { backgroundColor: brandStyles.btnBg }]}
                activeOpacity={0.8}
              >
                <Plus size={ms(12)} color="#ffffff" strokeWidth={2.5} style={{ marginRight: hs(4) }} />
                <Text style={styles.addToCartBtnText}>Add to Bag</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.footerQuantityWidget}>
                <TouchableOpacity onPress={() => updateCartQuantity(product.id, -1)} style={styles.footerQtyBtn} activeOpacity={0.8}>
                  <Minus size={ms(14)} strokeWidth={3} color="#0f172a" />
                </TouchableOpacity>
                <Text style={styles.footerQtyValue}>{currentQuantity}</Text>
                <TouchableOpacity onPress={() => updateCartQuantity(product.id, 1)} style={styles.footerQtyBtn} activeOpacity={0.8}>
                  <Plus size={ms(14)} strokeWidth={3} color="#0f172a" />
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
    backgroundColor: '#f8fafc',
    width: '100%',
    height: '90%',
    borderTopLeftRadius: ms(36),
    borderTopRightRadius: ms(36),
    overflow: 'hidden',
    position: 'relative',
  },
  navBar: {
    position: 'absolute',
    top: vs(14),
    left: hs(16),
    right: hs(16),
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  navBarRight: {
    flexDirection: 'row',
    gap: hs(8),
  },
  navBtn: {
    width: ms(48),
    height: ms(48),
    borderRadius: ms(24),
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  heartBtn: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
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
    paddingBottom: vs(100),
  },
  heroArea: {
    height: vs(256),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  emojiOuterRing: {
    width: ms(160),
    height: ms(160),
    borderRadius: ms(80),
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
    fontSize: ms(64),
  },
  ratingStarsOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#FF7A59',
    borderRadius: ms(8),
    paddingVertical: vs(2),
    paddingHorizontal: hs(6),
  },
  ratingStarsText: {
    color: '#ffffff',
    fontSize: ms(7.5),
    fontWeight: '900',
  },
  deliverySpeedTag: {
    position: 'absolute',
    bottom: vs(12),
    left: hs(16),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingVertical: vs(4),
    paddingHorizontal: hs(10),
    borderRadius: ms(20),
  },
  deliverySpeedText: {
    color: '#ffffff',
    fontSize: ms(7),
    fontWeight: '900',
  },
  metaPaddingBox: {
    padding: hs(16),
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    marginBottom: vs(8),
  },
  appBadge: {
    borderWidth: 0.5,
    borderRadius: ms(6),
    paddingVertical: vs(2),
    paddingHorizontal: hs(6),
  },
  appBadgeText: {
    fontSize: ms(7.5),
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  catNameText: {
    fontSize: ms(8),
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  titlePriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: hs(16),
    marginBottom: vs(8),
  },
  productNameText: {
    fontSize: ms(20),
    fontWeight: '900',
    color: '#0f172a',
    flex: 1,
  },
  priceColumn: {
    alignItems: 'flex-end',
  },
  priceValueText: {
    fontSize: ms(24),
    fontWeight: '900',
    color: '#0f172a',
  },
  taxLabel: {
    fontSize: ms(7.5),
    fontWeight: '900',
    color: '#56B821',
    textTransform: 'uppercase',
    marginTop: vs(2),
  },
  productDescText: {
    fontSize: ms(11),
    color: '#64748b',
    fontWeight: '600',
    lineHeight: ms(16),
    marginBottom: vs(16),
  },
  highlightsContainer: {
    borderTopWidth: 0.5,
    borderTopColor: '#f1f5f9',
    paddingTop: vs(12),
    marginBottom: vs(16),
  },
  sectionHeadingText: {
    fontSize: ms(9.5),
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
    marginBottom: vs(8),
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: vs(6),
  },
  bulletCheckCircle: {
    width: ms(18),
    height: ms(18),
    borderRadius: ms(9),
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: hs(6),
    marginTop: vs(1),
  },
  highlightText: {
    fontSize: ms(9),
    color: '#475569',
    fontWeight: '600',
    flex: 1,
  },
  promoBanner: {
    backgroundColor: '#fffbeb',
    borderWidth: 0.5,
    borderColor: '#fef3c7',
    borderRadius: ms(14),
    padding: hs(10),
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: vs(16),
  },
  promoEmoji: {
    fontSize: ms(14),
    marginRight: hs(8),
  },
  promoContentCol: {
    flex: 1,
  },
  promoTitle: {
    fontSize: ms(8.5),
    fontWeight: '900',
    color: '#1e293b',
    textTransform: 'uppercase',
  },
  promoDesc: {
    fontSize: ms(7.5),
    color: '#64748b',
    fontWeight: '600',
    lineHeight: ms(11),
    marginTop: vs(2),
  },
  guaranteeGrid: {
    flexDirection: 'row',
    gap: hs(8),
  },
  guaranteeBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 0.5,
    borderColor: '#f1f5f9',
    borderRadius: ms(12),
    padding: hs(8),
    flexDirection: 'row',
    alignItems: 'center',
  },
  guaranteeTextCol: {
    marginLeft: hs(6),
    flex: 1,
  },
  guaranteeHeading: {
    fontSize: ms(8.5),
    fontWeight: '900',
    color: '#1e293b',
  },
  guaranteeSub: {
    fontSize: ms(7),
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: vs(1),
  },
  specificationsBox: {
    backgroundColor: '#ffffff',
    borderTopWidth: vs(8),
    borderTopColor: '#f8fafc',
    borderBottomWidth: vs(8),
    borderBottomColor: '#f8fafc',
    padding: hs(16),
  },
  specHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: vs(10),
  },
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: hs(8),
    justifyContent: 'space-between',
  },
  specCard: {
    width: '48%',
    backgroundColor: '#f8fafc',
    borderWidth: 0.5,
    borderColor: '#f1f5f9',
    borderRadius: ms(10),
    padding: hs(8),
  },
  specLabel: {
    fontSize: ms(7),
    color: '#94a3b8',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  specValue: {
    fontSize: ms(9),
    fontWeight: '900',
    color: '#334155',
    marginTop: vs(2),
  },
  reviewsBox: {
    backgroundColor: '#ffffff',
    padding: hs(16),
  },
  reviewsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(12),
  },
  reviewsAvgBadge: {
    backgroundColor: '#f8fafc',
    borderWidth: 0.5,
    borderColor: '#e2e8f0',
    paddingVertical: vs(2),
    paddingHorizontal: hs(8),
    borderRadius: ms(6),
  },
  reviewsAvgText: {
    fontSize: ms(8),
    color: '#1e293b',
    fontWeight: '900',
  },
  reviewProgressCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 0.5,
    borderColor: '#f1f5f9',
    padding: hs(10),
    borderRadius: ms(16),
    gap: vs(4),
    marginBottom: vs(16),
  },
  reviewProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
  },
  progressLabel: {
    width: hs(32),
    fontSize: ms(7.5),
    fontWeight: '900',
    color: '#64748b',
  },
  progressBarBg: {
    flex: 1,
    height: vs(6),
    backgroundColor: '#e2e8f0',
    borderRadius: ms(3),
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: ms(3),
  },
  progressPercent: {
    width: hs(24),
    fontSize: ms(7.5),
    fontWeight: '900',
    color: '#64748b',
    textAlign: 'right',
  },
  reviewsList: {
    width: '100%',
  },
  reviewRow: {
    paddingVertical: vs(12),
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
  reviewUserName: {
    fontSize: ms(9),
    fontWeight: '900',
    color: '#1e293b',
  },
  reviewUserDate: {
    fontSize: ms(7),
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: vs(1),
  },
  starsRow: {
    flexDirection: 'row',
    gap: hs(1),
  },
  reviewComment: {
    fontSize: ms(9),
    color: '#475569',
    fontWeight: '600',
    lineHeight: ms(13),
    marginTop: vs(8),
    paddingLeft: hs(36),
  },
  reviewFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: vs(8),
    paddingLeft: hs(36),
  },
  helpfulBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vs(2),
    paddingHorizontal: hs(6),
    borderRadius: ms(4),
  },
  helpfulBtnLiked: {
    backgroundColor: '#ecfdf5',
  },
  helpfulText: {
    fontSize: ms(7.5),
    color: '#94a3b8',
    fontWeight: '900',
  },
  verifiedPurchaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifiedPurchaseText: {
    fontSize: ms(7),
    color: '#94a3b8',
    fontWeight: '700',
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: vs(80),
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingHorizontal: hs(16),
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
    fontSize: ms(7),
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  footerPriceValue: {
    fontSize: ms(16),
    fontWeight: '900',
    color: '#0f172a',
    marginTop: vs(2),
  },
  addToCartBtn: {
    height: Math.max(44, vs(44)),
    paddingHorizontal: hs(24),
    borderRadius: ms(16),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addToCartBtnText: {
    color: '#ffffff',
    fontSize: ms(12),
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  footerQuantityWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: ms(12),
    padding: vs(3),
  },
  footerQtyBtn: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(12),
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerQtyValue: {
    fontSize: ms(11),
    fontWeight: '900',
    color: '#0f172a',
    marginHorizontal: hs(10),
    minWidth: ms(16),
    textAlign: 'center',
  },
});
