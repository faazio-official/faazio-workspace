import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { hs, vs, ms } from '@/utils/responsive';
import type { AdCampaign, Product } from '@data/types';
import { getCampaignProducts, getCampaignStore } from '@data/home/campaigns';
import AdProductCard from '@/features/home/cards/AdProductCard';
import AppText from '@/components/AppText';

interface BrandCampaignCardProps {
  campaign: AdCampaign;
  onViewAll?: (campaign: AdCampaign) => void;
  onProductClick?: (product: Product) => void;
}

/** Max round discount % across a product set, or `null` if none carry a discount. */
function maxDiscountPct(products: Product[]): number | null {
  let max: number | null = null;
  for (const p of products) {
    if (p.originalPrice !== undefined && p.originalPrice > p.price) {
      const pct = Math.round((1 - p.price / p.originalPrice) * 100);
      if (max === null || pct > max) max = pct;
    }
  }
  return max;
}

/**
 * A single vendor campaign card inside the Home "Deals of the day" carousels.
 * Bold vendor-name title + "View all >", a computed **"Up to X% off"** discount
 * label below (no EMI / `offerTag` text), and a 2-product row of bigger minimal
 * `AdProductCard`s laid out flexibly (auto, not `space-between`). No logo icon,
 * tagline or trust chips — this is an ad zone, so product cards carry only an 'AD'
 * pill and square images.
 */
const BrandCampaignCard = memo(function BrandCampaignCard({
  campaign,
  onViewAll,
  onProductClick,
}: BrandCampaignCardProps) {
  const store = getCampaignStore(campaign);
  const products = getCampaignProducts(campaign).slice(0, 2);
  const name = store?.name ?? '';
  const maxPct = maxDiscountPct(products);

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <AppText style={styles.brandName} numberOfLines={1}>
          {name}
        </AppText>
        {onViewAll ? (
          <TouchableOpacity onPress={() => onViewAll(campaign)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <AppText style={styles.viewAllText}>View all {'>'}</AppText>
          </TouchableOpacity>
        ) : null}
      </View>

      {maxPct !== null ? (
        <AppText style={styles.discountLabel} numberOfLines={1}>
          Up to {maxPct}% off
        </AppText>
      ) : null}

      <View style={styles.productRow}>
        {products.map((product) => (
          <AdProductCard
            key={product.id}
            product={product}
            onPress={onProductClick}
          />
        ))}
      </View>
    </View>
  );
});

export default BrandCampaignCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    padding: hs(12),
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: hs(8),
  },
  brandName: {
    fontSize: ms(16),
    fontWeight: '900',
    color: '#111827',
    flexShrink: 1,
  },
  viewAllText: {
    fontSize: ms(10),
    fontWeight: '800',
    color: '#B45309',
  },
  discountLabel: {
    fontSize: ms(10),
    fontWeight: '800',
    color: '#B45309',
    marginTop: vs(3),
  },
  productRow: {
    flexDirection: 'row',
    gap: hs(10),
    marginTop: vs(10),
  },
});
