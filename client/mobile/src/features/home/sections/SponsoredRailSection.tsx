import React, { memo, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Info } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import type { Product } from '@data/types';
import { gateway, type ProductView } from '@/services/api/GatewayClient';
import UniversalFeedCard from '@/features/home/cards/UniversalFeedCard';
import SlideUpSheet from '@/components/shared/SlideUpSheet';
import AppText from '@/components/AppText';
import { useAddToCartFeedback } from './common';
import type { SectionProps } from './common';

/** The placement this rail reads (`GET /ads/live?slot=HOME_TOP`). */
const PLACEMENT = 'HOME_TOP';

/**
 * Paid, separately-labelled rail fed by the ad-server (`GET /ads/live` → catalog join). Deliberately
 * NOT `BrandCampaignsSection`: editorial and paid must never share a ranked shelf. Fill-rate
 * contract (Flipkart/Amazon): no LIVE ads, offline, or error → render `null` so the feed collapses
 * seamlessly — never an empty shelf. Every card carries the shared AD disclosure and the header
 * opens a "Why sponsored?" sheet.
 */
function SponsoredRailSection({ onProductClick, addToCart }: SectionProps) {
  const [products, setProducts] = useState<ProductView[]>([]);
  const [infoOpen, setInfoOpen] = useState(false);
  const { addedId, handleAdd } = useAddToCartFeedback(addToCart);

  useEffect(() => {
    let active = true;
    gateway
      .getSponsoredProducts(PLACEMENT)
      .then((rows) => {
        if (active) setProducts(rows);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (products.length === 0) return null;

  return (
    <>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <View style={styles.dot} />
          <AppText style={styles.title}>Sponsored picks</AppText>
          <TouchableOpacity
            style={styles.infoBtn}
            onPress={() => setInfoOpen(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Why am I seeing this?"
          >
            <Info size={ms(13)} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {products.map((product) => (
          <UniversalFeedCard
            key={product.id}
            product={product as unknown as Product}
            variant="rail"
            showAdLabel
            isAdded={addedId === product.id}
            onPress={() => onProductClick?.(product)}
            onAdd={() => handleAdd(product.id, product.name, product.price, product.emoji)}
          />
        ))}
      </ScrollView>

      <SlideUpSheet visible={infoOpen} onRequestClose={() => setInfoOpen(false)}>
        <View style={styles.sheet}>
          <AppText style={styles.sheetTitle}>Why sponsored?</AppText>
          <AppText style={styles.sheetBody}>
            These picks are paid placements — selected sellers paid to highlight them here. They are
            ranked separately from organic results and always carry an AD label. Your recommendations
            are not affected by who pays.
          </AppText>
        </View>
      </SlideUpSheet>
    </>
  );
}

export default memo(SponsoredRailSection);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    marginTop: SPACE.SECTION,
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
    backgroundColor: '#B45309',
  },
  title: {
    fontSize: ms(17),
    fontWeight: '900',
    color: '#334155',
    letterSpacing: 0.3,
  },
  infoBtn: {
    marginLeft: hs(6),
  },
  scroll: {
    paddingLeft: hs(16),
    paddingRight: hs(4),
    paddingBottom: SPACE.BLOCK,
  },
  sheet: {
    width: '100%',
    paddingVertical: vs(6),
  },
  sheetTitle: {
    fontSize: ms(15),
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: vs(8),
  },
  sheetBody: {
    fontSize: ms(12.5),
    fontWeight: '600',
    color: '#475569',
    lineHeight: ms(19),
  },
});