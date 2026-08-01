import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Image,
  TouchableOpacity, TextInput, Animated,
} from 'react-native';
import {
  Heart, CheckCircle, ShieldCheck, Search, Bell, ChevronLeft,
  Star, Minus, Plus, Sparkles, ClipboardList, Calendar, Clock,
  AlertCircle, Activity, MessageSquare,
} from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { hs, vs, ms, SCREEN_W } from '@/utils/responsive';
import PharmaProductCard from '@/components/shared/PharmaProductCard';

const ALL_CATEGORIES = [
  { id: 'vaccine', name: 'Vaccine', count: '250 products', icon: '💉' },
  { id: 'vitamin', name: 'Vitamine', count: '150 products', icon: '💊' },
  { id: 'supplements', name: 'Supplements', count: '300 products', icon: '🧴' },
  { id: 'fever', name: 'Fever', count: '67 products', icon: '🌡️' },
  { id: 'antiseptic', name: 'Antiseptic', count: '250 products', icon: '🧴' },
  { id: 'hypertension', name: 'Hypertension', count: '150 products', icon: '❤️' },
  { id: 'asthma', name: 'Asthma and Breathing', count: '300 products', icon: '🫁' },
  { id: 'diarrhea', name: 'Diarrhea', count: '87 products', icon: '💧' },
];

const PHARMA_PRODUCTS_DB = [
  { id: 'ph-t1', category: 'vitamin', name: 'Turmeric & Ginger Gummies', price: 810, originalPrice: 1250, discountBadge: '14% OFF', rating: 5, reviewsCount: 250, image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=400&h=400', emoji: '🍊', desc: 'With 270mg of curcumin extract per serving this powerful anti-oxidant treat will put you back in control of your body.', bullets: ['Turmeric 270mg', 'Ginger Extract 50mg', 'Vitamin C 30mg', 'Bioperine 5mg'] },
  { id: 'ph-t2', category: 'vitamin', name: 'Collagen Complex Gummies', price: 810, originalPrice: 1100, discountBadge: '15% OFF', rating: 4.8, reviewsCount: 140, image: 'https://images.unsplash.com/photo-1607619056574-7b8d304f2c38?auto=format&fit=crop&q=80&w=400&h=400', emoji: '💊', desc: 'Nourish your skin, hair, and nails from within. Formulated with premium hydrolyzed collagen peptides and active vitamins.', bullets: ['Hydrolyzed Collagen 500mg', 'Vitamin C 30mg', 'Biotin 300mcg', 'Vitamin E 15mg'] },
  { id: 'ph-t3', category: 'vitamin', name: 'Vitamin D3 2000 IU (60 Caps)', price: 450, originalPrice: 650, discountBadge: '30% OFF', rating: 4.7, reviewsCount: 310, image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=400&h=400', emoji: '☀️', desc: 'Supports bone health, immune function, and calcium absorption with premium Vitamin D3.', bullets: ['Vitamin D3 2000 IU', 'Calcium 100mg', 'Zinc 10mg', 'Olive Oil Base'] },
  { id: 'ph-t4', category: 'vitamin', name: 'Multivitamin Daily (90 Tabs)', price: 680, originalPrice: null, discountBadge: null, rating: 4.9, reviewsCount: 580, image: 'https://images.unsplash.com/photo-1607619056574-7b8d304f2c38?auto=format&fit=crop&q=80&w=400&h=400', emoji: '💊', desc: 'Complete daily nutrition with 23 essential vitamins and minerals for overall wellness.', bullets: ['23 Essential Vitamins', 'Iron 18mg', 'Vitamin B12 6mcg', 'Folic Acid 400mcg'] },
  { id: 'ph-f1', category: 'fever', name: 'Paracetamol 500mg (10 Tabs)', price: 45, originalPrice: null, discountBadge: null, rating: 4.9, reviewsCount: 890, image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=400&h=400', emoji: '💊', desc: 'Effective relief from fever and mild to moderate pain. Consult a physician before exceeding daily dose limitations.', bullets: ['Paracetamol 500mg', 'Lactose Free', 'Gluten Free', 'No Artificial Colors'] },
  { id: 'ph-f2', category: 'fever', name: 'Ibuprofen 400mg (15 Tabs)', price: 85, originalPrice: null, discountBadge: null, rating: 4.8, reviewsCount: 560, image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=400&h=400', emoji: '💊', desc: 'Fast-acting anti-inflammatory pain relief for headaches, muscle pain, and fever.', bullets: ['Ibuprofen 400mg', 'Anti-inflammatory', 'Fast Absorbing', 'Sugar Free'] },
  { id: 'ph-v1', category: 'vaccine', name: 'Flu Vaccine (Quadrivalent)', price: 1200, originalPrice: 1500, discountBadge: '20% OFF', rating: 4.8, reviewsCount: 120, image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=400&h=400', emoji: '💉', desc: 'Protect against four influenza virus strains with our preservative-free quadrivalent vaccine.', bullets: ['Quadrivalent Protection', 'Preservative Free', 'Single Dose', '18+ Years'] },
  { id: 'ph-a1', category: 'antiseptic', name: 'Antiseptic Cream 30g', price: 120, originalPrice: null, discountBadge: null, rating: 4.7, reviewsCount: 340, image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=400&h=400', emoji: '🧴', desc: 'Multi-purpose antiseptic cream for cuts, scrapes, and minor skin infections.', bullets: ['Antiseptic Formula', 'Soothing Aloe', 'Fast Healing', '3 year Shelf Life'] },
  { id: 'ph-h1', category: 'hypertension', name: 'Amlodipine 5mg (30 Tabs)', price: 180, originalPrice: 280, discountBadge: '35% OFF', rating: 4.6, reviewsCount: 230, image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=400&h=400', emoji: '❤️', desc: 'Calcium channel blocker for managing high blood pressure and coronary artery disease.', bullets: ['Amlodipine 5mg', 'BP Management', 'Heart Health', 'Prescription Required'] },
  { id: 'ph-as1', category: 'asthma', name: 'Salbutamol Inhaler 200 Doses', price: 350, originalPrice: 450, discountBadge: '22% OFF', rating: 4.8, reviewsCount: 410, image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=400&h=400', emoji: '🫁', desc: 'Fast-acting bronchodilator inhaler for relief of asthma symptoms and breathing difficulties.', bullets: ['Salbutamol 100mcg', '200 Doses', 'Mouthpiece Included', 'Prescription Required'] },
  { id: 'ph-d1', category: 'diarrhea', name: 'Oral Rehydration Salt (20 Sachets)', price: 75, originalPrice: null, discountBadge: null, rating: 4.9, reviewsCount: 670, image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=400&h=400', emoji: '💧', desc: 'WHO-recommended oral rehydration salts for rapid electrolyte replacement during diarrhea.', bullets: ['WHO Formula', 'Electrolyte Balance', 'Orange Flavor', 'Easy Mix'] },
  { id: 'ph-s1', category: 'supplements', name: 'Whey Protein Isolate 500g', price: 1299, originalPrice: 1699, discountBadge: '23% OFF', rating: 4.9, reviewsCount: 180, image: 'https://images.unsplash.com/photo-1593095948071-474c5cc2c1cf?auto=format&fit=crop&q=80&w=400&h=400', emoji: '💪', desc: 'Premium whey protein isolate with 27g protein per serving, zero sugar, and fast absorption.', bullets: ['27g Protein', 'Zero Sugar', 'BCAA 5.5g', 'Chocolate Flavor'] },
];

interface PharmaScreenProps {
  addToCart?: (id: string, name: string, price: number, emoji: string) => void;
  cartItems?: { id: string; name: string; price: number; quantity: number; emoji: string }[];
  setCartItems?: React.Dispatch<React.SetStateAction<{ id: string; name: string; price: number; quantity: number; emoji: string }[]>>;
  updateCartQuantity?: (id: string, delta: number) => void;
  onProductClick?: (product: any) => void;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

export function PharmaScreen({ addToCart, cartItems, setCartItems, updateCartQuantity, onProductClick, activeTab, setActiveTab }: PharmaScreenProps) {
  const [currentView, setCurrentView] = useState<'HOME' | 'ALL_CATEGORIES' | 'CATEGORY_PRODUCTS' | 'PRODUCT_DETAIL'>('HOME');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [addedAnimationId, setAddedAnimationId] = useState<string | null>(null);
  const [localFavorites, setLocalFavorites] = useState<string[]>(['ph-t1', 'ph-f1']);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const toggleLocalFavorite = (id: string) => {
    setLocalFavorites(prev =>
      prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
  };

  const handleAddWithFeedback = (id: string, name: string, price: number, emoji: string) => {
    if (addToCart) addToCart(id, name, price, emoji);
    setAddedAnimationId(id);
    setTimeout(() => setAddedAnimationId(null), 1200);
  };

  const handleAddMultipleToCart = (product: any, qty: number) => {
    if (setCartItems) {
      setCartItems((prev: any) => {
        const existing = prev.find((item: any) => item.id === product.id);
        if (existing) {
          return prev.map((item: any) =>
            item.id === product.id ? { ...item, quantity: item.quantity + qty } : item
          );
        }
        return [...prev, { id: product.id, name: product.name, price: product.price, quantity: qty, emoji: product.emoji }];
      });
    } else if (addToCart) {
      for (let i = 0; i < qty; i++) {
        addToCart(product.id, product.name, product.price, product.emoji);
      }
    }
  };

  const goBack = () => {
    if (currentView === 'PRODUCT_DETAIL') {
      setCurrentView(selectedCategoryId ? 'CATEGORY_PRODUCTS' : 'HOME');
    } else {
      setCurrentView('HOME');
    }
  };

  const popularProducts = PHARMA_PRODUCTS_DB.slice(0, 4);
  const forYouProducts = PHARMA_PRODUCTS_DB.filter(p => ['ph-t1', 'ph-t2', 'ph-t4', 'ph-f1', 'ph-f2'].includes(p.id));

  const renderStars = (rating: number, size: number = 10) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} size={ms(size)} color={i < Math.floor(rating) ? '#FF7A59' : '#E2E8F0'} fill={i < Math.floor(rating) ? '#FF7A59' : 'none'} strokeWidth={1.5} />
    ));
  };

  const homeView = (
    <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
      <View style={styles.headerGradient}>
        <Svg width={SCREEN_W} height={vs(260)} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="peachGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFF0E8" />
              <Stop offset="1" stopColor="#FFD5C8" />
            </LinearGradient>
          </Defs>
          <Rect width={SCREEN_W} height={vs(260)} fill="url(#peachGrad)" />
        </Svg>
        <View style={[styles.headerContent, { borderBottomLeftRadius: ms(42), borderBottomRightRadius: ms(42), overflow: 'hidden' }]}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarLeft}>
              <Image source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=88&h=88' }} style={styles.avatar} />
              <View>
                <Text style={styles.greetingText}>Hello,</Text>
                <Text style={styles.userName}>Camberline</Text>
              </View>
            </View>
            <View style={styles.bellWrapper}>
              <View style={styles.bellCircle}>
                <Bell size={ms(16)} color="#0f172a" strokeWidth={2} />
              </View>
              <View style={styles.bellDot} />
            </View>
          </View>

          <View style={styles.searchRow}>
            <Search size={ms(12)} color="#94a3b8" strokeWidth={2.5} />
            <TextInput style={styles.searchInput} placeholder="Search medicines..." placeholderTextColor="#94a3b8" />
          </View>

          <Text style={styles.bannerText}>Get exciting products today with 30% off</Text>

          <TouchableOpacity
            style={styles.shopNowBtn}
            onPress={() => { setSelectedCategoryId('vitamin'); setCurrentView('CATEGORY_PRODUCTS'); }}
            activeOpacity={0.8}
          >
            <Text style={styles.shopNowText}>Shop now</Text>
          </TouchableOpacity>

          <View style={styles.trustCard}>
            <View style={styles.trustRow}>
              <View style={styles.trustCircle}>
                <ShieldCheck size={ms(16)} color="#FF7A59" strokeWidth={2} />
              </View>
              <Text style={styles.trustText}> ✅ 100% Genuine | Free Delivery</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.dotsRow}>
        <View style={styles.dotActive} />
        <View style={styles.dotInactive} />
        <View style={styles.dotInactive} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Category</Text>
        <TouchableOpacity onPress={() => setCurrentView('ALL_CATEGORIES')}>
          <Text style={styles.viewAllText}>View all</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.categoryGrid}>
        {ALL_CATEGORIES.slice(0, 4).map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={styles.categoryCard}
            onPress={() => { setSelectedCategoryId(cat.id); setCurrentView('CATEGORY_PRODUCTS'); }}
            activeOpacity={0.8}
          >
            <View style={styles.categoryIconBox}>
              <Text style={styles.categoryIcon}>{cat.icon}</Text>
            </View>
            <Text style={styles.categoryName}>{cat.name}</Text>
            <Text style={styles.categoryCount}>{cat.count}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Popular Wellness Matches</Text>
      </View>

      <View style={styles.popularGrid}>
        {popularProducts.map(product => (
          <PharmaProductCard
            key={product.id}
            product={{ id: product.id, name: product.name, price: product.price, emoji: product.emoji, image: product.image, desc: product.desc, rating: product.rating, app: 'PHARMA', category: product.category }}
            originalPrice={product.originalPrice ?? undefined}
            isFavorite={localFavorites.includes(product.id)}
            isAdded={addedAnimationId === product.id}
            onPress={() => { setSelectedProduct(product); setCurrentView('PRODUCT_DETAIL'); }}
            onAdd={() => handleAddWithFeedback(product.id, product.name, product.price, product.emoji)}
            onFavorite={() => toggleLocalFavorite(product.id)}
          />
        ))}
      </View>

      <View style={{ height: vs(24) }} />
    </ScrollView>
  );

  const allCategoriesView = (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack} activeOpacity={0.8}>
          <ChevronLeft size={ms(16)} color="#0f172a" strokeWidth={3} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>CATEGORIES</Text>
        <View style={{ width: ms(32) }} />
      </View>
      <View style={styles.categoryGridFull}>
        {ALL_CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={styles.categoryCard}
            onPress={() => { setSelectedCategoryId(cat.id); setCurrentView('CATEGORY_PRODUCTS'); }}
            activeOpacity={0.8}
          >
            <View style={styles.categoryIconBox}>
              <Text style={styles.categoryIcon}>{cat.icon}</Text>
            </View>
            <Text style={styles.categoryName}>{cat.name}</Text>
            <Text style={styles.categoryCount}>{cat.count}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const filteredCategoryProducts = PHARMA_PRODUCTS_DB.filter(p =>
    p.category === selectedCategoryId &&
    (searchQuery === '' || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const categoryProductsView = (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack} activeOpacity={0.8}>
          <ChevronLeft size={ms(16)} color="#0f172a" strokeWidth={3} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>CATEGORIES</Text>
        <View style={{ width: ms(32) }} />
      </View>

      <View style={styles.searchFilter}>
        <Search size={ms(12)} color="#94a3b8" strokeWidth={2.5} />
        <TextInput
          style={styles.searchFilterInput}
          placeholder="Search products..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {filteredCategoryProducts.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <Text style={styles.emptyStateEmoji}>💊</Text>
          <Text style={styles.emptyStateTitle}>No products found</Text>
        </View>
      ) : (
        <View style={styles.catProductsGrid}>
          {filteredCategoryProducts.map(product => (
            <PharmaProductCard
              key={product.id}
              product={{ id: product.id, name: product.name, price: product.price, emoji: product.emoji, image: product.image, desc: product.desc, rating: product.rating, app: 'PHARMA', category: product.category, badge: product.discountBadge ?? undefined }}
              originalPrice={product.originalPrice ?? undefined}
              isAdded={addedAnimationId === product.id}
              onPress={() => { setSelectedProduct(product); setCurrentView('PRODUCT_DETAIL'); }}
              onAdd={() => handleAddWithFeedback(product.id, product.name, product.price, product.emoji)}
            />
          ))}
        </View>
      )}
      <View style={{ height: vs(24) }} />
    </ScrollView>
  );

  const productDetailView = selectedProduct && (
    <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
      <View style={styles.detailHero}>
        <Svg width={SCREEN_W} height={vs(320)} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="detailGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFF2EE" />
              <Stop offset="1" stopColor="#FFF7F4" />
            </LinearGradient>
          </Defs>
          <Rect width={SCREEN_W} height={vs(320)} fill="url(#detailGrad)" rx={ms(36)} />
        </Svg>
        <View style={styles.detailTopBar}>
          <TouchableOpacity style={styles.detailBackBtn} onPress={goBack} activeOpacity={0.8}>
            <ChevronLeft size={ms(16)} color="#ffffff" strokeWidth={3} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.detailHeartBtn} onPress={() => toggleLocalFavorite(selectedProduct.id)}>
            <Heart size={ms(14)} color={localFavorites.includes(selectedProduct.id) ? '#e11d48' : '#94a3b8'} fill={localFavorites.includes(selectedProduct.id) ? '#e11d48' : 'none'} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        <View style={styles.detailImageContainer}>
          <Image source={{ uri: selectedProduct.image }} style={styles.detailImage} />
        </View>
      </View>

      <View style={styles.detailContent}>
        <Text style={styles.detailName}>{selectedProduct.name}</Text>

        <View style={styles.detailStarsRow}>
          {renderStars(selectedProduct.rating, 12)}
          <Text style={styles.detailReviewCount}>({selectedProduct.reviewsCount} Reviews)</Text>
        </View>

        <View style={styles.quantityRow}>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => setQuantity(Math.max(1, quantity - 1))}
            activeOpacity={0.8}
          >
            <Minus size={ms(11)} color="#0f172a" strokeWidth={3} />
          </TouchableOpacity>
          <Text style={styles.qtyValue}>{quantity}</Text>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => setQuantity(quantity + 1)}
            activeOpacity={0.8}
          >
            <Plus size={ms(11)} color="#0f172a" strokeWidth={3} />
          </TouchableOpacity>
        </View>

        <Text style={styles.detailDesc}>{selectedProduct.desc}</Text>

        <View style={styles.bulletsContainer}>
          {selectedProduct.bullets?.map((bullet: string, idx: number) => (
            <View key={idx} style={styles.bulletRow}>
              <View style={styles.bulletCircle}>
                <CheckCircle size={ms(8)} color="#FF7A59" strokeWidth={4} />
              </View>
              <Text style={styles.bulletText}>{bullet}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalBar}>
          <View>
            <Text style={styles.totalLabel}>TOTAL AMOUNT</Text>
            <Text style={styles.totalAmount}>₹{selectedProduct.price * quantity}</Text>
          </View>
          <TouchableOpacity
            style={[styles.addToCartBtn, addedAnimationId === selectedProduct.id && styles.addToCartBtnAdded]}
            onPress={() => {
              handleAddMultipleToCart(selectedProduct, quantity);
              setAddedAnimationId(selectedProduct.id);
              setTimeout(() => setAddedAnimationId(null), 1200);
            }}
            activeOpacity={0.9}
          >
            <Text style={styles.addToCartBtnText}>
              {addedAnimationId === selectedProduct.id ? 'Added to Cart!' : 'Add to Cart'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: vs(24) }} />
    </ScrollView>
  );

  const forYouView = (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.forYouHeader}>
        <Sparkles size={ms(18)} color="#FF7A59" strokeWidth={2} />
        <Text style={styles.forYouTitle}>Just For You</Text>
        <Text style={styles.forYouSubtitle}>Curated picks based on your health profile</Text>
      </View>
      <View style={styles.forYouGrid}>
        {forYouProducts.map(product => (
          <PharmaProductCard
            key={product.id}
            product={{ id: product.id, name: product.name, price: product.price, emoji: product.emoji, image: product.image, desc: product.desc, rating: product.rating, app: 'PHARMA', category: product.category, badge: product.discountBadge ?? undefined }}
            originalPrice={product.originalPrice ?? undefined}
            isFavorite={localFavorites.includes(product.id)}
            isAdded={addedAnimationId === product.id}
            onPress={() => { setSelectedProduct(product); setCurrentView('PRODUCT_DETAIL'); setActiveTab?.('Home'); }}
            onAdd={() => handleAddWithFeedback(product.id, product.name, product.price, product.emoji)}
            onFavorite={() => toggleLocalFavorite(product.id)}
          />
        ))}
      </View>
      <View style={{ height: vs(24) }} />
    </ScrollView>
  );

  const historyView = (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.historyHeader}>
        <ClipboardList size={ms(18)} color="#FF7A59" strokeWidth={2} />
        <Text style={styles.historyTitle}>Medical History</Text>
        <Text style={styles.historySubtitle}>Your orders & consultations</Text>
      </View>

      <View style={styles.historyCard}>
        <Text style={styles.historyCardTitle}>Active Medicine Deliveries</Text>
        <View style={styles.historyCardRow}>
          <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
          <Text style={styles.historyMetaText}>ORD-93821</Text>
          <Text style={styles.historyMetaText}>₹90</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Scheduled Doctor Consultations</Text>
      </View>

      <View style={styles.historyCard}>
        <View style={styles.historyRow}>
          <View style={styles.historyBadgePillAmber}>
            <Text style={styles.historyBadgeText}>Upcoming</Text>
          </View>
          <Text style={styles.historyMetaText}>Cardiology - Dr. Mehta</Text>
        </View>
        <View style={styles.historyMeta}>
          <Calendar size={ms(9)} color="#94a3b8" strokeWidth={2} />
          <Text style={styles.historyMetaText}> 12 Aug 2026</Text>
          <Clock size={ms(9)} color="#94a3b8" strokeWidth={2} style={{ marginLeft: hs(8) }} />
          <Text style={styles.historyMetaText}> 10:30 AM</Text>
        </View>
      </View>

      <View style={styles.historyCard}>
        <View style={styles.historyRow}>
          <View style={styles.historyBadgePillGrey}>
            <Text style={styles.historyBadgeText}>Completed</Text>
          </View>
          <Text style={styles.historyMetaText}>General - Dr. Sharma</Text>
        </View>
        <View style={styles.historyMeta}>
          <Calendar size={ms(9)} color="#94a3b8" strokeWidth={2} />
          <Text style={styles.historyMetaText}> 28 Jul 2026</Text>
          <Clock size={ms(9)} color="#94a3b8" strokeWidth={2} style={{ marginLeft: hs(8) }} />
          <Text style={styles.historyMetaText}> 2:00 PM</Text>
        </View>
      </View>

      <View style={styles.historyDirectiveBox}>
        <Text style={styles.historyDirectiveText}>Consult a specialist for persistent symptoms. Your health records are up to date.</Text>
      </View>

      <View style={{ height: vs(24) }} />
    </ScrollView>
  );

  if (activeTab === 'For You') return forYouView;
  if (activeTab === 'History') return historyView;
  switch (currentView) {
    case 'HOME': return homeView;
    case 'ALL_CATEGORIES': return allCategoriesView;
    case 'CATEGORY_PRODUCTS': return categoryProductsView;
    case 'PRODUCT_DETAIL': return productDetailView;
    default: return homeView;
  }
}

const styles = StyleSheet.create({
  headerGradient: {
    overflow: 'hidden',
  },
  headerContent: {
    paddingHorizontal: hs(20),
    paddingTop: vs(48),
    paddingBottom: vs(20),
  },
  avatarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(16),
  },
  avatarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(12),
  },
  avatar: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
  },
  greetingText: {
    fontSize: ms(11),
    color: '#64748b',
    fontWeight: '600',
  },
  userName: {
    fontSize: ms(15),
    color: '#0f172a',
    fontWeight: '800',
    marginTop: vs(1),
  },
  bellWrapper: {
    position: 'relative',
  },
  bellCircle: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: ms(6),
    height: ms(6),
    borderRadius: ms(3),
    backgroundColor: '#E05B35',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: ms(20),
    paddingHorizontal: hs(14),
    height: vs(36),
    marginBottom: vs(16),
    gap: hs(8),
  },
  searchInput: {
    flex: 1,
    fontSize: ms(11),
    color: '#0f172a',
    fontWeight: '600',
    padding: 0,
  },
  bannerText: {
    fontSize: ms(21),
    fontWeight: '900',
    color: '#ffffff',
    lineHeight: vs(26),
    marginBottom: vs(12),
  },
  shopNowBtn: {
    backgroundColor: '#0f172a',
    paddingVertical: vs(10),
    paddingHorizontal: hs(24),
    borderRadius: ms(20),
    alignSelf: 'flex-start',
    marginBottom: vs(16),
  },
  shopNowText: {
    fontSize: ms(11),
    fontWeight: '900',
    color: '#ffffff',
  },
  trustCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: ms(16),
    paddingVertical: vs(10),
    paddingHorizontal: hs(14),
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
  },
  trustCircle: {
    width: ms(28),
    height: ms(28),
    borderRadius: ms(14),
    backgroundColor: '#FFF0E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustText: {
    fontSize: ms(10),
    fontWeight: '800',
    color: '#0f172a',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: hs(6),
    paddingVertical: vs(16),
  },
  dotActive: {
    width: ms(14),
    height: ms(6),
    borderRadius: ms(3),
    backgroundColor: '#FF7A59',
  },
  dotInactive: {
    width: ms(6),
    height: ms(6),
    borderRadius: ms(3),
    backgroundColor: '#E2E8F0',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: hs(20),
    marginBottom: vs(12),
  },
  sectionTitle: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#0f172a',
  },
  viewAllText: {
    fontSize: ms(11),
    fontWeight: '700',
    color: '#FF7A59',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: hs(16),
    gap: hs(12),
    marginBottom: vs(20),
  },
  categoryCard: {
    width: (SCREEN_W - hs(44)) / 2,
    backgroundColor: '#ffffff',
    borderRadius: ms(22),
    padding: hs(16),
    marginBottom: vs(4),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  categoryIconBox: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    borderWidth: 1,
    borderColor: '#FFEAE5',
    backgroundColor: '#FFF5F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(8),
  },
  categoryIcon: {
    fontSize: ms(18),
  },
  categoryName: {
    fontSize: ms(12),
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: vs(2),
  },
  categoryCount: {
    fontSize: ms(9),
    fontWeight: '600',
    color: '#94a3b8',
  },
  popularGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: hs(16),
    gap: hs(12),
  },
  productCard: {
    width: (SCREEN_W - hs(44)) / 2,
    backgroundColor: '#ffffff',
    borderRadius: ms(16),
    marginBottom: vs(12),
    paddingBottom: vs(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    position: 'relative',
  },
  productContentBlock: {
    paddingHorizontal: hs(10),
  },
  heartBtn: {
    position: 'absolute',
    top: hs(8),
    right: hs(8),
    zIndex: 10,
    backgroundColor: '#ffffff',
    width: ms(26),
    height: ms(26),
    borderRadius: ms(13),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  productImageBg: {
    backgroundColor: '#FFFBF9',
    borderRadius: ms(12),
    alignItems: 'center',
    justifyContent: 'center',
    height: vs(120),
    marginBottom: vs(8),
    overflow: 'hidden',
  },
  productImage: {
    width: '80%',
    height: '80%',
    resizeMode: 'contain',
  },
  productInfo: {
    gap: vs(4),
  },
  productName: {
    fontSize: ms(10),
    fontWeight: '900',
    color: '#0f172a',
    minHeight: vs(28),
  },
  productRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
  },
  productRating: {
    fontSize: ms(9),
    fontWeight: '800',
    color: '#64748b',
  },
  productPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: hs(10),
    marginTop: vs(6),
  },
  productPrice: {
    fontSize: ms(13),
    fontWeight: '900',
    color: '#0f172a',
  },
  productOriginalPrice: {
    fontSize: ms(9),
    fontWeight: '600',
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  addCircle: {
    width: ms(24),
    height: ms(24),
    borderRadius: ms(12),
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCircleAdded: {
    backgroundColor: '#059669',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingTop: vs(12),
    paddingBottom: vs(8),
  },
  backBtn: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  topTitle: {
    fontSize: ms(12),
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  categoryGridFull: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: hs(16),
    gap: hs(12),
    paddingTop: vs(8),
  },
  searchFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: ms(12),
    marginHorizontal: hs(16),
    paddingHorizontal: hs(12),
    height: vs(36),
    gap: hs(6),
    marginBottom: vs(12),
  },
  searchFilterInput: {
    flex: 1,
    fontSize: ms(10),
    color: '#0f172a',
    fontWeight: '600',
    padding: 0,
  },
  catProductsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: hs(16),
    gap: hs(12),
  },
  catProductCard: {
    width: (SCREEN_W - hs(44)) / 2,
    backgroundColor: '#ffffff',
    borderRadius: ms(16),
    marginBottom: vs(12),
    paddingBottom: vs(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  catProductContent: {
    paddingHorizontal: hs(10),
  },
  catProductImageBg: {
    backgroundColor: '#FFFBF9',
    borderRadius: ms(12),
    alignItems: 'center',
    justifyContent: 'center',
    height: vs(100),
    marginBottom: vs(8),
    overflow: 'hidden',
  },
  catProductImage: {
    width: '80%',
    height: '80%',
    resizeMode: 'contain',
  },
  catProductName: {
    fontSize: ms(10),
    fontWeight: '900',
    color: '#0f172a',
    minHeight: vs(28),
  },
  emptyStateCard: {
    marginHorizontal: hs(20),
    backgroundColor: '#ffffff',
    borderRadius: ms(20),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: hs(40),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  emptyStateEmoji: {
    fontSize: ms(32),
    marginBottom: vs(8),
  },
  emptyStateTitle: {
    fontSize: ms(12),
    fontWeight: '900',
    color: '#64748b',
  },
  detailHero: {
    height: vs(320),
    position: 'relative',
  },
  detailTopBar: {
    position: 'absolute',
    top: vs(48),
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: hs(20),
  },
  detailBackBtn: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailHeartBtn: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailImageContainer: {
    position: 'absolute',
    top: vs(80),
    left: 0,
    right: 0,
    alignItems: 'center',
    height: vs(192),
    justifyContent: 'center',
  },
  detailImage: {
    width: ms(192),
    height: ms(192),
    resizeMode: 'contain',
  },
  detailContent: {
    paddingHorizontal: hs(20),
    paddingTop: vs(16),
  },
  detailName: {
    fontSize: ms(18),
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: vs(8),
  },
  detailStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    marginBottom: vs(16),
  },
  detailReviewCount: {
    fontSize: ms(10),
    fontWeight: '600',
    color: '#94a3b8',
    marginLeft: hs(4),
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(12),
    marginBottom: vs(16),
  },
  qtyBtn: {
    width: ms(30),
    height: ms(30),
    borderRadius: ms(15),
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  qtyValue: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#0f172a',
    minWidth: ms(24),
    textAlign: 'center',
  },
  detailDesc: {
    fontSize: ms(11),
    fontWeight: '600',
    color: '#64748b',
    lineHeight: vs(16),
    marginBottom: vs(16),
  },
  bulletsContainer: {
    gap: vs(10),
    marginBottom: vs(20),
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
  },
  bulletCircle: {
    width: ms(16),
    height: ms(16),
    borderRadius: ms(8),
    backgroundColor: '#FFEAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletText: {
    fontSize: ms(11),
    fontWeight: '700',
    color: '#334155',
  },
  totalBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: vs(16),
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: hs(12),
  },
  totalLabel: {
    fontSize: ms(9),
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  totalAmount: {
    fontSize: ms(16),
    fontWeight: '900',
    color: '#0f172a',
    marginTop: vs(2),
  },
  addToCartBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
    height: vs(44),
    borderRadius: ms(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  addToCartBtnAdded: {
    backgroundColor: '#059669',
  },
  addToCartBtnText: {
    fontSize: ms(11),
    fontWeight: '900',
    color: '#ffffff',
  },
  forYouHeader: {
    paddingHorizontal: hs(20),
    paddingTop: vs(16),
    paddingBottom: vs(12),
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: hs(8),
  },
  forYouTitle: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#0f172a',
  },
  forYouSubtitle: {
    fontSize: ms(9.5),
    fontWeight: '600',
    color: '#94a3b8',
    width: '100%',
    marginTop: vs(4),
  },
  forYouGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: hs(16),
    gap: hs(12),
  },
  forYouBadge: {
    position: 'absolute',
    top: hs(8),
    left: hs(8),
    zIndex: 10,
    backgroundColor: '#E05B35',
    paddingVertical: vs(3),
    paddingHorizontal: hs(6),
    borderRadius: ms(6),
  },
  forYouBadgeText: {
    fontSize: ms(8),
    fontWeight: '900',
    color: '#ffffff',
  },
  historyHeader: {
    paddingHorizontal: hs(20),
    paddingTop: vs(16),
    paddingBottom: vs(12),
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: hs(8),
  },
  historyTitle: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#0f172a',
  },
  historySubtitle: {
    fontSize: ms(9.5),
    fontWeight: '600',
    color: '#94a3b8',
    width: '100%',
    marginTop: vs(4),
  },
  historyCard: {
    marginHorizontal: hs(20),
    backgroundColor: '#ffffff',
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: hs(16),
    marginBottom: vs(12),
  },
  historyCardTitle: {
    fontSize: ms(12),
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: vs(8),
  },
  historyCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
  },
  pulseDot: {
    width: ms(8),
    height: ms(8),
    borderRadius: ms(4),
    backgroundColor: '#059669',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    marginBottom: vs(8),
  },
  historyBadgePillAmber: {
    backgroundColor: '#fef3c7',
    paddingVertical: vs(2),
    paddingHorizontal: hs(8),
    borderRadius: ms(4),
  },
  historyBadgePillGrey: {
    backgroundColor: '#f1f5f9',
    paddingVertical: vs(2),
    paddingHorizontal: hs(8),
    borderRadius: ms(4),
  },
  historyBadgeText: {
    fontSize: ms(8),
    fontWeight: '900',
    color: '#92400e',
  },
  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyMetaText: {
    fontSize: ms(9),
    fontWeight: '600',
    color: '#64748b',
  },
  historyDirectiveBox: {
    marginHorizontal: hs(20),
    backgroundColor: '#f8fafc',
    borderRadius: ms(12),
    padding: hs(14),
    marginBottom: vs(12),
  },
  historyDirectiveText: {
    fontSize: ms(9),
    fontWeight: '600',
    color: '#94a3b8',
    lineHeight: vs(13),
  },
});
