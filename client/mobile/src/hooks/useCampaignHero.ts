import { useEffect, useState } from 'react';
import { gateway, type HeroAd } from '@/services/api/GatewayClient';

export interface CampaignHeroContext {
  app?: string;
  category?: string;
  storeId?: string;
}

export interface CampaignHeroResult {
  ads: HeroAd[];
  loading: boolean;
}

/**
 * Shared read for a paid hero placement (`GET /ads/hero`). Never fabricated offline — an empty
 * result collapses the surface (the host may supply a house fallback). Impressions/clicks are
 * reported by `CampaignHero` through the same closed-loop pipeline as the sponsored rail.
 */
export function useCampaignHero(placement: string, ctx: CampaignHeroContext = {}): CampaignHeroResult {
  const { app, category, storeId } = ctx;
  const [ads, setAds] = useState<HeroAd[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    gateway
      .getHeroAds(placement, { app, category, storeId })
      .then((rows) => {
        if (active) {
          setAds(rows);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setAds([]);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [placement, app, category, storeId]);

  return { ads, loading };
}