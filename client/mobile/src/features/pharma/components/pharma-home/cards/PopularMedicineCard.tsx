import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';
import AppText from '@/components/AppText';
import AddToCartControl from '@/components/shared/AddToCartControl';
import { hs, ms, vs } from '@/utils/responsive';
import { brandRamp } from '@/theme/brandTokens';
import type { PharmaPopularMedicine } from '../../../types';
import { PHARMA_GREY, PHARMA_INK, PHARMA_TEAL } from '@/theme/pharmaTokens';
import { localizedName } from '@/lib/localizedText';
import { useLanguageStore } from '@/state/languageStore';
import PharmaImage from '../PharmaImage';
import { formatRating } from '@/components/shared/format';

interface PopularMedicineCardProps {
  item: PharmaPopularMedicine;
  width: number;
  onPress?: () => void;
  onAdd?: () => void;
  quantity?: number;
  onIncrement?: () => void;
  onDecrement?: () => void;
}

const PopularMedicineCard = memo(function PopularMedicineCard({
  item,
  width,
  onPress,
  onAdd,
  quantity = 0,
  onIncrement,
  onDecrement,
}: PopularMedicineCardProps) {
  const language = useLanguageStore((s) => s.language);
  const name = localizedName(item, language);
  return (
    <TouchableOpacity style={[styles.card, { width }]} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.imageWrap}>
        <PharmaImage uri={item.imageUrl} style={styles.image} contentFit="contain" />
      </View>
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <AppText style={styles.unit} numberOfLines={1}>
            {item.details}
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
        <View style={styles.priceRow}>
          <AppText style={styles.price}>Price on prescription</AppText>
        </View>
        <AppText style={styles.name} numberOfLines={1}>
          {name}
        </AppText>
        <View style={styles.metricsRow}>
          <Star size={ms(10)} color={PHARMA_TEAL} fill={PHARMA_TEAL} strokeWidth={1.5} />
          <AppText style={styles.rating}>{formatRating(item.rating)}</AppText>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default PopularMedicineCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#EFEFEF',
    overflow: 'hidden',
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#FAFAFA',
    padding: ms(10),
  },
  image: {
    width: '100%',
    height: '100%',
  },
  body: {
    padding: ms(10),
  },
  name: {
    fontSize: ms(12),
    fontWeight: '700',
    color: PHARMA_INK,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: ms(28),
  },
  unit: {
    flexShrink: 1,
    marginRight: hs(6),
    fontSize: ms(10),
    fontWeight: '500',
    color: PHARMA_GREY,
  },
  addControl: { marginLeft: 'auto' },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(4),
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(6),
  },
  rating: {
    fontSize: ms(10),
    fontWeight: '700',
    color: PHARMA_INK,
    marginLeft: hs(3),
  },
  price: {
    fontSize: ms(14),
    fontWeight: '900',
    color: PHARMA_INK,
  },
  mrp: {
    fontSize: ms(10),
    fontWeight: '600',
    color: PHARMA_GREY,
    textDecorationLine: 'line-through',
  },
});
