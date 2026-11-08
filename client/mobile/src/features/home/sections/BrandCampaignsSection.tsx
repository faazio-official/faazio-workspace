import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  AppState,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import type { AdCampaign, Product } from '@data/types';
import { adCampaigns } from '@data/home/campaigns';
import { gateway, type HomeCampaignDetail } from '@/services/api/GatewayClient';
import BrandCampaignCard from '@/features/home/cards/BrandCampaignCard';
import type { SectionProps } from './common';
import AppText from '@/components/AppText';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { neutral } from '@/theme/brandTokens';

const SWIPE_INTERVAL = 4500;

type CampaignItem = AdCampaign & { detail?: HomeCampaignDetail };

/**
 * One auto-playing paging carousel of vendor campaign cards. Pattern lifted from
 * `AdBannerSection`: the interval advances the active page, `onMomentumScrollEnd`
 * resyncs dots on manual swipe, and the timer is cleared on unmount and re-anchored
 * on a `width` change — so manual swiping never fights the timer and no interval
 * leaks.
 */
const CampaignCarousel = memo(function CampaignCarousel({
  campaigns,
  onViewAll,
  onProductClick,
}: {
  campaigns: CampaignItem[];
  onViewAll?: (campaign: AdCampaign) => void;
  onProductClick?: (product: Product) => void;
}) {
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const [paused, setPaused] = useState(false);
  const [appActive, setAppActive] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (campaigns.length < 2 || reduceMotion || paused || !appActive) return;
    const timer = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % campaigns.length;
        scrollRef.current?.scrollTo({ x: next * width, animated: !reduceMotion });
        return next;
      });
    }, SWIPE_INTERVAL);
    return () => clearInterval(timer);
  }, [width, campaigns.length, reduceMotion, paused, appActive]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) =>
      setAppActive(state === 'active'),
    );
    return () => sub.remove();
  }, []);

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / Math.max(width, 1));
    setIndex(Math.min(Math.max(next, 0), campaigns.length - 1));
    // Interaction pauses autoplay; resume once the gesture settles.
    setPaused(false);
  };

  return (
    <View style={styles.viewport} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onScrollBeginDrag={() => setPaused(true)}
          onScrollEndDrag={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
        >
          {campaigns.map((campaign) => (
            <View key={campaign.id} style={[styles.slide, { width }]}>
              <BrandCampaignCard
                campaign={campaign}
                detail={campaign.detail}
                onViewAll={onViewAll}
                onProductClick={onProductClick}
              />
            </View>
          ))}
        </ScrollView>
      )}
      {width > 0 && campaigns.length > 1 && (
        <View
          style={styles.dots}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Deals carousel"
          accessibilityValue={{
            min: 1,
            max: campaigns.length,
            now: index + 1,
            text: `Slide ${index + 1} of ${campaigns.length}`,
          }}
        >
          {campaigns.map((c, i) => (
            <View key={c.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
});

/**
 * Home "Deals of the day" vendor-campaign section. Renders two stacked, auto-playing
 * paging carousels of vendor campaign cards on the purple `#EDE9FE` container. Each
 * card's "View all" opens the `DealsLanding` page in campaign mode.
 */
function BrandCampaignsSection({ onProductClick, onOpenDeals, campaigns }: SectionProps) {
  const handleViewAll = (campaign: AdCampaign) =>
    onOpenDeals?.({ mode: 'campaign', campaignId: campaign.id });
  const offline = !gateway.remoteEnabled;

  const [details, setDetails] = useState<HomeCampaignDetail[] | null>(null);
  const [error, setError] = useState(false);

  // Server-joined campaign detail (live store + products) — the fixture is only the offline shell.
  useEffect(() => {
    if (offline) return;
    // No server-published campaign defs for this section → honest empty (never all campaigns).
    const ids = campaigns?.map((c) => c.id) ?? [];
    if (ids.length === 0) {
      setDetails([]);
      setError(false);
      return;
    }
    let active = true;
    setError(false);
    gateway
      .getHomeCampaigns()
      .then((rows) => {
        if (!active) return;
        setDetails(rows.filter((r) => ids.includes(r.id)));
      })
      .catch(() => {
        if (!active) return;
        setDetails([]);
        setError(true);
      });
    return () => {
      active = false;
    };
  }, [offline, campaigns]);

  const { carouselOne, carouselTwo } = useMemo(() => {
    if (offline) {
      return {
        carouselOne: adCampaigns.filter((c) => c.carousel === 1) as CampaignItem[],
        carouselTwo: adCampaigns.filter((c) => c.carousel === 2) as CampaignItem[],
      };
    }
    const source: CampaignItem[] = (details ?? []).map((d) => ({
      id: d.id,
      storeId: d.storeId,
      productIds: d.products.map((p) => p.id),
      carousel: d.carousel,
      detail: d,
    }));
    return {
      carouselOne: source.filter((c) => c.carousel === 1),
      carouselTwo: source.filter((c) => c.carousel === 2),
    };
  }, [details, offline]);

  const loading = !offline && details === null;

  return (
    <View style={styles.container}>
      <AppText style={styles.containerTitle}>Deals of the day</AppText>
      {loading ? (
        <AppText style={styles.stateText}>Loading deals…</AppText>
      ) : !offline && error ? (
        <AppText style={styles.stateText}>Deals are unavailable right now.</AppText>
      ) : !offline && carouselOne.length === 0 && carouselTwo.length === 0 ? (
        <AppText style={styles.stateText}>No deals available today.</AppText>
      ) : null}
      {carouselOne.length > 0 ? (
        <CampaignCarousel
          campaigns={carouselOne}
          onViewAll={handleViewAll}
          onProductClick={onProductClick}
        />
      ) : null}
      {carouselTwo.length > 0 ? (
        <View style={styles.secondCarousel}>
          <CampaignCarousel
            campaigns={carouselTwo}
            onViewAll={handleViewAll}
            onProductClick={onProductClick}
          />
        </View>
      ) : null}
    </View>
  );
}

export default memo(BrandCampaignsSection);

const styles = StyleSheet.create({
  container: {
    marginHorizontal: hs(8),
    borderRadius: ms(16),
    backgroundColor: '#EDE9FE',
    padding: hs(10),
    marginTop: SPACE.SECTION,
    marginBottom: SPACE.BLOCK,
  },
  containerTitle: {
    fontSize: ms(18),
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: SPACE.BLOCK,
    marginLeft: hs(2),
  },
  stateText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: neutral.inkMuted,
    textAlign: 'center',
    paddingVertical: SPACE.BLOCK,
  },
  viewport: {
    borderRadius: ms(16),
    overflow: 'hidden',
    position: 'relative',
  },
  slide: {
    paddingHorizontal: hs(1),
  },
  secondCarousel: {
    marginTop: SPACE.BLOCK,
  },
  dots: {
    position: 'absolute',
    bottom: vs(6),
    alignSelf: 'center',
    flexDirection: 'row',
    gap: hs(4),
  },
  dot: {
    width: hs(5),
    height: vs(5),
    borderRadius: ms(3),
    backgroundColor: 'rgba(17,24,39,0.25)',
  },
  dotActive: {
    width: hs(12),
    backgroundColor: '#111827',
  },
});
