import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Home, Search, UtensilsCrossed, ShoppingBag } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';

export type FoodTab = 'Home' | 'Search' | 'Dining' | 'FoodOrder';

const TABS: { name: FoodTab; icon: any }[] = [
  { name: 'Home', icon: Home },
  { name: 'Search', icon: Search },
  { name: 'Dining', icon: UtensilsCrossed },
  { name: 'FoodOrder', icon: ShoppingBag },
];

interface FoodBottomNavProps {
  activeTab: FoodTab;
  onChange: (tab: FoodTab) => void;
}

/**
 * Section 7 — fixed bottom navigation. 4 tabs (Home / Search / Dining /
 * FoodOrder), icon over text, active tab tinted with the brand color.
 */
const FoodBottomNav = memo(function FoodBottomNav({ activeTab, onChange }: FoodBottomNavProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, vs(8)) }]}>
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
    backgroundColor: foodTheme.background,
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
});
