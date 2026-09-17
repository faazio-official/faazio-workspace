import React, { memo, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Home, Search, ShoppingCart, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '@/components/AppText';
import { hs, ms, vs, SCREEN_W } from '@/utils/responsive';
import { useCartStore } from '@/state/store';
import { foodTheme } from '../constants/theme';
import NavbarHomeShortcut from '@/components/shared/NavbarHomeShortcut';

export type FoodTab = 'Home' | 'Search';

const TABS: { name: FoodTab; icon: any }[] = [
  { name: 'Home', icon: Home },
  { name: 'Search', icon: Search },
];

interface FoodBottomNavProps {
  activeTab: FoodTab;
  onChange: (tab: FoodTab) => void;
  onCartPress?: () => void;
  onYouPress?: () => void;
  onHomePress?: () => void;
}

/**
 * Fixed bottom navigation. 2 tabs (Home / Search), icon over text, active tab
 * tinted with the brand color, plus a dedicated Cart item (with a count badge)
 * that opens the root Cart page, and a "You" item (left of Cart) that pushes
 * the root "You" account page.
 */
const FoodBottomNav = memo(function FoodBottomNav({
  activeTab,
  onChange,
  onCartPress,
  onYouPress,
  onHomePress,
}: FoodBottomNavProps) {
  const insets = useSafeAreaInsets();
  const [barHeight, setBarHeight] = useState(0);
  const cartCount = useCartStore((s) =>
    s.cart.reduce((acc, curr) => acc + curr.quantity, 0),
  );

  return (
    <View
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, vs(8)) }]}
      onLayout={(event) => setBarHeight(event.nativeEvent.layout.height)}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.name;
        const Icon = tab.icon;
        const tint = isActive ? foodTheme.primary : foodTheme.textMuted;
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.item}
            onPress={() => onChange(tab.name)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={tab.name}
            accessibilityState={{ selected: isActive }}
          >
            <Icon size={ms(22)} color={tint} strokeWidth={isActive ? 2.5 : 2} />
            <AppText style={[styles.label, isActive && styles.labelActive]}>{tab.name}</AppText>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        style={styles.item}
        onPress={onYouPress}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="You"
      >
        <User size={ms(22)} color={foodTheme.textMuted} strokeWidth={2} />
        <AppText style={styles.label}>You</AppText>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.item}
        onPress={onCartPress}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Cart"
      >
        <View>
          <ShoppingCart size={ms(22)} color={foodTheme.textMuted} strokeWidth={2} />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <AppText style={styles.cartBadgeText}>{cartCount}</AppText>
            </View>
          )}
        </View>
        <AppText style={styles.label}>Cart</AppText>
      </TouchableOpacity>
      {onHomePress && barHeight > 0 ? (
        <NavbarHomeShortcut
          centerX={SCREEN_W / 8}
          barHeight={barHeight}
          onPress={onHomePress}
        />
      ) : null}
    </View>
  );
});

export default FoodBottomNav;

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.18)',
    paddingTop: vs(8),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 12,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: vs(3),
  },
  label: {
    fontSize: ms(9.5),
    fontWeight: '600',
    color: foodTheme.textMuted,
  },
  labelActive: {
    fontWeight: '800',
    color: foodTheme.primary,
  },
  cartBadge: {
    position: 'absolute',
    top: -vs(6),
    right: -hs(10),
    minWidth: ms(18),
    height: ms(18),
    borderRadius: ms(9),
    paddingHorizontal: hs(4),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: foodTheme.primary,
  },
  cartBadgeText: {
    fontSize: ms(10),
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: ms(16),
  },
});
