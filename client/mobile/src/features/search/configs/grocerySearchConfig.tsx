import React from 'react';
import { ShoppingBasket } from 'lucide-react-native';
import { groceryProducts } from '@data/grocery/products';
import type { Product } from '@data/types';
import SearchGroceryProductCard from '@/features/ecommerce/components/SearchGroceryProductCard';
import type { ActiveFacets, SearchScreenConfig } from '../types';

const searchableText = (p: Product) => {
  const parts = [
    p.name,
    p.category,
    p.desc,
    p.unit,
    ...Object.values(p.attributes ?? {}).flatMap((v) =>
      Array.isArray(v) ? v : [String(v)],
    ),
  ];
  return parts.join(' ').toLowerCase();
};

const matchesFacets = (p: Product, activeFacets: ActiveFacets) =>
  Object.entries(activeFacets).every(([key, selected]) => {
    if (!selected || selected.length === 0) return true;
    const attr = p.attributes?.[key];
    if (attr === undefined || attr === null) return false;
    const values = Array.isArray(attr) ? attr.map(String) : [String(attr)];
    return values.some((v) => selected.includes(v));
  });

const predicate = (p: Product, query: string, _chipIds: string[], activeFacets: ActiveFacets) => {
  const q = query.trim().toLowerCase();
  if (q && !searchableText(p).includes(q)) return false;
  if (!matchesFacets(p, activeFacets)) return false;
  return true;
};

export interface GrocerySearchConfigOptions {
  onProductPress?: (product: Product) => void;
}

export function createGrocerySearchConfig({
  onProductPress,
}: GrocerySearchConfigOptions = {}): SearchScreenConfig {
  return {
    searchPlaceholder: 'Search groceries…',
    accentColor: '#10B981',
    toggles: [{ key: 'products', label: 'Products', icon: ShoppingBasket }],
    showToggles: false,
    filterChips: [],
    numColumns: 2,
    sortOptions: [
      { id: 'relevance', label: 'Relevance' },
      { id: 'popularity', label: 'Popularity' },
      { id: 'price-low', label: 'Price: Low to High' },
      { id: 'price-high', label: 'Price: High to Low' },
      { id: 'newest', label: 'Newest' },
    ],
    facetSchema: [
      { key: 'type', label: 'Type', multiSelect: true },
      { key: 'dietary', label: 'Dietary', multiSelect: true },
    ],
    modes: {
      products: {
        key: 'products',
        data: groceryProducts,
        predicate,
        renderCard: (item, index) => (
          <SearchGroceryProductCard
            product={item as Product}
            columnIndex={index % 2}
            onPress={onProductPress}
          />
        ),
        sorters: {
          relevance: () => 0,
          popularity: (a, b) => (b as Product).rating - (a as Product).rating,
          'price-low': (a, b) => (a as Product).price - (b as Product).price,
          'price-high': (a, b) => (b as Product).price - (a as Product).price,
          newest: () => 0,
        },
      },
    },
    keyFor: (item) => String((item as { id?: string })?.id),
  };
}
