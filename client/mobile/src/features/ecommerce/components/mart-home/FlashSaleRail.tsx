import React, { memo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { hs, vs } from '@/utils/responsive';
import { useCartStore } from '@/state/store';
import type { MartFlashSale } from '../../mocks/martHomeFeed';
import { flashSaleToProduct } from '../../mocks/martHomeFeed';
import MartSectionHeader from './MartSectionHeader';
import MartProductCard from '@/features/ecommerce/cards/MartProductCard';

const SALE_CARD_W = hs(150);

const SaleSeparator = () => <View style={styles.separator} />;

interface FlashSaleRailProps {
  sales: MartFlashSale[];
  onSalePress?: (sale: MartFlashSale) => void;
  onViewAll?: () => void;
}

const FlashSaleRail = memo(function FlashSaleRail({
  sales,
  onSalePress,
  onViewAll,
}: FlashSaleRailProps) {
  const cart = useCartStore((s) => s.cart);
  const addToCart = useCartStore((s) => s.addToCart);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  const renderItem = useCallback(
    ({ item }: { item: MartFlashSale }) => {
      const product = flashSaleToProduct(item);
      const cartItem = cart.find((c) => c.id === item.id);
      return (
        <MartProductCard
          product={product}
          originalPrice={item.originalPrice}
          variant="rail"
          width={SALE_CARD_W}
          showDescription
          quantity={cartItem?.quantity ?? 0}
          isAdded={!!cartItem && cartItem.quantity > 0}
          onPress={() => onSalePress?.(item)}
          onAdd={() => addToCart(item.id, item.name, item.price, item.emoji)}
          onIncrement={() => updateQuantity(item.id, 1)}
          onDecrement={() => updateQuantity(item.id, -1)}
        />
      );
    },
    [cart, addToCart, updateQuantity, onSalePress],
  );

  return (
    <View style={styles.wrap}>
      <MartSectionHeader title="Flash Sale" onViewAll={onViewAll} />
      <FlashList
        data={sales}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={SaleSeparator}
        bounces={false}
      />
    </View>
  );
});

export default FlashSaleRail;

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
