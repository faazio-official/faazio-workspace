import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { hs, vs } from '@/utils/responsive';
import { storeOffers } from '@data/home/storeOffers';
import { martStores } from '@data/mart/stores';
import StoreCardBase from '@/components/shared/StoreCardBase';
import { SectionHeader, subAppIdFor } from './common';
import type { SectionProps } from './common';
import type { StoreOffer, StoreProfile } from '@data/types';

// Maps the flat StoreOffer shape onto StoreProfile so StoreCardBase can render it.
// Enriching with the store's delivery meta keeps the card complete today.
// When the backend lands, this section swaps the static array for an API call
// — one-file change in the data import only (see PENDING_WORK.md).
const profileFor = (offer: StoreOffer): StoreProfile => {
  const store = martStores.find((s) => s.id === offer.storeId);
  return {
    id: offer.id,
    name: offer.storeName,
    app: offer.app,
    categories: store?.categories ?? [],
    rating: offer.rating,
    reviewsCount: store?.reviewsCount,
    deliveryTime: store?.deliveryTime ?? 'Same-day',
    distance: offer.distance,
    coverImage: offer.coverImage,
    emoji: offer.emoji,
    desc: offer.offerTitle,
    offerTag: offer.offerTag,
  };
};

export default function StoreOffersSection({ onLaunchSubApp }: SectionProps) {
  return (
    <>
      <SectionHeader title="Store Offers" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {storeOffers.map((offer) => (
          <StoreCardBase
            key={offer.id}
            store={profileFor(offer)}
            variant="rail"
            onPress={() => onLaunchSubApp(subAppIdFor(offer.app))}
          />
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingLeft: hs(16),
    paddingRight: hs(4),
    paddingBottom: vs(16),
  },
});
