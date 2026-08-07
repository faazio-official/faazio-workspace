import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import ProductCardBase from '@/components/shared/ProductCardBase';
import { formatRating } from '@/components/shared/format';
import type { Product } from '@data/types';

interface Props {
  product: Product;
  quantity?: number;
  isAdded?: boolean;
  onPress?: () => void;
  onAdd?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
}

const GroceryProductCard = memo(function GroceryProductCard(props: Props) {
  return (
    <View style={{ position: 'relative' }}>
      <ProductCardBase
        {...props}
        product={props.product}
        appBrand="GROCERY"
        variant="grid2"
        showRating={false}
        showBadge
        showHeart={false}
      />
    </View>
  );
});

export default GroceryProductCard;
