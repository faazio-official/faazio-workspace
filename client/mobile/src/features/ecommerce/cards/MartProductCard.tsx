import React, { memo } from 'react';
import ProductCardBase from '@/components/shared/ProductCardBase';
import type { Product } from '@data/types';
import type { CardVariant } from '@data/schema';

interface Props {
  product: Product;
  quantity?: number;
  isAdded?: boolean;
  onPress?: () => void;
  onAdd?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
  variant?: Extract<CardVariant, 'grid2' | 'rail' | 'stack' | 'tile' | 'detail-row' | 'flash'>;
  roundedImageBottom?: boolean;
  showAdLabel?: boolean;
  showDescription?: boolean;
  originalPrice?: number;
  width?: number;
}

const MartProductCard = memo(function MartProductCard({
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
      appBrand="MART"
      variant={variant}
      showRating
      showBadge
      showHeart={false}
      roundedImageBottom={roundedImageBottom}
      showAdLabel={showAdLabel}
      showDescription={showDescription}
    />
  );
});

export default MartProductCard;
