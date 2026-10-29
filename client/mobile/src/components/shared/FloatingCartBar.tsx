import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useCartStore } from '@/state/store';
import AppText from '@/components/AppText';
import InfoButton from './InfoButton';
import { hs, ms, vs } from '@/utils/responsive';

interface FloatingCartBarProps {
  onPress?: () => void;
  onViewMenu?: () => void;
  accentColor?: string;
  bottomOffset?: number;
  /** Opt-in registry key that renders a small "i" guidance badge in the bar. */
  infoKey?: string;
}

/**
 * Floating checkout bar anchored above the bottom tab bar. Only rendered when
 * the shared cart has items. Left: item emoji + label + "View Full Cart" link;
 * right: solid checkout button with count + total.
 */
const FloatingCartBar = memo(function FloatingCartBar({
  onPress,
  onViewMenu,
  accentColor = '#FF4500',
  bottomOffset = 104,
  infoKey,
}: FloatingCartBarProps) {
  const cart = useCartStore((s) => s.cart);

  if (cart.length === 0) return null;

  const totalQty = cart.reduce((acc, curr) => acc + curr.quantity, 0);
  const totalPrice = cart.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
  const first = cart[0];

  return (
    <View style={[styles.bar, { bottom: bottomOffset }]}>
      <TouchableOpacity
        style={styles.left}
        onPress={onViewMenu}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="View full cart"
      >
        <View style={styles.thumb}>
          <AppText style={styles.thumbEmoji}>{first.emoji}</AppText>
        </View>
        <View style={styles.leftText}>
          <AppText style={styles.itemName} numberOfLines={1}>
            {first.name}
          </AppText>
          <View style={styles.menuRow}>
            <AppText style={[styles.menuLink, { color: accentColor }]}>View Full Cart</AppText>
            <ChevronRight size={ms(13)} color={accentColor} strokeWidth={2.4} />
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.checkoutBtn}
        onPress={onPress}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel={`Checkout, ${totalQty} item, ${totalPrice} rupees`}
      >
        <AppText style={styles.checkoutCount}>
          {totalQty} Item{totalQty > 1 ? 's' : ''} | ₹{totalPrice.toLocaleString('en-IN')}
        </AppText>
        <View style={styles.checkoutRow}>
          <AppText style={styles.checkoutLabel}>Checkout</AppText>
          <ChevronRight size={ms(14)} color="#FFFFFF" strokeWidth={2.8} />
        </View>
      </TouchableOpacity>

      {infoKey ? <InfoButton variant="badge" contentKey={infoKey} /> : null}
    </View>
  );
});

export default FloatingCartBar;

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: hs(16),
    right: hs(16),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: ms(16),
    paddingHorizontal: hs(12),
    paddingVertical: vs(10),
    gap: hs(10),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
  },
  thumb: {
    width: ms(42),
    height: ms(42),
    borderRadius: ms(21),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  thumbEmoji: {
    fontSize: ms(20),
  },
  leftText: {
    flex: 1,
    gap: vs(2),
  },
  itemName: {
    fontSize: ms(12.5),
    fontWeight: '700',
    color: '#111827',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(2),
  },
  menuLink: {
    fontSize: ms(11),
    fontWeight: '700',
  },
  checkoutBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#48A440',
    borderRadius: ms(12),
    paddingHorizontal: hs(14),
    paddingVertical: vs(8),
    minWidth: hs(104),
  },
  checkoutCount: {
    fontSize: ms(10.5),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  checkoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(2),
    marginTop: vs(1),
  },
  checkoutLabel: {
    fontSize: ms(13),
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
