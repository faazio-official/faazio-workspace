import React, { memo } from 'react';
import SearchProductCard from '@/components/shared/SearchProductCard';
import { useCartProductActions } from '@/components/shared/hooks';
import type { Product } from '@data/types';

interface SearchMartProductCardProps {
  product: Product;
  columnIndex?: number;
  onPress?: (product: Product) => void;
}

/**
 * Mart search result card wrapper. Renders the dense e-commerce grid card
 * (square contain image, discount/MRP pricing, full-width Add to Cart) and runs
 * onPress with the product. Wires the shared cart store so results can be added
 * straight from search. Lives under components/ (not cards/) so it doesn't trip
 * the dependency-cruiser card boundary for cross-sub-app search.
 */
const SearchMartProductCard = memo(function SearchMartProductCard({
  product,
  columnIndex = 0,
  onPress,
}: SearchMartProductCardProps) {
  const cart = useCartProductActions(product);
  return (
    <SearchProductCard
      product={product}
      appBrand="MART"
      columnIndex={columnIndex}
      showFavorite
      showSponsored
      isFavorite={false}
      quantity={cart.quantity}
      onAdd={cart.onAdd}
      onIncrement={cart.onIncrement}
      onDecrement={cart.onDecrement}
      onPress={onPress ? () => onPress(product) : undefined}
    />
  );
});

export default SearchMartProductCard;
