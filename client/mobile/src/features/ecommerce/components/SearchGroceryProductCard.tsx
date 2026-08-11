import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { hs, vs, SCREEN_W } from '@/utils/responsive';
import GroceryProductCard from '@/features/ecommerce/cards/GroceryProductCard';
import type { Product } from '@data/types';

const CARD_WIDTH = SCREEN_W - hs(32);

interface SearchGroceryProductCardProps {
  product: Product;
  onPress?: (product: Product) => void;
}

/**
 * Grocery search result card wrapper. Owns the full-width list layout variant
 * for the shared Grocery card and runs onPress with the product. Lives under
 * components/ (not cards/) so it doesn't trip the dependency-cruiser card
 * boundary for cross-sub-app search.
 */
const SearchGroceryProductCard = memo(function SearchGroceryProductCard({
  product,
  onPress,
}: SearchGroceryProductCardProps) {
  return (
    <View style={styles.wrap}>
      <GroceryProductCard
        product={product}
        variant="stack"
        width={CARD_WIDTH}
        showDescription
        onPress={onPress ? () => onPress(product) : undefined}
      />
    </View>
  );
});

export default SearchGroceryProductCard;

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: hs(16),
    paddingTop: vs(2),
  },
});
