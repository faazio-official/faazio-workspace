import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import AppText from '@/components/AppText';
import { ms, vs } from '@/utils/responsive';
import type { GroceryBestDeal } from '../../../mocks/groceryHomeFeed';
import { GROCERY_GREY, GROCERY_INK } from '../../../mocks/groceryHomeFeed';
import GroceryImage from '../GroceryImage';

interface BestDealCardProps {
  item: GroceryBestDeal;
  width: number;
  onPress?: () => void;
}

const BestDealCard = memo(function BestDealCard({ item, width, onPress }: BestDealCardProps) {
  return (
    <TouchableOpacity style={[styles.card, { width }]} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.imageWrap}>
        <GroceryImage uri={item.imageUrl} style={styles.image} />
      </View>
      <View style={styles.body}>
        <AppText style={styles.brand}>{item.brand}</AppText>
        <AppText style={styles.name} numberOfLines={1}>
          {item.name}
        </AppText>
        <AppText style={styles.size}>{item.size}</AppText>
        <View style={styles.priceRow}>
          <AppText style={styles.price}>₹{item.price}</AppText>
          <AppText style={styles.originalPrice}>₹{item.originalPrice}</AppText>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default BestDealCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#EFEFEF',
    padding: ms(10),
  },
  imageWrap: {
    width: ms(84),
    height: ms(84),
    borderRadius: ms(8),
    backgroundColor: '#FAFAFA',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  body: {
    flex: 1,
    marginLeft: ms(10),
    justifyContent: 'center',
    gap: vs(3),
  },
  brand: {
    fontSize: ms(9),
    fontWeight: '700',
    color: GROCERY_GREY,
  },
  name: {
    fontSize: ms(12),
    fontWeight: '700',
    color: GROCERY_INK,
  },
  size: {
    fontSize: ms(10),
    fontWeight: '500',
    color: GROCERY_GREY,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(2),
  },
  price: {
    fontSize: ms(13),
    fontWeight: '900',
    color: GROCERY_INK,
  },
  originalPrice: {
    fontSize: ms(9),
    fontWeight: '600',
    color: GROCERY_GREY,
    textDecorationLine: 'line-through',
    marginLeft: ms(6),
  },
});
