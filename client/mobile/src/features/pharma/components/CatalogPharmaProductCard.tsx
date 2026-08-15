import React, { memo } from 'react';
import { useCartProductActions } from '@/components/shared/hooks';
import type { Product } from '@data/types';
import PharmaProductCard from '@/features/pharma/cards/PharmaProductCard';

interface CatalogPharmaProductCardProps {
  product: Product;
  width?: number;
  onPress?: (product: Product) => void;
}

/**
 * Pharma grid card for the shared catalog node. Connects the shared cart store
 * (add/stepper) to the feature Pharma card without leaking store logic up.
 */
const CatalogPharmaProductCard = memo(function CatalogPharmaProductCard({
  product,
  width,
  onPress,
}: CatalogPharmaProductCardProps) {
  const cart = useCartProductActions(product);
  return (
    <PharmaProductCard
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

export default CatalogPharmaProductCard;
