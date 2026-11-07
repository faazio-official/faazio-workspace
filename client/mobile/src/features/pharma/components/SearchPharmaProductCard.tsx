import React, { memo } from 'react';
import SearchProductRowCard from '@/components/shared/SearchProductRowCard';
import { useCartProductActions } from '@/components/shared/hooks';
import { useFavoriteStore } from '@/state/favoriteStore';
import type { Product } from '@data/types';

interface SearchPharmaProductCardProps {
  product: Product;
  onPress?: (product: Product) => void;
  showStoreHeader?: boolean;
}

/**
 * Pharma search result card wrapper. Renders the dense one-per-row list card
 * (contain image, title/desc, optional vendor header + price, compact Add to
 * Cart) and runs onPress with the product. Wires the shared cart store so
 * results can be added straight from search. Lives under components/ (not
 * cards/) so it doesn't trip the dependency-cruiser card boundary for
 * cross-sub-app search.
 */
const SearchPharmaProductCard = memo(function SearchPharmaProductCard({
  product,
  onPress,
  showStoreHeader = true,
}: SearchPharmaProductCardProps) {
  const cart = useCartProductActions(product);
  const isFavorite = useFavoriteStore((s) => s.favorites.includes(product.id));
  const toggleFavorite = useFavoriteStore((s) => s.toggleFavorite);
  return (
    <SearchProductRowCard
      product={product}
      appBrand="PHARMA"
      showFavorite
      isFavorite={isFavorite}
      onFavorite={() => void toggleFavorite(product.id)}
      quantity={cart.quantity}
      onAdd={cart.onAdd}
      onIncrement={cart.onIncrement}
      onDecrement={cart.onDecrement}
      onPress={onPress ? () => onPress(product) : undefined}
      showStoreHeader={showStoreHeader}
    />
  );
});

export default SearchPharmaProductCard;
