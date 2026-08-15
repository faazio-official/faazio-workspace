import React, { memo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { hs, vs } from '@/utils/responsive';
import { useCartStore } from '@/state/store';
import type { MartDeal } from '../../mocks/martHomeFeed';
import { dealToProduct } from '../../mocks/martHomeFeed';
import MartSectionHeader from './MartSectionHeader';
import MartProductCard from '@/features/ecommerce/cards/MartProductCard';

const DEAL_CARD_W = hs(150);

interface DealsOfDayRailProps {
  deals: MartDeal[];
  onDealPress?: (deal: MartDeal) => void;
  onViewAll?: () => void;
}

const DealsOfDayRail = memo(function DealsOfDayRail({
  deals,
  onDealPress,
  onViewAll,
}: DealsOfDayRailProps) {
  const cart = useCartStore((s) => s.cart);
  const addToCart = useCartStore((s) => s.addToCart);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  const renderItem = useCallback(
    ({ item }: { item: MartDeal }) => {
      const product = dealToProduct(item);
      const cartItem = cart.find((c) => c.id === item.id);
      return (
        <MartProductCard
          product={product}
          originalPrice={item.originalPrice}
          variant="rail"
          width={DEAL_CARD_W}
          showDescription
          quantity={cartItem?.quantity ?? 0}
          isAdded={!!cartItem && cartItem.quantity > 0}
          onPress={() => onDealPress?.(item)}
          onAdd={() => addToCart(item.id, item.name, item.price, item.emoji)}
          onIncrement={() => updateQuantity(item.id, 1)}
          onDecrement={() => updateQuantity(item.id, -1)}
        />
      );
    },
    [cart, addToCart, updateQuantity, onDealPress],
  );

  return (
    <View style={styles.wrap}>
      <MartSectionHeader title="Deals of the Day" onViewAll={onViewAll} />
      <FlashList
        data={deals}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        bounces={false}
      />
    </View>
  );
});

export default DealsOfDayRail;

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: vs(8),
  },
  content: {
    paddingHorizontal: hs(16),
  },
});
