import React, { memo } from 'react';
import ProductCardBase from '@/components/shared/ProductCardBase';
import type { Product } from '@data/types';
import type { CardVariant } from '@data/schema';

interface Props {
  product: Product;
  quantity?: number;
  isAdded?: boolean;
  onPress?: (product: Product) => void;
  onAdd?: (product: Product) => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
  variant?: Extract<CardVariant, 'grid2' | 'rail' | 'stack' | 'tile' | 'detail-row' | 'flash'>;
  roundedImageBottom?: boolean;
  showAdLabel?: boolean;
  showDescription?: boolean;
  originalPrice?: number;
  width?: number;
}

const FoodProductCard = memo(function FoodProductCard({
  variant = 'grid2',
  roundedImageBottom = true,
  showAdLabel = false,
  showDescription = false,
  ...props
}: Props) {
  return (
    <ProductCardBase
      {...props}
      product={props.product}
      appBrand="FOOD"
      variant={variant}
      showRating
      showBadge={false}
      showHeart={false}
      roundedImageBottom={roundedImageBottom}
      showAdLabel={showAdLabel}
      showDescription={showDescription}
    />
  );
});

export default FoodProductCard;
