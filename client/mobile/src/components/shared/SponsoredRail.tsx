import React, { memo, useCallback, useEffect, useState, type ReactNode } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Info } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { gateway, type SponsoredProduct } from '@/services/api/GatewayClient';
import { setLastClickedSlotId } from '@/services/adsAttribution';
import { applyActiveDiscounts, useActiveDiscounts } from '@/services/pricing';
import SlideUpSheet from '@/components/shared/SlideUpSheet';
import AppText from '@/components/AppText';

/** Per-card wiring handed to the caller's `renderCard` so the paid shelf stays card-agnostic. */
export interface SponsoredCardHandlers {
  isAdded: boolean;
  onPress: () => void;
  onAdd: () => void;
}

interface SponsoredRailProps {
  /** Ad placement served by the ad-server (`GET /ads/live?slot=…`). */
  placement: string;
  /** Header label. Defaults to "Sponsored picks". */
  title?: string;
  /** Render the caller's own product card (each sub-app uses its canonical card). */
  renderCard: (product: SponsoredProduct, handlers: SponsoredCardHandlers) => ReactNode;
  onProductClick?: (product: any) => void;
  addToCart?: (id: string, name: string, price: number, emoji: string) => void;
}

/**
 * Paid, separately-labelled shelf fed by the ad-server (`GET /ads/live` → catalog join). Lives in
 * `components/shared` so Home and the Mart surfaces share one closed-loop pipeline (impression/click
 * events + last-click attribution) without cross-sub-app imports. Fill-rate contract
 * (Flipkart/Amazon): no LIVE ads, offline, or error → render `null` so the feed collapses
 * seamlessly — never an empty shelf. Every card carries the shared AD disclosure and the header
 * opens a "Why sponsored?" sheet. Editing and paid never share a ranked shelf.
 */
function SponsoredRail({
  placement,
  title = 'Sponsored picks',
  renderCard,
  onProductClick,
  addToCart,
}: SponsoredRailProps) {
  const [products, setProducts] = useState<SponsoredProduct[]>([]);
  const [addedId, setAddedId] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  // The shopper pays the same price everywhere: overlay any live festival discount on the paid shelf.
  const discounts = useActiveDiscounts(products.map((p) => p.id));
  const priced = applyActiveDiscounts(products, discounts);

  useEffect(() => {
    let active = true;
    gateway
      .getSponsoredProducts(placement)
      .then((rows) => {
        if (active) setProducts(rows);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [placement]);

  // Closed-loop ads: report one impression per rendered slot (server de-dupes per user). Best-effort.
  useEffect(() => {
    for (const p of products) void gateway.recordAdEvent(p.slotId, 'impression');
  }, [products]);

  const handleAdd = useCallback(
    (product: SponsoredProduct) => {
      addToCart?.(product.id, product.name, product.price, product.emoji);
      setAddedId(product.id);
      setTimeout(() => setAddedId((cur) => (cur === product.id ? null : cur)), 1500);
    },
    [addToCart],
  );

  // A tap records the click and remembers the slot so checkout can attribute the conversion.
  const handlePress = useCallback(
    (product: SponsoredProduct) => {
      void gateway.recordAdEvent(product.slotId, 'click');
      setLastClickedSlotId(product.slotId);
      onProductClick?.(product);
    },
    [onProductClick],
  );

  if (priced.length === 0) return null;

  return (
    <>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <View style={styles.dot} />
          <AppText style={styles.title}>{title}</AppText>
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
        {priced.map((product) =>
          renderCard(product, {
            isAdded: addedId === product.id,
            onPress: () => handlePress(product),
            onAdd: () => handleAdd(product),
          }),
        )}
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

export default memo(SponsoredRail);

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