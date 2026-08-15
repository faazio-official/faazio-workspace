import React, { memo } from 'react';
import { useCartProductActions } from '@/components/shared/hooks';
import type { Product } from '@data/types';
import MartProductCard from '@/features/ecommerce/cards/MartProductCard';

interface CatalogMartProductCardProps {
  product: Product;
  width?: number;
  onPress?: (product: Product) => void;
}

/**
 * Mart grid card for the shared catalog node. Connects the shared cart store
 * (add/stepper) to the feature Mart card without leaking store logic up.
 */
const CatalogMartProductCard = memo(function CatalogMartProductCard({
  product,
  width,
  onPress,
}: CatalogMartProductCardProps) {
  const cart = useCartProductActions(product);
  return (
    <MartProductCard
      product={product}
      width={width}
      variant="grid2"
      quantity={cart.quantity}
      isAdded={cart.isAdded}
      onAdd={cart.onAdd}
      onIncrement={cart.onIncrement}
      onDecrement={cart.onDecrement}
      onPress={onPress ? () => onPress(product) : undefined}
    />
  );
});

export default CatalogMartProductCard;
