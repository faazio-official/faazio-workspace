import { useEffect, useState } from 'react';
import { gateway, type Category } from '@/services/api/GatewayClient';
import type { VendorApp } from '@/services/categoryVendors';

const APP_BRAND: Record<VendorApp, 'MART' | 'PHARMA'> = {
  FA_MART: 'MART',
  PHARMA: 'PHARMA',
};

export interface CategoryTree {
  categories: Category[];
  loading: boolean;
}

/**
 * Server-backed category tree for one sub-app. Reads the superadmin-owned `taxonomy.categories`
 * list (`GET /categories?app=`) — no fixture fallback. The flat list is turned into a parent/child
 * tree by the caller.
 */
export function useCategoryTree(app: VendorApp): CategoryTree {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const brand = APP_BRAND[app];

  useEffect(() => {
    let active = true;
    setLoading(true);
    gateway
      .fetchCategories(brand)
      .then((list) => {
        if (active) setCategories(list);
      })
      .catch(() => {
        if (active) setCategories([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [brand]);

  return { categories, loading };
}