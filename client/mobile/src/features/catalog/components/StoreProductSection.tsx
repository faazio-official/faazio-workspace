import React, { memo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ChevronRight, Star } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import ProductCardBase from '@/components/shared/ProductCardBase';
import AdBannerCarousel from '@/components/shared/AdBannerCarousel';
import { useCartProductActions } from '@/components/shared/hooks';
import type { Product, StoreProfile, AppBrand } from '@data/types';
import type { VendorApp, VendorAdSlide } from '@/services/categoryVendors';

interface StoreProductSectionProps {
  app: VendorApp;
  store: StoreProfile;
  products: Product[];
  ads: VendorAdSlide[];
  accent: string;
  onStorePress: () => void;
  onProductPress: (product: Product) => void;
}

const brandFor = (app: VendorApp): AppBrand => (app === 'FA_MART' ? 'MART' : 'PHARMA');

/** One product card in the store rail — owns its own cart wiring. */
const RailProductCard = memo(function RailProductCard({
  product,
  appBrand,
  onPress,
}: {
  product: Product;
  appBrand: AppBrand;
  onPress: (product: Product) => void;
}) {
  const cart = useCartProductActions(product);
  return (
    <ProductCardBase
      product={product}
      appBrand={appBrand}
      variant="rail"
      quantity={cart.quantity}
      isAdded={cart.isAdded}
      onAdd={cart.onAdd}
      onIncrement={cart.onIncrement}
      onDecrement={cart.onDecrement}
      onPress={onPress}
    />
  );
});

/**
 * One store block on the category drill-in body: a big tappable store-name
 * heading, a horizontal rail of the store's matching products, then a 16:9
 * store ad (AD-labelled) directly below the rail. Store-derived, so the heading
 * and the ad both open the same vendor page.
 */
const StoreProductSection = memo(function StoreProductSection({
  app,
  store,
  products,
  ads,
  accent,
  onStorePress,
  onProductPress,
}: StoreProductSectionProps) {
  const appBrand = brandFor(app);

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.header}
        onPress={onStorePress}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={store.name}
      >
        <View style={styles.headerText}>
          <AppText style={styles.storeName} numberOfLines={1}>{store.name}</AppText>
          <View style={styles.metaRow}>
            <Star size={ms(11)} color="#F59E0B" fill="#F59E0B" />
            <AppText style={styles.meta}>{store.rating} · {store.distance}</AppText>
          </View>
        </View>
        <View style={[styles.arrow, { backgroundColor: accent }]}>
          <ChevronRight size={ms(15)} color="#FFFFFF" strokeWidth={2.5} />
        </View>
      </TouchableOpacity>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railContent}
      >
        {products.map((p) => (
          <RailProductCard key={p.id} product={p} appBrand={appBrand} onPress={onProductPress} />
        ))}
      </ScrollView>

      {ads.length > 0 && (
        <AdBannerCarousel
          slides={ads}
          showAdLabel
          onSlidePress={onStorePress}
          style={styles.ad}
        />
      )}
    </View>
  );
});

export default StoreProductSection;

const styles = StyleSheet.create({
  section: {
    marginTop: SPACE.SECTION,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    paddingHorizontal: hs(16),
    paddingBottom: SPACE.BLOCK,
  },
  headerText: {
    flex: 1,
    gap: vs(2),
  },
  storeName: {
    fontSize: ms(17),
    fontWeight: '900',
    color: '#1E2022',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
  },
  meta: {
    fontSize: ms(10),
    fontWeight: '600',
    color: '#64748b',
  },
  arrow: {
    width: ms(28),
    height: ms(28),
    borderRadius: ms(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  railContent: {
    paddingHorizontal: hs(16),
  },
  ad: {
    marginHorizontal: hs(16),
    marginTop: SPACE.BLOCK,
  },
});
