import React, { memo, useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { hs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { MART_DEALS, dealToProduct } from '@data/mart/deals';
import type { Product } from '@data/types';
import { gateway } from '@/services/api/GatewayClient';
import MartProductCard from '@/features/ecommerce/cards/MartProductCard';
import { SectionHeader, useAddToCartFeedback } from './common';
import type { SectionProps } from './common';

const DEAL_CARD_W = hs(150);

/** The fixture projection seed — the offline fallback while the durable catalog loads. */
const FIXTURE_PRODUCTS: Product[] = MART_DEALS.map(dealToProduct);

function DealsOfDaySection({ onProductClick, addToCart }: SectionProps) {
  const { addedId, handleAdd } = useAddToCartFeedback(addToCart);
  // Durable catalog first (md-* are seeded rows): resolve the fixture ids through the gateway so
  // price/MRP come from the server, never synthesized. The authored fixture is only the offline
  // fallback (and the first paint), so the rail never flashes empty.
  const [products, setProducts] = useState<Product[]>(FIXTURE_PRODUCTS);

  useEffect(() => {
    if (!gateway.remoteEnabled) return;
    let active = true;
    gateway
      .getProductsByIds(MART_DEALS.map((d) => d.id))
      .then((rows) => {
        if (!active || rows.length === 0) return;
        const byId = new Map(rows.map((p) => [p.id, p]));
        setProducts(MART_DEALS.map((d) => byId.get(d.id) ?? dealToProduct(d)));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <SectionHeader title="Daily Essentials" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {products.map((product) => (
          <MartProductCard
            key={product.id}
            product={product}
            originalPrice={product.originalPrice}
            variant="rail"
            width={DEAL_CARD_W}
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

export default memo(DealsOfDaySection);

const styles = StyleSheet.create({
  scroll: {
    paddingLeft: hs(16),
    paddingRight: hs(4),
    paddingBottom: SPACE.BLOCK,
  },
});
