import React, { memo } from 'react';
import MartProductCard from '@/features/ecommerce/cards/MartProductCard';
import FoodProductCard from '@/features/food/cards/FoodProductCard';
import GroceryProductCard from '@/features/ecommerce/cards/GroceryProductCard';
import PharmaProductCard from '@/features/pharma/cards/PharmaProductCard';
import type { Product } from '@data/types';

interface UniversalFeedCardProps {
  product: Product;
  quantity?: number;
  isAdded?: boolean;
  onPress?: () => void;
  onAdd?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
}

// Renders a product with its native brand card skin, dispatched by `product.app`.
// Same idea as SDUIRenderer.renderProductCard, but standalone for mixed feeds
// (Instant feed, Hair & Skin) that don't build full SDUINode trees.
const UniversalFeedCard = memo(function UniversalFeedCard(props: UniversalFeedCardProps) {
  switch (props.product.app) {
    case 'MART': return <MartProductCard {...props} />;
    case 'FOOD': return <FoodProductCard {...props} />;
    case 'GROCERY': return <GroceryProductCard {...props} />;
    case 'PHARMA': return <PharmaProductCard {...props} />;
    default: return <FoodProductCard {...props} />;
  }
});

export default UniversalFeedCard;
