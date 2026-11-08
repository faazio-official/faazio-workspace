import React, { memo, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { hs, ms, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { MART_DEALS, dealToProduct } from '@data/mart/deals';
import type { Product } from '@data/types';
import { gateway } from '@/services/api/GatewayClient';
import MartProductCard from '@/features/ecommerce/cards/MartProductCard';
import { SectionHeader, useAddToCartFeedback } from './common';
import type { SectionProps } from './common';
import AppText from '@/components/AppText';
import { neutral } from '@/theme/brandTokens';

const DEAL_CARD_W = hs(150);

/** The authored projection is the offline shell only — never rendered as live data online. */
const FIXTURE_PRODUCTS: Product[] = MART_DEALS.map(dealToProduct);

interface DealsOfDaySectionProps extends SectionProps {
  /** Server-joined SDUI `dealsOfDay` rows. Authoritative when present (even when empty). */
  products?: Product[];
}

function DealsOfDaySection({ products, onProductClick, addToCart }: DealsOfDaySectionProps) {
  const { addedId, handleAdd } = useAddToCartFeedback(addToCart);
  const offline = !gateway.remoteEnabled;
  const [serverProducts, setServerProducts] = useState<Product[]>([]);
  const [fetchState, setFetchState] = useState<'idle' | 'loading' | 'live' | 'error'>('idle');
  const [reloadNonce, setReloadNonce] = useState(0);

  // The Home SDUI doc already joined the `dealsOfDay` rows, so use them directly. Only when the
  // section is rendered without a join (e.g. offline shell or a caller that omits it) do we fall
  // back to resolving the seeded ids through the gateway — never to authored prices.
  useEffect(() => {
    if (offline) return;
    if (products !== undefined) {
      setServerProducts(products);
      setFetchState('live');
      return;
    }
    let active = true;
    setFetchState('loading');
    gateway
      .getProductsByIds(MART_DEALS.map((d) => d.id))
      .then((rows) => {
        if (!active) return;
        setServerProducts(rows as unknown as Product[]);
        setFetchState('live');
      })
      .catch(() => {
        if (!active) return;
        setServerProducts([]);
        setFetchState('error');
      });
    return () => {
      active = false;
    };
  }, [products, offline, reloadNonce]);

  const rows = offline ? FIXTURE_PRODUCTS : serverProducts;

  return (
    <>
      <SectionHeader title="Daily Essentials" />
      {!offline && fetchState === 'loading' ? (
        <AppText style={styles.stateText}>Loading deals…</AppText>
      ) : !offline && fetchState === 'error' ? (
        <View style={styles.stateWrap}>
          <AppText style={styles.stateText}>Could not load today&apos;s deals.</AppText>
          <TouchableOpacity onPress={() => setReloadNonce((n) => n + 1)} activeOpacity={0.8} accessibilityRole="button">
            <AppText style={styles.retryText}>Try again</AppText>
          </TouchableOpacity>
        </View>
      ) : rows.length === 0 ? (
        <AppText style={styles.stateText}>No deals available today.</AppText>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {rows.map((product) => (
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
      )}
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
  stateWrap: {
    alignItems: 'center',
    paddingVertical: SPACE.BLOCK,
    gap: vs(6),
  },
  stateText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: neutral.inkMuted,
    textAlign: 'center',
    paddingVertical: SPACE.BLOCK,
  },
  retryText: {
    fontSize: ms(12),
    fontWeight: '700',
    color: neutral.ink,
  },
});
