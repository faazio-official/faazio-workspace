import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Star } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import type { Product, StoreProfile, AppBrand } from '@data/types';
import type { VendorApp } from '@/services/categoryVendors';
import ProductRowCard from './ProductRowCard';

interface StoreProductSectionProps {
  app: VendorApp;
  store: StoreProfile;
  products: Product[];
  onStorePress: () => void;
  onProductPress: (product: Product) => void;
}

const brandFor = (app: VendorApp): AppBrand => (app === 'FA_MART' ? 'MART' : 'PHARMA');

/**
 * One store block on the category drill-in body: a tappable store-name heading
 * (rating · distance, no chevron) followed by a continuous vertical list of the
 * store's matching products as one-per-row horizontal cards. Store-derived, so
 * the heading opens the vendor page.
 */
const StoreProductSection = memo(function StoreProductSection({
  app,
  store,
  products,
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
        <AppText style={styles.storeName} numberOfLines={1}>{store.name}</AppText>
        <View style={styles.metaRow}>
          <Star size={ms(11)} color="#F59E0B" fill="#F59E0B" />
          <AppText style={styles.meta}>{store.rating} · {store.distance}</AppText>
        </View>
      </TouchableOpacity>

      <View style={styles.list}>
        {products.map((p) => (
          <ProductRowCard key={p.id} product={p} appBrand={appBrand} onPress={onProductPress} />
        ))}
      </View>
    </View>
  );
});

export default StoreProductSection;

const styles = StyleSheet.create({
  section: {
    marginTop: SPACE.SECTION,
  },
  header: {
    gap: vs(2),
    paddingHorizontal: hs(16),
    paddingBottom: SPACE.BLOCK,
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
  list: {
    paddingHorizontal: hs(16),
    gap: hs(10),
  },
});
