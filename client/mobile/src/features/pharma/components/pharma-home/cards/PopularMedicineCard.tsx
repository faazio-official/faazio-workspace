import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Star, Plus, Check } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import type { PharmaPopularMedicine } from '../../../mocks/pharmaHomeFeed';
import { PHARMA_GREY, PHARMA_INK, PHARMA_TEAL } from '../../../mocks/pharmaHomeFeed';
import PharmaImage from '../PharmaImage';

interface PopularMedicineCardProps {
  item: PharmaPopularMedicine;
  width: number;
  onPress?: () => void;
  onAdd?: () => void;
  added?: boolean;
}

const PopularMedicineCard = memo(function PopularMedicineCard({
  item,
  width,
  onPress,
  onAdd,
  added = false,
}: PopularMedicineCardProps) {
  return (
    <TouchableOpacity style={[styles.card, { width }]} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.imageWrap}>
        <PharmaImage uri={item.imageUrl} style={styles.image} contentFit="contain" />
      </View>
      <View style={styles.body}>
        <AppText style={styles.name} numberOfLines={1}>
          {item.name}
        </AppText>
        <AppText style={styles.details} numberOfLines={1}>
          {item.details}
        </AppText>
        <View style={styles.metricsRow}>
          <Star size={ms(10)} color={PHARMA_TEAL} fill={PHARMA_TEAL} strokeWidth={1.5} />
          <AppText style={styles.rating}>{item.rating}</AppText>
        </View>
        <View style={styles.footerRow}>
          <AppText style={styles.price}>₹{item.price}</AppText>
          <TouchableOpacity
            onPress={onAdd}
            style={[styles.addBtn, added && styles.addBtnAdded]}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel={`Add ${item.name} to cart`}
          >
            {added ? (
              <Check size={ms(12)} color="#FFFFFF" strokeWidth={3} />
            ) : (
              <Plus size={ms(12)} color={PHARMA_TEAL} strokeWidth={3} />
            )}
          </TouchableOpacity>
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
  details: {
    fontSize: ms(10),
    fontWeight: '500',
    color: PHARMA_GREY,
    marginTop: vs(2),
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
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: vs(8),
  },
  price: {
    fontSize: ms(14),
    fontWeight: '900',
    color: PHARMA_INK,
  },
  addBtn: {
    width: ms(26),
    height: ms(26),
    borderRadius: ms(6),
    borderWidth: 1,
    borderColor: PHARMA_TEAL,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  addBtnAdded: {
    backgroundColor: PHARMA_TEAL,
    borderColor: PHARMA_TEAL,
  },
});
