import React, { memo } from 'react';
import { useCartProductActions } from '@/components/shared/hooks';
import type { Product } from '@data/types';
import GroceryProductCard from '@/features/ecommerce/cards/GroceryProductCard';

interface CatalogGroceryProductCardProps {
  product: Product;
  width?: number;
  onPress?: (product: Product) => void;
}

/**
 * Grocery grid card for the shared catalog node. Connects the shared cart store
 * (add/stepper) to the feature Grocery card without leaking store logic up.
 */
const CatalogGroceryProductCard = memo(function CatalogGroceryProductCard({
  product,
  width,
  onPress,
}: CatalogGroceryProductCardProps) {
  const cart = useCartProductActions(product);
  return (
    <GroceryProductCard
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

export default CatalogGroceryProductCard;
