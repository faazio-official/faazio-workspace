import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ShoppingCart, ArrowRight } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';

interface ViewCartPillProps {
  count: number;
  onPress: () => void;
}

/**
 * Compact, right-aligned white "View Cart" pill shown above the bottom edge on
 * restaurant screens once the restaurant's cart slice has items. Absolutely
 * positioned inside its screen; the app layout reserves the bottom safe-area
 * inset centrally, so no per-screen inset math is needed here.
 */
const ViewCartPill = memo(function ViewCartPill({ count, onPress }: ViewCartPillProps) {
  return (
    <View style={styles.stickyFooterWrapper}>
      <TouchableOpacity
        style={styles.viewCartBtn}
        onPress={onPress}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={`View cart, ${count} ${count === 1 ? 'item' : 'items'}`}
      >
        <ShoppingCart color={foodTheme.primary} size={ms(18)} />
        <AppText style={styles.viewCartText}>View Cart</AppText>
        <View style={styles.viewCartDivider} />
        <AppText style={styles.viewCartCount}>
          {count} {count === 1 ? 'item' : 'items'}
        </AppText>
        <ArrowRight color={foodTheme.primary} size={ms(16)} />
      </TouchableOpacity>
    </View>
  );
});

export default ViewCartPill;

const styles = StyleSheet.create({
  stickyFooterWrapper: {
    position: 'absolute',
    bottom: vs(16),
    right: hs(16),
  },
  viewCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    backgroundColor: '#fff',
    paddingHorizontal: hs(14),
    paddingVertical: vs(10),
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  viewCartText: { color: foodTheme.primary, fontSize: ms(14), fontWeight: 'bold' },
  viewCartDivider: { width: 1, height: vs(16), backgroundColor: '#E5E7EB' },
  viewCartCount: { color: foodTheme.primary, fontSize: ms(14), fontWeight: 'bold' },
});
