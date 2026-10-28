import React, { memo, useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { hs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { nearbyOffers } from '@data/home/nearbyOffers';
import type { Product } from '@data/types';
import { gateway, type ProductView } from '@/services/api/GatewayClient';
import { useLiveOrigin } from '@/hooks/useLiveLocation';
import type { Coordinates } from '@/services/location';
import { formatDistanceKm } from '@/utils/distance';
import UniversalFeedCard from '@/features/home/cards/UniversalFeedCard';
import { SectionHeader, useAddToCartFeedback, usePricedProducts } from './common';
import type { SectionProps } from './common';

interface NearbyOffersSectionProps extends SectionProps {
  /** SDUI feed rows; falls back to the local fixture for first paint / offline. */
  products?: Product[];
  /** Optional explicit origin (SDUI/registry use); otherwise the live fix is used. */
  origin?: Coordinates;
}

/** Project a server nearby row onto the card `Product` shape with a real distance label. */
function toNearbyProduct(p: ProductView): Product {
  const distance = formatDistanceKm(p.distanceKm);
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    emoji: p.emoji,
    image: p.image,
    desc: distance ? `From a store ${distance} away` : p.desc,
    rating: p.rating,
    app: p.app,
    category: p.category,
    badge: p.badge,
    shop: p.shop,
    reviewsCount: p.reviewsCount,
    unit: p.unit,
    originalPrice: p.originalPrice,
    attributes: p.attributes,
    storeId: p.storeId,
    distanceKm: p.distanceKm,
  };
}

function NearbyOffersSection({
  products = nearbyOffers,
  origin,
  onProductClick,
  addToCart,
}: NearbyOffersSectionProps) {
  const { addedId, handleAdd } = useAddToCartFeedback(addToCart);
  const liveOrigin = useLiveOrigin();
  const activeOrigin = origin ?? liveOrigin;
  const latitude = activeOrigin?.latitude;
  const longitude = activeOrigin?.longitude;
  // null = no authoritative live response (offline / no fix / first paint) → fixture fallback.
  // [] = the gateway answered with no nearby ACTIVE rows → render honestly empty, never a fixture.
  const [live, setLive] = useState<Product[] | null>(null);

  useEffect(() => {
    if (latitude === undefined || longitude === undefined || !gateway.remoteEnabled) {
      setLive(null);
      return;
    }
    let active = true;
    gateway
      .fetchProductsNearby(
        { latitude, longitude },
        { app: 'MART', radiusKm: 25, limit: 6 },
      )
      .then((rows) => {
        if (active) setLive(rows.map(toNearbyProduct));
      })
      .catch(() => {
        if (active) setLive(null);
      });
    return () => {
      active = false;
    };
  }, [latitude, longitude]);

  const source = live ?? products;
  const priced = usePricedProducts(source);

  return (
    <>
      <SectionHeader title="Nearby Offers" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {priced.map((product) => (
          <UniversalFeedCard
            key={product.id}
            product={product}
            variant="rail"
            showDescription
            isAdded={addedId === product.id}
            onPress={() => onProductClick?.(product)}
            onAdd={() => handleAdd(product.id, product.name, product.price, product.emoji)}
          />
        ))}
      </ScrollView>
    </>
  );
}

export default memo(NearbyOffersSection);

const styles = StyleSheet.create({
  scroll: {
    paddingLeft: hs(16),
    paddingRight: hs(4),
    paddingBottom: SPACE.BLOCK,
  },
});
