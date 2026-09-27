import React, { memo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { hs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { MART_DEALS, dealToProduct } from '@data/mart/deals';
import MartProductCard from '@/features/ecommerce/cards/MartProductCard';
import { SectionHeader, useAddToCartFeedback } from './common';
import type { SectionProps } from './common';

const DEAL_CARD_W = hs(150);

function DealsOfDaySection({ onProductClick, addToCart }: SectionProps) {
  const { addedId, handleAdd } = useAddToCartFeedback(addToCart);
  return (
    <>
      <SectionHeader title="Daily Essentials" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {MART_DEALS.map((deal) => {
          const product = dealToProduct(deal);
          return (
            <MartProductCard
              key={deal.id}
              product={product}
              originalPrice={deal.originalPrice}
              variant="rail"
              width={DEAL_CARD_W}
              showDescription
              isAdded={addedId === deal.id}
              onPress={() => onProductClick?.(product)}
              onAdd={() => handleAdd(deal.id, deal.name, deal.price, deal.emoji)}
            />
          );
        })}
      </ScrollView>
    </>
  );
}

export default memo(DealsOfDaySection);

const styles = StyleSheet.create({
  scroll: {
    paddingLeft: hs(16),
    paddingRight: hs(4),
    paddingBottom: SPACE.BLOCK,
  },
});
