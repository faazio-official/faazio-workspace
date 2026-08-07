import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { hs, vs, ms } from '@/utils/responsive';
import ProductCardBase from '@/components/shared/ProductCardBase';
import { useAddToCartFeedback } from './common';
import type { SectionProps } from './common';
import type { AppBrand, Product } from '@data/types';
import AppText from '@/components/AppText';

interface RecentlyViewedRailSectionProps extends SectionProps {
  title: string;
  products: Product[];
  accent: string;
  appBrand: AppBrand;
}

export default function RecentlyViewedRailSection({
  title, products, accent, appBrand,
  onProductClick, addToCart,
}: RecentlyViewedRailSectionProps) {
  const { addedId, handleAdd } = useAddToCartFeedback(addToCart);
  return (
    <>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <View style={[styles.dot, { backgroundColor: accent }]} />
          <AppText style={styles.title}>{title}</AppText>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {products.map((product) => (
          <ProductCardBase
            key={product.id}
            product={product}
            appBrand={appBrand}
            variant="rail"
            isAdded={addedId === product.id}
            onPress={() => onProductClick?.(product)}
            onAdd={() => handleAdd(product.id, product.name, product.price, product.emoji)}
          />
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    marginTop: vs(12),
    marginBottom: vs(8),
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: vs(6),
    height: vs(6),
    borderRadius: ms(3),
    marginRight: hs(6),
  },
  title: {
    fontSize: ms(17),
    fontWeight: '900',
    color: '#334155',
    letterSpacing: 0.3,
  },
  scroll: {
    paddingLeft: hs(16),
    paddingRight: hs(4),
    paddingBottom: vs(10),
  },
});
