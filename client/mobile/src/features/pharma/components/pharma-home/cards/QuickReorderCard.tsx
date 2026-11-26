import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import AppText from '@/components/AppText';
import AddToCartControl from '@/components/shared/AddToCartControl';
import { hs, ms, vs } from '@/utils/responsive';
import { brandRamp } from '@/theme/brandTokens';
import type { PharmaQuickReorderItem } from '../../../types';
import { PHARMA_GREY, PHARMA_INK } from '@/theme/pharmaTokens';
import { localizedName } from '@/lib/localizedText';
import { useLanguageStore } from '@/state/languageStore';

interface QuickReorderCardProps {
  item: PharmaQuickReorderItem;
  width: number;
  onPress?: () => void;
  onAdd?: () => void;
  quantity?: number;
  onIncrement?: () => void;
  onDecrement?: () => void;
}

const QuickReorderCard = memo(function QuickReorderCard({
  item,
  width,
  onPress,
  onAdd,
  quantity = 0,
  onIncrement,
  onDecrement,
}: QuickReorderCardProps) {
  const language = useLanguageStore((s) => s.language);
  const name = localizedName(item, language);
  return (
    <TouchableOpacity
      style={[styles.card, { width }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.metaRow}>
        <AppText style={styles.strip} numberOfLines={1}>
          {item.stripDetails}
        </AppText>
        {onAdd ? (
          <AddToCartControl
            quantity={quantity}
            onAdd={onAdd}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
            accent={brandRamp.PHARMA.deep}
            onAccent={brandRamp.PHARMA.onDeep}
            compact
            label={name}
            style={styles.addControl}
          />
        ) : null}
      </View>
      <View style={styles.bottomRow}>
        <View style={styles.priceWrap}>
          <AppText style={styles.price}>Price on prescription</AppText>
          {item.mrp && item.mrp > item.price ? (
            <AppText style={styles.mrp}>₹{item.mrp}</AppText>
          ) : null}
        </View>
      </View>
      <AppText style={styles.name} numberOfLines={2}>
        {name}
      </AppText>
    </TouchableOpacity>
  );
});

export default QuickReorderCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: ms(12),
    padding: ms(12),
    justifyContent: 'space-between',
  },
  name: {
    fontSize: ms(12),
    fontWeight: '700',
    color: PHARMA_INK,
    marginTop: vs(4),
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: ms(28),
  },
  strip: {
    flexShrink: 1,
    marginRight: hs(6),
    fontSize: ms(10),
    fontWeight: '500',
    color: PHARMA_GREY,
  },
  addControl: { marginLeft: 'auto' },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: vs(6),
  },
  price: {
    fontSize: ms(14),
    fontWeight: '900',
    color: PHARMA_INK,
  },
  priceWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: hs(4),
    flexShrink: 1,
  },
  mrp: {
    fontSize: ms(10),
    fontWeight: '600',
    color: PHARMA_GREY,
    textDecorationLine: 'line-through',
  },
});
