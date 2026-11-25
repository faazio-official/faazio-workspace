import React, { memo } from 'react';
import type { Product } from '@data/types';
import type { SponsoredProduct } from '@/services/api/GatewayClient';
import SponsoredRail from '@/components/shared/SponsoredRail';
import UniversalFeedCard from '@/features/home/cards/UniversalFeedCard';
import { PRODUCT_CARD_WIDTH } from '@/theme/cards';

interface SponsoredRailSectionProps {
  /** The placement this rail reads (`GET /ads/live?slot=…`). Defaults to the Home rail. */
  placement?: string;
  onProductClick?: (product: any) => void;
}

/**
 * Home's paid shelf. The ad-server fill, impression/click events, last-click attribution and the
 * "Why sponsored?" disclosure all live in the shared `SponsoredRail`; Home only supplies its card.
 */
function SponsoredRailSection({ placement = 'HOME_TOP', onProductClick }: SponsoredRailSectionProps) {
  return (
    <SponsoredRail
      placement={placement}
      onProductClick={onProductClick}
      renderCard={(product: SponsoredProduct, h) => (
        <UniversalFeedCard
          key={product.id}
          product={product as unknown as Product}
          variant="rail"
          width={PRODUCT_CARD_WIDTH}
          imageAspect={1}
          showAdLabel
          showAddButton={false}
          nameLines={1}
          onPress={h.onPress}
        />
      )}
    />
  );
}

export default memo(SponsoredRailSection);