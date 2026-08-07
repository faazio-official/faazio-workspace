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

const MartProductCard = memo(function MartProductCard(props: Props) {
  return (
    <ProductCardBase
      {...props}
      product={props.product}
      appBrand="MART"
      variant="grid2"
      showRating
      showBadge
      showHeart={false}
    />
  );
});

export default MartProductCard;
