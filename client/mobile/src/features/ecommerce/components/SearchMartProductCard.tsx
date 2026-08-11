import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { hs, vs, SCREEN_W } from '@/utils/responsive';
import MartProductCard from '@/features/ecommerce/cards/MartProductCard';
import type { Product } from '@data/types';

const CARD_WIDTH = SCREEN_W - hs(32);

interface SearchMartProductCardProps {
  product: Product;
  onPress?: (product: Product) => void;
}

/**
 * Mart search result card wrapper. Owns the full-width list layout variant for
 * the shared Mart card and runs onPress with the product. Lives under
 * components/ (not cards/) so it doesn't trip the dependency-cruiser card
 * boundary for cross-sub-app search.
 */
const SearchMartProductCard = memo(function SearchMartProductCard({
  product,
  onPress,
}: SearchMartProductCardProps) {
  return (
    <View style={styles.wrap}>
      <MartProductCard
        product={product}
        variant="stack"
        width={CARD_WIDTH}
        showDescription
        onPress={onPress ? () => onPress(product) : undefined}
      />
    </View>
  );
});

export default SearchMartProductCard;

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: hs(16),
    paddingTop: vs(2),
  },
});
