import React, { memo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import UniversalFeedCard from '@/features/home/cards/UniversalFeedCard';
import { useAddToCartFeedback, usePricedProducts } from './common';
import type { SectionProps } from './common';
import type { AppBrand, Product } from '@data/types';
import AppText from '@/components/AppText';

interface RecentlyViewedRailSectionProps extends SectionProps {
  title: string;
  products: Product[];
  accent: string;
  appBrand: AppBrand;
}

function RecentlyViewedRailSection({
  title, products, accent, appBrand,
  onProductClick, addToCart,
}: RecentlyViewedRailSectionProps) {
  const { addedId, handleAdd } = useAddToCartFeedback(addToCart);
  const priced = usePricedProducts(products);
  return (
    <>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <View style={[styles.dot, { backgroundColor: accent }]} />
          <AppText style={styles.title}>{title}</AppText>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {priced.map((product) => (
          <UniversalFeedCard
            key={product.id}
            product={product}
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

export default memo(RecentlyViewedRailSection);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    marginTop: SPACE.SECTION,
    marginBottom: SPACE.BLOCK,
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
    paddingBottom: SPACE.BLOCK,
  },
});
