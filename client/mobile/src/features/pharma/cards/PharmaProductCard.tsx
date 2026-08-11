import React, { memo } from 'react';
import ProductCardBase from '@/components/shared/ProductCardBase';
import type { Product } from '@data/types';
import type { CardVariant } from '@data/schema';

interface Props {
  product: Product;
  quantity?: number;
  isAdded?: boolean;
  isFavorite?: boolean;
  onPress?: () => void;
  onAdd?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onFavorite?: () => void;
  variant?: Extract<CardVariant, 'grid2' | 'rail' | 'stack' | 'tile' | 'detail-row' | 'flash'>;
  roundedImageBottom?: boolean;
  showAdLabel?: boolean;
  showDescription?: boolean;
  originalPrice?: number;
  width?: number;
}

const PharmaProductCard = memo(function PharmaProductCard({
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
      appBrand="PHARMA"
      variant={variant}
      showRating
      showBadge
      showHeart
      roundedImageBottom={roundedImageBottom}
      showAdLabel={showAdLabel}
      showDescription={showDescription}
    />
  );
});

export default PharmaProductCard;
