import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import type { SubAppId } from '@/state/uiStore';
import type { AppBrand, Product, StoreProfile } from '@data/types';
import { applyActiveDiscounts, useActiveDiscounts } from '@/services/pricing';
import AppText from '@/components/AppText';

export interface SectionProps {
  onLaunchSubApp: (subAppId: SubAppId) => void;
  onProductClick?: (product: any) => void;
  /** Resolve a paid hero's store target to the right vendor / medical-shop page. */
  onStoreClick?: (store: StoreProfile) => void;
  addToCart?: (id: string, name: string, price: number, emoji: string) => void;
  /** Open the Deals landing page for a campaign or vendor discounts. */
  onOpenDeals?: (params: { mode: 'campaign' | 'discounts'; campaignId?: string; storeId?: string }) => void;
}

// Maps the data-layer AppBrand to the navigable SubAppId.
export function subAppIdFor(app: AppBrand): SubAppId {
  return app === 'MART' ? 'FA_MART' : app;
}

export interface AddToCartFeedback {
  addedId: string | null;
  handleAdd: (id: string, name: string, price: number, emoji: string) => void;
}

// Shared "add to cart + temporary added feedback" handler for card sections.
export function useAddToCartFeedback(addToCart?: (id: string, name: string, price: number, emoji: string) => void): AddToCartFeedback {
  const [addedId, setAddedId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const handleAdd = useCallback((id: string, name: string, price: number, emoji: string) => {
    addToCart?.(id, name, price, emoji);
    setAddedId(id);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAddedId(null), 1500);
  }, [addToCart]);

  return { addedId, handleAdd };
}

/**
 * Overlay the approved festival discounts on a Home section's product list. Sections read
 * canonical sources (curated fixtures / server feed rows), so the overlay is applied exactly once.
 * No-op offline or when no discount is live.
 */
export function usePricedProducts<T extends Product>(products: T[]): T[] {
  const discounts = useActiveDiscounts(products.map((p) => p.id));
  return useMemo(() => applyActiveDiscounts(products, discounts), [products, discounts]);
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  right?: React.ReactNode;
}

export function SectionHeader({ title, subtitle, leading, right }: SectionHeaderProps) {
  return (
    <View style={styles.headerRow}>
      <View style={styles.headerTitleGroup}>
        {leading}
        <View>
          <AppText style={styles.title}>{title}</AppText>
          {subtitle ? <AppText style={styles.subtitle}>{subtitle}</AppText> : null}
        </View>
      </View>
      {right}
    </View>
  );
}

export function RailRightLabel({ label, tint }: { label: string; tint?: string }) {
  return (
    <TouchableOpacity style={[styles.rightPill, tint ? { backgroundColor: tint } : styles.rightPillDefault]} activeOpacity={0.8}>
      <AppText style={styles.rightPillText}>{label}</AppText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    marginTop: SPACE.SECTION,
    marginBottom: SPACE.BLOCK,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: ms(18),
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: ms(9.5),
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: vs(1),
  },
  rightPill: {
    paddingHorizontal: hs(9),
    paddingVertical: vs(3),
    borderRadius: ms(10),
  },
  rightPillDefault: {
    backgroundColor: '#f1f5f9',
  },
  rightPillText: {
    fontSize: ms(8),
    fontWeight: '900',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
