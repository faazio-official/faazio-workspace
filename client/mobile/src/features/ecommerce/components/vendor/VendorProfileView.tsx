import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { ArrowLeft, MapPin, ShieldCheck, ShoppingCart } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '@/components/AppText';
import MartImage from '../mart-home/MartImage';
import MartProductCard from '@/features/ecommerce/cards/MartProductCard';
import { hs, ms, vs } from '@/utils/responsive';
import type { CartItem } from '@/state/cartStore';
import type { StoreProfile } from '@data/types';
import type { MartProduct } from '@data/types';
import VendorHighlights from './VendorHighlights';
import VendorCategoryChips from './VendorCategoryChips';
import { VENDOR_YELLOW, GREEN, TEXT_DARK, TEXT_LIGHT } from './theme';

const SCREEN_W = Dimensions.get('window').width;
const CARD_GAP = hs(12);
const CARD_W = (SCREEN_W - hs(32) - CARD_GAP) / 2;
const CARD_W_RAIL = hs(150);

interface VendorProfileViewProps {
  vendor: StoreProfile;
  products: MartProduct[];
  discountedProducts: MartProduct[];
  cartItems: CartItem[];
  onBack: () => void;
  onProductClick?: (product: MartProduct) => void;
  onAddToCart: (product: MartProduct) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onCartPress?: () => void;
}

const ALL = 'All';

export function VendorProfileView({
  vendor,
  products,
  discountedProducts,
  cartItems,
  onBack,
  onProductClick,
  onAddToCart,
  onUpdateQuantity,
  onCartPress,
}: VendorProfileViewProps) {
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState<string>(ALL);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return [ALL, ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(
    () =>
      activeCategory === ALL
        ? products
        : products.filter((p) => p.category === activeCategory),
    [products, activeCategory],
  );

  const totalQty = useMemo(
    () => cartItems.reduce((acc, c) => acc + c.quantity, 0),
    [cartItems],
  );

  const qtyOf = (id: string) => cartItems.find((c) => c.id === id)?.quantity ?? 0;

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + vs(4) }]}>
        <TouchableOpacity onPress={onBack} style={styles.topBarBtn} activeOpacity={0.8} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft size={ms(20)} color="#1E2022" strokeWidth={2.6} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onCartPress} style={styles.topBarBtn} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ShoppingCart size={ms(20)} color="#1E2022" strokeWidth={2.4} />
          {totalQty > 0 ? (
            <View style={styles.cartBadge}>
              <AppText style={styles.cartBadgeText}>{totalQty}</AppText>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.board}>
          <View style={styles.storeInfoRow}>
            <View style={styles.logoContainer}>
              <MartImage uri={vendor.coverImage} style={styles.storeLogo} />
              <View style={styles.ratingBadge}>
                <AppText style={styles.ratingText}>{vendor.rating}</AppText>
              </View>
            </View>
            <View style={styles.storeDetails}>
              <View style={styles.storeNameRow}>
                <AppText style={styles.storeName} numberOfLines={1}>
                  {vendor.name}
                </AppText>
                <ShieldCheck size={ms(16)} color="#3B82F6" fill="#DBEAFE" />
              </View>
              <AppText style={styles.storeSub}>Your Local Store</AppText>
              <View style={styles.locationRow}>
                <MapPin size={ms(14)} color={TEXT_LIGHT} />
                <AppText style={styles.locationText}>
                  Anna Nagar, Chennai · {vendor.distance} away
                </AppText>
              </View>
              <View style={styles.timeRow}>
                <View style={styles.openBadge}>
                  <AppText style={styles.openText}>Open now</AppText>
                </View>
                <AppText style={styles.closeText}> · Closes at 10:00 PM</AppText>
              </View>
            </View>
          </View>

          <VendorHighlights />

          <View style={styles.sectionHeader}>
            <AppText style={styles.sectionTitle}>Discounted Products</AppText>
            <AppText style={styles.seeAllText}>View All {'>'}</AppText>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.discountScroll}
          >
            {discountedProducts.map((p) => {
              const qty = qtyOf(p.id);
              return (
                <MartProductCard
                  key={p.id}
                  product={p}
                  originalPrice={p.originalPrice}
                  variant="rail"
                  width={CARD_W_RAIL}
                  showDescription
                  quantity={qty}
                  isAdded={qty > 0}
                  onPress={() => onProductClick?.(p)}
                  onAdd={() => onAddToCart(p)}
                  onIncrement={() => onUpdateQuantity(p.id, 1)}
                  onDecrement={() => onUpdateQuantity(p.id, -1)}
                />
              );
            })}
          </ScrollView>

          <View style={[styles.sectionHeader, styles.allProductsHeader]}>
            <AppText style={styles.sectionTitle}>All Products</AppText>
            <AppText style={styles.seeAllText}>{filteredProducts.length} items</AppText>
          </View>

          <VendorCategoryChips categories={categories} active={activeCategory} onSelect={setActiveCategory} />

          <View style={styles.productGrid}>
            {filteredProducts.map((p) => {
              const qty = qtyOf(p.id);
              return (
                <MartProductCard
                  key={p.id}
                  product={p}
                  width={CARD_W}
                  quantity={qty}
                  isAdded={qty > 0}
                  onPress={() => onProductClick?.(p)}
                  onAdd={() => onAddToCart(p)}
                  onIncrement={() => onUpdateQuantity(p.id, 1)}
                  onDecrement={() => onUpdateQuantity(p.id, -1)}
                />
              );
            })}
            {filteredProducts.length === 0 ? (
              <View style={styles.emptyWrap}>
                <AppText style={styles.emptyText}>No products in this category.</AppText>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export default VendorProfileView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    paddingBottom: vs(8),
    backgroundColor: '#fff',
  },
  topBarBtn: {
    width: ms(38),
    height: ms(38),
    borderRadius: ms(19),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: vs(-4),
    right: hs(-4),
    backgroundColor: '#1E2022',
    borderRadius: ms(8),
    minWidth: ms(16),
    height: ms(16),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(3),
  },
  cartBadgeText: {
    fontSize: ms(9),
    fontWeight: '900',
    color: '#fff',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: vs(32),
  },
  board: {
    backgroundColor: '#fff',
    borderTopLeftRadius: ms(24),
    borderTopRightRadius: ms(24),
    paddingTop: vs(12),
  },
  storeInfoRow: {
    flexDirection: 'row',
    paddingHorizontal: hs(16),
    marginBottom: vs(20),
    alignItems: 'flex-start',
  },
  logoContainer: {
    position: 'relative',
    marginRight: hs(12),
  },
  storeLogo: {
    width: ms(64),
    height: ms(64),
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#eee',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: vs(-8),
    alignSelf: 'center',
    backgroundColor: GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: hs(6),
    paddingVertical: vs(2),
    borderRadius: ms(8),
  },
  ratingText: {
    color: '#fff',
    fontSize: ms(10),
    fontWeight: '800',
  },
  storeDetails: {
    flex: 1,
  },
  storeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
  },
  storeName: {
    fontSize: ms(18),
    fontWeight: '700',
    color: TEXT_DARK,
    flexShrink: 1,
  },
  storeSub: {
    fontSize: ms(12),
    color: TEXT_LIGHT,
    marginTop: vs(2),
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(6),
  },
  locationText: {
    fontSize: ms(12),
    color: TEXT_DARK,
    marginLeft: hs(4),
    flexShrink: 1,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(4),
  },
  openBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: hs(6),
    paddingVertical: vs(2),
    borderRadius: ms(4),
  },
  openText: {
    color: GREEN,
    fontSize: ms(10),
    fontWeight: '600',
  },
  closeText: {
    fontSize: ms(12),
    color: TEXT_LIGHT,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    marginBottom: vs(12),
  },
  allProductsHeader: {
    marginTop: vs(20),
  },
  sectionTitle: {
    fontSize: ms(16),
    fontWeight: '700',
    color: TEXT_DARK,
  },
  seeAllText: {
    fontSize: ms(12),
    color: '#B45309',
    fontWeight: '700',
  },
  discountScroll: {
    paddingLeft: hs(16),
    paddingRight: hs(8),
    paddingBottom: vs(4),
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingTop: vs(16),
    width: '100%',
  },
  emptyWrap: {
    paddingVertical: vs(40),
    alignItems: 'center',
  },
  emptyText: {
    fontSize: ms(13),
    color: TEXT_LIGHT,
  },
});
