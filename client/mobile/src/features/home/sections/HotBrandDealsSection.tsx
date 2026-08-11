import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { hotBrandDeals } from '@data/home/rails';
import MartProductCard from '@/features/ecommerce/cards/MartProductCard';
import { useAddToCartFeedback } from './common';
import type { SectionProps } from './common';
import AppText from '@/components/AppText';

const gridItems = hotBrandDeals.slice(0, 4);

function HotBrandDealsSection({ onProductClick, addToCart }: SectionProps) {
  const { addedId, handleAdd } = useAddToCartFeedback(addToCart);
  return (
    <View style={styles.gridContainer}>
      <AppText style={styles.containerTitle}>Hot Brand Deals</AppText>
      <View style={styles.grid}>
        {gridItems.map((product) => (
          <MartProductCard
            key={product.id}
            product={product}
            showAdLabel
            roundedImageBottom
            isAdded={addedId === product.id}
            onPress={() => onProductClick?.(product)}
            onAdd={() => handleAdd(product.id, product.name, product.price, product.emoji)}
          />
        ))}
      </View>
    </View>
  );
}

export default memo(HotBrandDealsSection);

const styles = StyleSheet.create({
  gridContainer: {
    marginHorizontal: hs(8),
    borderRadius: ms(16),
    backgroundColor: '#EDE9FE',
    padding: hs(10),
    marginTop: vs(14),
    marginBottom: vs(8),
  },
  containerTitle: {
    fontSize: ms(18),
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.3,
    marginBottom: vs(10),
    marginLeft: hs(2),
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});
