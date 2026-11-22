import React, { memo, useCallback, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import AppText from '@/components/AppText';
import { useCategoryVendors } from '@/features/catalog/hooks/useCategoryVendors';
import StoreProductSection from './StoreProductSection';
import type { Product } from '@data/types';
import type { VendorApp } from '@/services/categoryVendors';
import { SPACE } from '@/theme/spacing';
import { hs, ms, vs } from '@/utils/responsive';

interface SubCategorySectionProps {
  item: { id: string; name: string; searchQuery: string };
  app: VendorApp;
  searchQuery: string;
  onVendorPress: (storeId: string, query: string) => void;
  onProductPress: (product: Product) => void;
  /** Called with the y offset of the title for scroll‑to support. */
  onLayout: (id: string, y: number) => void;
}

const SubCategorySection = memo(function SubCategorySection({
  item,
  app,
  searchQuery,
  onVendorPress,
  onProductPress,
  onLayout,
}: SubCategorySectionProps) {
  const { vendors, loading, failed, refreshing, refresh } = useCategoryVendors(app, item.searchQuery);

  const filtered = useMemo(() => {
    if (!searchQuery) return vendors;
    const q = searchQuery.trim().toLowerCase();
    return vendors.filter(({ store }) => {
      const hay = `${store.name} ${store.address ?? ''} ${store.distance}`.toLowerCase();
      return hay.includes(q);
    });
  }, [vendors, searchQuery]);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const y = e.nativeEvent.layout.y;
      onLayout(item.id, y);
    },
    [item.id, onLayout],
  );

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <AppText style={styles.title}>{item.name}</AppText>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : failed ? (
        <AppText style={styles.error}>Couldn't load this section.</AppText>
      ) : (
        filtered.map((v) => (
          <StoreProductSection
            key={v.store.id}
            app={app}
            store={v.store}
            products={v.products}
            onStorePress={() => onVendorPress(v.store.id, item.searchQuery)}
            onProductPress={onProductPress}
          />
        ))
      )}
    </View>
  );
});

export default SubCategorySection;

const styles = StyleSheet.create({
  container: {
    marginTop: SPACE.SECTION,
  },
  title: {
    fontSize: ms(17),
    fontWeight: '900',
    color: '#1E2022',
    marginHorizontal: hs(16),
    marginBottom: vs(4),
  },
  center: {
    alignItems: 'center',
    paddingVertical: vs(20),
  },
  error: {
    fontSize: ms(13),
    color: '#64748b',
    marginHorizontal: hs(16),
  },
});