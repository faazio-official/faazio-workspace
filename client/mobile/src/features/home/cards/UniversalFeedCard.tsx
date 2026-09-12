import React, { memo } from 'react';
import MartProductCard from '@/features/ecommerce/cards/MartProductCard';
import FoodProductCard from '@/features/food/cards/FoodProductCard';
import PharmaProductCard from '@/features/pharma/cards/PharmaProductCard';
import type { Product } from '@data/types';
import type { CardVariant } from '@data/schema';

interface UniversalFeedCardProps {
  product: Product;
  quantity?: number;
  isAdded?: boolean;
  isFavorite?: boolean;
  onPress?: (product: Product) => void;
  onAdd?: (product: Product) => void;
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

// Renders a product with its native brand card skin, dispatched by `product.app`.
// Same idea as SDUIRenderer.renderProductCard, but standalone for mixed feeds
// (Instant feed, Hair & Skin) that don't build full SDUINode trees.
const UniversalFeedCard = memo(function UniversalFeedCard(props: UniversalFeedCardProps) {
  switch (props.product.app) {
    case 'MART': return <MartProductCard {...props} />;
    case 'FOOD': return <FoodProductCard {...props} />;
    case 'PHARMA': return <PharmaProductCard {...props} />;
    default: return <FoodProductCard {...props} />;
  }
});

export default UniversalFeedCard;
