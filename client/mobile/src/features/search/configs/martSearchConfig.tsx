import React from 'react';
import { Package } from 'lucide-react-native';
import { martProducts } from '@data/mart/products';
import type { Product } from '@data/types';
import { gateway } from '@/services/api/GatewayClient';
import { withActiveDiscounts } from '@/services/pricing';
import SearchMartProductCard from '@/features/ecommerce/components/SearchMartProductCard';
import { buildProductSuggestions } from '../suggestions';
import type { ActiveFacets, SearchScreenConfig } from '../types';

const searchableText = (p: Product) => {
  const parts = [
    p.name,
    p.category,
    p.desc,
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

export interface MartSearchConfigOptions {
  onProductPress?: (product: Product) => void;
}

export function createMartSearchConfig({
  onProductPress,
}: MartSearchConfigOptions = {}): SearchScreenConfig {
  return {
    searchPlaceholder: 'Search products in Mart…',
    accentColor: '#1162D3',
    toggles: [{ key: 'products', label: 'Products', icon: Package }],
    showToggles: false,
    filterChips: [],
    sortOptions: [
      { id: 'relevance', label: 'Relevance' },
      { id: 'popularity', label: 'Popularity' },
      { id: 'price-low', label: 'Price: Low to High' },
      { id: 'price-high', label: 'Price: High to Low' },
      { id: 'newest', label: 'Newest' },
    ],
    facetSchema: [
      { key: 'type', label: 'Type', multiSelect: true },
      { key: 'brand', label: 'Brand', multiSelect: true },
    ],
    buildSuggestions: buildProductSuggestions,
    modes: {
      products: {
        key: 'products',
        data: martProducts,
        predicate,
        renderCard: (item) => (
          <SearchMartProductCard product={item as Product} onPress={onProductPress} />
        ),
        // Server FTS result pool (directory/catalog, app=MART), with any approved festival discount
        // overlaid; the local pool is the fallback.
        fetch: async (q) => withActiveDiscounts(await gateway.searchProducts(q, 'MART')),
        sorters: {
          relevance: () => 0,
          popularity: (a, b) => {
            const reviews = (p: Product) =>
              (p as { reviews?: number }).reviews ?? p.reviewsCount ?? 0;
            return reviews(b as Product) - reviews(a as Product);
          },
          'price-low': (a, b) => (a as Product).price - (b as Product).price,
          'price-high': (a, b) => (b as Product).price - (a as Product).price,
          newest: () => 0,
        },
      },
    },
    keyFor: (item) => String((item as { id?: string })?.id),
  };
}
