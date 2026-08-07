import React, { memo } from 'react';
import ProductCardBase from '@/components/shared/ProductCardBase';
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

const FoodProductCard = memo(function FoodProductCard(props: Props) {
  return (
    <ProductCardBase
      {...props}
      product={props.product}
      appBrand="FOOD"
      variant="grid2"
      showRating
      showBadge={false}
      showHeart={false}
    />
  );
});

export default FoodProductCard;
