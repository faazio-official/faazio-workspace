import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { hs, vs, SCREEN_W } from '@/utils/responsive';
import PharmaProductCard from '@/features/pharma/cards/PharmaProductCard';
import type { Product } from '@data/types';

const CARD_WIDTH = SCREEN_W - hs(32);

interface SearchPharmaProductCardProps {
  product: Product;
  onPress?: (product: Product) => void;
}

/**
 * Pharma search result card wrapper. Owns the full-width list layout variant
 * for the shared Pharma card and runs onPress with the product. Lives under
 * components/ (not cards/) so it doesn't trip the dependency-cruiser card
 * boundary for cross-sub-app search.
 */
const SearchPharmaProductCard = memo(function SearchPharmaProductCard({
  product,
  onPress,
}: SearchPharmaProductCardProps) {
  return (
    <View style={styles.wrap}>
      <PharmaProductCard
        product={product}
        variant="stack"
        width={CARD_WIDTH}
        showDescription
        onPress={onPress ? () => onPress(product) : undefined}
      />
    </View>
  );
});

export default SearchPharmaProductCard;

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: hs(16),
    paddingTop: vs(2),
  },
});
