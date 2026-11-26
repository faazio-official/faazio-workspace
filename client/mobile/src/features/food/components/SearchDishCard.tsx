import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';
import { useCartStore } from '@/state/store';
import AppText from '@/components/AppText';
import AddToCartControl from '@/components/shared/AddToCartControl';
import { localizedDishName } from '@/lib/localizedText';
import { useLanguageStore } from '@/state/languageStore';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';
import type { SpecialDish } from '../types';
import RemoteImage from './RemoteImage';

interface SearchDishCardProps {
  dish: SpecialDish;
  onPress?: (dish: SpecialDish) => void;
  /** Optional strikethrough "original" price shown beside the real price (offers view). */
  oldPrice?: number;
  /** When set, adds from this card are tagged to the restaurant's isolated cart. */
  restaurantId?: string;
}

/**
 * Cart thumbnails render an icon tile; dish items use the dining icon key
 * until the cart store gains image support.
 */
const CART_ICON_KEY = 'dining';

/**
 * Search result dish card — row layout per the Dishes view spec: square
 * thumbnail left, details right (title + price, source restaurant, rating)
 * with the shared "Add" pill that flips into a `− qty +` stepper once the dish
 * is in the cart. Renders edge-to-edge (no horizontal gutter).
 */
const SearchDishCard = memo(function SearchDishCard({ dish, onPress, oldPrice, restaurantId }: SearchDishCardProps) {
  const cart = useCartStore((s) => s.cart);
  const addToCart = useCartStore((s) => s.addToCart);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  const quantity = cart.find((i) => i.id === dish.id)?.quantity ?? 0;
  const language = useLanguageStore((s) => s.language);
  const dishName = localizedDishName(dish, language);

  const handleAdd = () => {
    addToCart(dish.id, dish.dishName, dish.price, CART_ICON_KEY, restaurantId);
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(dish)}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`${dishName}, by ${dish.restaurant}, ₹${dish.price}`}
    >
      <View style={styles.imageWrap}>
        <RemoteImage uri={dish.image} variant="dish" style={styles.image} />
      </View>

      <View style={styles.details}>
        <View style={styles.titleRow}>
          <AppText style={styles.name} numberOfLines={1}>
            {dishName}
          </AppText>
          <View style={styles.priceCol}>
            {oldPrice !== undefined ? (
              <AppText style={styles.oldPrice}>₹{oldPrice.toLocaleString('en-IN')}</AppText>
            ) : null}
            <AppText style={styles.price}>₹{dish.price.toLocaleString('en-IN')}</AppText>
          </View>
        </View>

        <AppText style={styles.restaurant} numberOfLines={1}>
          By {dish.restaurant}
        </AppText>

        <View style={styles.metricsRow}>
          {dish.rating !== undefined ? (
            <View style={styles.ratingBadge}>
              <Star size={ms(10)} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2.5} />
              <AppText style={styles.ratingText}>{dish.rating.toFixed(1)}</AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.actionRow}>
          <AddToCartControl
            quantity={quantity}
            onAdd={handleAdd}
            onIncrement={() => updateQuantity(dish.id, 1)}
            onDecrement={() => updateQuantity(dish.id, -1)}
            accent={foodTheme.primaryDeep}
            onAccent={foodTheme.white}
            variant="outline"
            compact
            label={dishName}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default SearchDishCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: hs(12),
    backgroundColor: '#FFFFFF',
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: '#F0F0F0',
    marginHorizontal: 0,
    marginBottom: vs(12),
  },
  imageWrap: {
    width: ms(100),
    height: ms(100),
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: ms(12),
    backgroundColor: foodTheme.divider,
  },
  details: {
    flex: 1,
    paddingLeft: hs(12),
    gap: vs(4),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: hs(6),
  },
  name: {
    flex: 1,
    fontSize: ms(15),
    fontWeight: '700',
    color: foodTheme.textPrimary,
    lineHeight: ms(19),
  },
  price: {
    fontSize: ms(16),
    fontWeight: '800',
    color: foodTheme.textPrimary,
  },
  priceCol: {
    alignItems: 'flex-end',
    gap: vs(1),
  },
  oldPrice: {
    fontSize: ms(11),
    fontWeight: '600',
    color: '#999999',
    textDecorationLine: 'line-through',
  },
  restaurant: {
    fontSize: ms(11.5),
    fontWeight: '400',
    color: '#666666',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(5),
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(3),
    backgroundColor: foodTheme.ratingGreen,
    borderRadius: ms(4),
    paddingHorizontal: hs(6),
    paddingVertical: vs(2),
  },
  ratingText: {
    color: '#FFFFFF',
    fontSize: ms(11),
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
