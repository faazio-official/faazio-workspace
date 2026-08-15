import React from 'react';
import { LayoutGrid, Package, ShoppingBasket, Stethoscope } from 'lucide-react-native';
import { martProducts } from '@data/mart/products';
import { groceryProducts } from '@data/grocery/products';
import { pharmaProducts } from '@data/pharma/products';
import type { Product } from '@data/types';
import SearchMartProductCard from '@/features/ecommerce/components/SearchMartProductCard';
import SearchGroceryProductCard from '@/features/ecommerce/components/SearchGroceryProductCard';
import SearchPharmaProductCard from '@/features/pharma/components/SearchPharmaProductCard';
import type { ActiveFacets, SearchScreenConfig } from '../types';

/**
 * Home is the sanctioned cross-sub-app consumer, so the Hub search aggregates
 * across Mart, Grocery and Pharma. Each toggle slice searches its own dataset
 * with a shared attribute-facet predicate; cards are selected by app brand.
 */

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

const renderCardByApp = (
  item: Product,
  index: number,
  onPress?: (p: Product) => void,
) => {
  const columnIndex = index % 2;
  switch (item.app) {
    case 'MART':
      return <SearchMartProductCard product={item} columnIndex={columnIndex} onPress={onPress} />;
    case 'GROCERY':
      return <SearchGroceryProductCard product={item} columnIndex={columnIndex} onPress={onPress} />;
    case 'PHARMA':
      return <SearchPharmaProductCard product={item} columnIndex={columnIndex} onPress={onPress} />;
    default:
      return null;
  }
};

export interface HomeSearchConfigOptions {
  onProductPress?: (product: Product) => void;
}

export function createHomeSearchConfig({
  onProductPress,
}: HomeSearchConfigOptions = {}): SearchScreenConfig {
  return {
    searchPlaceholder: 'Search food, groceries or more…',
    accentColor: '#2F80ED',
    toggles: [
      { key: 'all', label: 'All', icon: LayoutGrid },
      { key: 'mart', label: 'Mart', icon: Package },
      { key: 'grocery', label: 'Grocery', icon: ShoppingBasket },
      { key: 'pharma', label: 'Pharma', icon: Stethoscope },
    ],
    showToggles: false,
    filterChips: [],
    numColumns: 2,
    sortOptions: [
      { id: 'relevance', label: 'Relevance' },
      { id: 'popularity', label: 'Popularity' },
      { id: 'price-low', label: 'Price: Low to High' },
      { id: 'price-high', label: 'Price: High to Low' },
    ],
    facetSchema: [
      { key: 'type', label: 'Type', multiSelect: true },
      { key: 'brand', label: 'Brand', multiSelect: true },
    ],
    modes: {
      all: {
        key: 'all',
        data: [...martProducts, ...groceryProducts, ...pharmaProducts],
        predicate,
        renderCard: (item, index) => renderCardByApp(item as Product, index, onProductPress),
        sorters: {
          relevance: () => 0,
          popularity: (a, b) => {
            const x = b as Product;
            const y = a as Product;
            const rev = (p: Product) => (p as { reviews?: number }).reviews ?? p.rating;
            return rev(x) - rev(y);
          },
          'price-low': (a, b) => (a as Product).price - (b as Product).price,
          'price-high': (a, b) => (b as Product).price - (a as Product).price,
        },
      },
      mart: {
        key: 'mart',
        data: martProducts,
        predicate,
        renderCard: (item, index) => renderCardByApp(item as Product, index, onProductPress),
        sorters: {
          relevance: () => 0,
          popularity: (a, b) =>
            ((b as { reviews?: number }).reviews ?? 0) - ((a as { reviews?: number }).reviews ?? 0),
          'price-low': (a, b) => (a as Product).price - (b as Product).price,
          'price-high': (a, b) => (b as Product).price - (a as Product).price,
        },
      },
      grocery: {
        key: 'grocery',
        data: groceryProducts,
        predicate,
        renderCard: (item, index) => renderCardByApp(item as Product, index, onProductPress),
        sorters: {
          relevance: () => 0,
          popularity: (a, b) => (b as Product).rating - (a as Product).rating,
          'price-low': (a, b) => (a as Product).price - (b as Product).price,
          'price-high': (a, b) => (b as Product).price - (a as Product).price,
        },
      },
      pharma: {
        key: 'pharma',
        data: pharmaProducts,
        predicate,
        renderCard: (item, index) => renderCardByApp(item as Product, index, onProductPress),
        sorters: {
          relevance: () => 0,
          popularity: (a, b) => (b as Product).rating - (a as Product).rating,
          'price-low': (a, b) => (a as Product).price - (b as Product).price,
          'price-high': (a, b) => (b as Product).price - (a as Product).price,
        },
      },
    },
    keyFor: (item) => String((item as { id?: string })?.id),
  };
}
