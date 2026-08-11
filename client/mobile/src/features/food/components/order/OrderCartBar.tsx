import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useCartStore } from '@/state/store';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import RemoteImage from '../RemoteImage';

const GREEN = '#118C4F';

interface OrderCartBarProps {
  onPress?: () => void;
  bottomOffset?: number;
}

/**
 * Section 9 — floating cart bar anchored above the bottom nav. Only rendered
 * when the shared cart has items. Left: 40px circular food thumbnail. Middle:
 * "N Items in cart" + total. Right: solid green "View Cart >" button.
 */
const OrderCartBar = memo(function OrderCartBar({
  onPress,
  bottomOffset = 80,
}: OrderCartBarProps) {
  const cart = useCartStore((s) => s.cart);

  if (cart.length === 0) return null;

  const totalQty = cart.reduce((acc, curr) => acc + curr.quantity, 0);
  const totalPrice = cart.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
  const first = cart[0];

  return (
    <View style={[styles.bar, { bottom: bottomOffset }]}>
      <View style={styles.thumb}>
        {first.imageUrl ? (
          <RemoteImage uri={first.imageUrl} variant="dish" style={styles.thumbImage} />
        ) : (
          <AppText style={styles.thumbEmoji}>{first.emoji}</AppText>
        )}
      </View>
      <View style={styles.middle}>
        <AppText style={styles.itemCount} numberOfLines={1}>
          {totalQty} Item{totalQty > 1 ? 's' : ''} in cart
        </AppText>
        <AppText style={styles.total}>₹{totalPrice.toLocaleString('en-IN')}</AppText>
      </View>
      <TouchableOpacity
        style={styles.viewCartBtn}
        onPress={onPress}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel={`View cart, ${totalQty} item, ${totalPrice} rupees`}
      >
        <AppText style={styles.viewCartText}>View Cart &gt;</AppText>
      </TouchableOpacity>
    </View>
  );
});

export default OrderCartBar;

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: hs(16),
    right: hs(16),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: ms(12),
    padding: hs(12),
    gap: hs(10),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  thumb: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbEmoji: {
    fontSize: ms(20),
  },
  middle: {
    flex: 1,
    paddingLeft: hs(2),
    gap: vs(1),
  },
  itemCount: {
    fontSize: ms(13),
    fontWeight: '700',
    color: '#1E2022',
  },
  total: {
    fontSize: ms(11),
    fontWeight: '400',
    color: '#666666',
  },
  viewCartBtn: {
    backgroundColor: GREEN,
    borderRadius: ms(8),
    paddingHorizontal: hs(16),
    paddingVertical: vs(10),
  },
  viewCartText: {
    fontSize: ms(12),
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
