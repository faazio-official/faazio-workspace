import React, { memo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { hs, vs } from '@/utils/responsive';
import type { PharmaTopOffer } from '../../mocks/pharmaHomeFeed';
import PharmaSectionHeader from './PharmaSectionHeader';
import TopOfferCard from './cards/TopOfferCard';

const OFFER_W = hs(220);

const OfferSeparator = () => <View style={styles.separator} />;

interface TopOffersRailProps {
  offers: PharmaTopOffer[];
  onPress?: (offer: PharmaTopOffer) => void;
  onViewAll?: () => void;
}

const TopOffersRail = memo(function TopOffersRail({
  offers,
  onPress,
  onViewAll,
}: TopOffersRailProps) {
  const renderItem = useCallback(
    ({ item }: { item: PharmaTopOffer }) => (
      <TopOfferCard item={item} width={OFFER_W} onPress={() => onPress?.(item)} />
    ),
    [onPress],
  );

  return (
    <View style={styles.wrap}>
      <PharmaSectionHeader title="Top Offers" onViewAll={onViewAll} />
      <FlashList
        data={offers}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={OfferSeparator}
        bounces={false}
      />
    </View>
  );
});

export default TopOffersRail;

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: vs(8),
  },
  content: {
    paddingHorizontal: hs(16),
  },
  separator: {
    width: hs(12),
  },
});
