import React, { memo } from 'react';
import ProductCardBase from '@/components/shared/ProductCardBase';
import type { Product } from '@data/types';

interface Props {
  product: Product;
  quantity?: number;
  isAdded?: boolean;
  isFavorite?: boolean;
  originalPrice?: number;
  onPress?: () => void;
  onAdd?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onFavorite?: () => void;
}

const PharmaProductCard = memo(function PharmaProductCard(props: Props) {
  return (
    <ProductCardBase
      {...props}
      product={props.product}
      appBrand="PHARMA"
      variant="grid2"
      showRating
      showBadge
      showHeart
    />
  );
});

export default PharmaProductCard;
