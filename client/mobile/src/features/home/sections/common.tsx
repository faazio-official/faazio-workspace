import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { neutral, parentRamp } from '@/theme/brandTokens';
import { ICON, TOUCH } from '@/theme/tokens';
import type { SubAppId } from '@/state/uiStore';
import type { AppBrand, Product, StoreProfile } from '@data/types';
import type { SduiCampaign } from '@data/home/sdui';
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
  /** Server-owned campaign definitions for this section (Home "Deals of the day"); fixture fallback. */
  campaigns?: SduiCampaign[];
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
  actionLabel?: string;
  onAction?: () => void;
  accent?: string;
}

export function SectionHeader({
  title,
  subtitle,
  leading,
  right,
  actionLabel = 'View all',
  onAction,
  accent = parentRamp.deep,
}: SectionHeaderProps) {
  return (
    <View style={styles.headerRow}>
      <View style={styles.headerTitleGroup}>
        {leading}
        <View>
          <AppText style={styles.title}>{title}</AppText>
          {subtitle ? <AppText style={styles.subtitle}>{subtitle}</AppText> : null}
        </View>
      </View>
      {right ??
        (onAction ? (
          <TouchableOpacity
            onPress={onAction}
            style={styles.action}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          >
            <AppText style={[styles.actionLabel, { color: accent }]}>{actionLabel}</AppText>
            <ChevronRight size={ICON.sm} color={accent} strokeWidth={1.5} />
          </TouchableOpacity>
        ) : null)}
    </View>
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
    fontWeight: '600',
    color: neutral.ink,
  },
  subtitle: {
    fontSize: ms(12),
    fontWeight: '400',
    color: neutral.inkMuted,
    marginTop: vs(1),
  },
  action: {
    minHeight: TOUCH.min,
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(2),
    paddingLeft: hs(12),
  },
  actionLabel: {
    fontSize: ms(13),
    fontWeight: '500',
  },
});
