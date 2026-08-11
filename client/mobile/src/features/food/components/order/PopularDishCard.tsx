import React, { memo, useState, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Star, Heart } from 'lucide-react-native';
import { useCartStore } from '@/state/store';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import type { SpecialDish } from '../../mocks/types';
import RemoteImage from '../RemoteImage';

const CARD_W = 140;
const GREEN = '#118C4F';

interface PopularDishCardProps {
  dish: SpecialDish;
  onPress?: (dish: SpecialDish) => void;
}

/**
 * Section 5 — "Popular Dishes" card. Square image with a heart overlay, bold
 * title (2 lines), green star + rating next to price, and a centered ADD button
 * that flips to a − qty + stepper once the dish is in the cart.
 */
const PopularDishCard = memo(function PopularDishCard({ dish, onPress }: PopularDishCardProps) {
  const cart = useCartStore((s) => s.cart);
  const addToCart = useCartStore((s) => s.addToCart);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const [isFavourite, setIsFavourite] = useState(false);

  const item = cart.find((c) => c.id === dish.id);
  const qty = item?.quantity ?? 0;

  const handleAdd = useCallback(() => {
    addToCart(dish.id, dish.dishName, dish.price, '🍽️');
  }, [addToCart, dish.id, dish.dishName, dish.price]);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(dish)}
      activeOpacity={0.94}
      accessibilityRole="button"
      accessibilityLabel={`${dish.dishName}, ₹${dish.price}`}
    >
      <View style={styles.imageWrap}>
        <RemoteImage uri={dish.image} variant="dish" style={styles.image} />
        <TouchableOpacity
          style={styles.heartBtn}
          onPress={() => setIsFavourite((prev) => !prev)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
        >
          <Heart
            size={ms(16)}
            color={isFavourite ? '#E11D48' : '#FFFFFF'}
            fill={isFavourite ? '#E11D48' : 'rgba(0,0,0,0.25)'}
            strokeWidth={2.2}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <AppText style={styles.name} numberOfLines={2}>
          {dish.dishName}
        </AppText>
        <View style={styles.metricsRow}>
          <View style={styles.ratingRow}>
            <Star size={ms(11)} color={GREEN} fill={GREEN} strokeWidth={2.2} />
            <AppText style={styles.rating}>{dish.rating?.toFixed(1) ?? '4.0'}</AppText>
          </View>
          <AppText style={styles.price}>₹{dish.price.toLocaleString('en-IN')}</AppText>
        </View>

        {qty === 0 ? (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={handleAdd}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Add ${dish.dishName} to cart`}
          >
            <AppText style={styles.addText}>ADD</AppText>
          </TouchableOpacity>
        ) : (
          <View style={styles.stepper}>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => updateQuantity(dish.id, -1)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel="Decrease quantity"
            >
              <AppText style={styles.stepperSign}>−</AppText>
            </TouchableOpacity>
            <AppText style={styles.stepperQty}>{qty}</AppText>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => updateQuantity(dish.id, 1)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel="Increase quantity"
            >
              <AppText style={styles.stepperSign}>+</AppText>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

export default PopularDishCard;

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    borderRadius: ms(12),
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginRight: hs(14),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
  },
  imageWrap: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: vs(110),
    backgroundColor: '#F5F5F5',
  },
  heartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: ms(28),
    height: ms(28),
    borderRadius: ms(14),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  body: {
    padding: hs(10),
  },
  name: {
    fontSize: ms(13),
    fontWeight: '700',
    color: '#1E2022',
    lineHeight: ms(17),
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: vs(6),
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(3),
  },
  rating: {
    fontSize: ms(12),
    fontWeight: '700',
    color: '#1E2022',
  },
  price: {
    fontSize: ms(12),
    fontWeight: '700',
    color: '#1E2022',
  },
  addBtn: {
    alignSelf: 'center',
    marginTop: vs(8),
    borderWidth: 1.5,
    borderColor: GREEN,
    borderRadius: ms(6),
    paddingVertical: vs(4),
    paddingHorizontal: hs(28),
    backgroundColor: '#FFFFFF',
  },
  addText: {
    fontSize: ms(12),
    fontWeight: '800',
    color: GREEN,
    textAlign: 'center',
  },
  stepper: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(8),
    borderWidth: 1.5,
    borderColor: GREEN,
    borderRadius: ms(6),
    backgroundColor: '#FFFFFF',
  },
  stepperBtn: {
    width: ms(30),
    height: vs(26),
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperSign: {
    fontSize: ms(16),
    fontWeight: '800',
    color: GREEN,
  },
  stepperQty: {
    fontSize: ms(13),
    fontWeight: '800',
    color: '#1E2022',
    minWidth: ms(24),
    textAlign: 'center',
  },
});
