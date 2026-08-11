import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import AppText from '@/components/AppText';
import { ms, vs } from '@/utils/responsive';
import type { GroceryProductItem } from '../../../mocks/groceryHomeFeed';
import { GROCERY_BADGE, GROCERY_GREY, GROCERY_INK } from '../../../mocks/groceryHomeFeed';
import GroceryImage from '../GroceryImage';

interface TopPickCardProps {
  item: GroceryProductItem;
  width: number;
  onPress?: () => void;
}

const TopPickCard = memo(function TopPickCard({ item, width, onPress }: TopPickCardProps) {
  return (
    <TouchableOpacity style={[styles.card, { width }]} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.imageWrap}>
        <GroceryImage uri={item.imageUrl} style={styles.image} />
        <View style={styles.badge}>
          <AppText style={styles.badgeText}>{item.discountTag}</AppText>
        </View>
      </View>
      <View style={styles.body}>
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

export default TopPickCard;

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
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: vs(8),
    left: ms(8),
    backgroundColor: GROCERY_BADGE,
    paddingHorizontal: ms(6),
    paddingVertical: vs(2),
    borderRadius: ms(4),
  },
  badgeText: {
    fontSize: ms(8),
    fontWeight: '900',
    color: '#FFFFFF',
  },
  body: {
    padding: ms(10),
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
    marginTop: vs(2),
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(6),
  },
  price: {
    fontSize: ms(14),
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
