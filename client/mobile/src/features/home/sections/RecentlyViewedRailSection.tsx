import React, { memo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { PRODUCT_CARD_WIDTH } from '@/theme/cards';
import UniversalFeedCard from '@/features/home/cards/UniversalFeedCard';
import { usePricedProducts } from './common';
import type { SectionProps } from './common';
import type { AppBrand, Product } from '@data/types';
import AppText from '@/components/AppText';

interface RecentlyViewedRailSectionProps extends SectionProps {
  title: string;
  products: Product[];
  accent: string;
  appBrand: AppBrand;
}

function RecentlyViewedRailSection({
  title, products, accent, appBrand,
  onProductClick,
}: RecentlyViewedRailSectionProps) {
  const priced = usePricedProducts(products);
  return (
    <>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <View style={[styles.dot, { backgroundColor: accent }]} />
          <AppText style={styles.title}>{title}</AppText>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {priced.map((product) => (
          <UniversalFeedCard
            key={product.id}
            product={product}
            variant="rail"
            width={PRODUCT_CARD_WIDTH}
            imageAspect={1}
            showAddButton={false}
            showRating={false}
            showBadge={false}
            nameLines={2}
            compactPrice
            onPress={() => onProductClick?.(product)}
          />
        ))}
      </ScrollView>
    </>
  );
}

export default memo(RecentlyViewedRailSection);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    marginTop: SPACE.BLOCK,
    marginBottom: SPACE.BLOCK,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: vs(6),
    height: vs(6),
    borderRadius: ms(3),
    marginRight: hs(6),
  },
  title: {
    fontSize: ms(17),
    fontWeight: '900',
    color: '#334155',
    letterSpacing: 0.3,
  },
  scroll: {
    paddingLeft: hs(16),
    paddingRight: hs(4),
    paddingBottom: SPACE.BLOCK,
  },
});
