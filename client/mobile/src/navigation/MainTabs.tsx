import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { Home, LayoutGrid, Heart, ShoppingBag, User } from 'lucide-react-native';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useCartStore } from '@/state/cartStore';
import AppText from '@/components/AppText';
import { HomeTabScreen } from '@/features/home/HomeTabScreen';
import { CategoriesTabScreen } from '@/features/catalog/CategoriesTabScreen';
import { FavouritesTabScreen } from '@/features/favourites/FavouritesTabScreen';
import { AccountTabScreen } from '@/features/profile/AccountTabScreen';
import { CartTabScreen } from '@/features/cart/CartTabScreen';
import type { MainTabParamList } from '@/navigation/types';

const TAB_COLORS: Record<keyof MainTabParamList, string> = {
  Home: '#2F80ED',
  Categories: '#27AE60',
  Favourites: '#FF4A6B',
  Account: '#6C5CE7',
  Cart: '#F2994A',
};

const TAB_LABELS: Record<keyof MainTabParamList, string> = {
  Home: 'Home',
  Categories: 'Categories',
  Favourites: 'Favourites',
  Account: 'Account',
  Cart: 'Cart',
};

const TAB_ICONS: Record<keyof MainTabParamList, React.ComponentType<any>> = {
  Home,
  Categories: LayoutGrid,
  Favourites: Heart,
  Account: User,
  Cart: ShoppingBag,
};

const TAB_BAR_PAD = hs(12);
const TAB_BAR_H = vs(60);
const INACTIVE_TINT = '#94a3b8';

function HubTabBar({ state, navigation }: BottomTabBarProps) {
  const totalCartQty = useCartStore((s) => s.cart).reduce((acc, curr) => acc + curr.quantity, 0);

  return (
    <View style={styles.tabBarWrap}>
      <View style={styles.tabBarInner}>
        {state.routes.map((route, index) => {
          const name = route.name as keyof MainTabParamList;
          const isActive = state.index === index;
          const tint = isActive ? TAB_COLORS[name] : INACTIVE_TINT;
          const Icon = TAB_ICONS[name];
          return (
            <TouchableOpacity
              key={route.key}
              onPress={() => navigation.navigate(name)}
              style={styles.tabItem}
              activeOpacity={0.75}
            >
              <View>
                <Icon
                  size={ms(24)}
                  color={tint}
                  strokeWidth={isActive ? 2.5 : 2}
                  fill={isActive ? tint : 'transparent'}
                />
                {name === 'Cart' && totalCartQty > 0 && (
                  <View style={styles.cartBadge}>
                    <AppText style={styles.cartBadgeText}>{totalCartQty}</AppText>
                  </View>
                )}
              </View>
              <AppText style={[styles.tabLabel, isActive && { color: TAB_COLORS[name], fontWeight: '900' }]}>
                {TAB_LABELS[name]}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  return (
    <View style={styles.entranceRoot}>
      <Tab.Navigator
        tabBar={(props) => <HubTabBar {...props} />}
        screenOptions={{ headerShown: false, lazy: true }}
      >
        <Tab.Screen name="Home" component={HomeTabScreen} />
        <Tab.Screen name="Categories" component={CategoriesTabScreen} />
        <Tab.Screen name="Favourites" component={FavouritesTabScreen} />
        <Tab.Screen name="Account" component={AccountTabScreen} />
        <Tab.Screen name="Cart" component={CartTabScreen} />
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  entranceRoot: { flex: 1 },
  tabBarWrap: {
    height: TAB_BAR_H,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: ms(18),
    borderTopRightRadius: ms(18),
    paddingHorizontal: TAB_BAR_PAD,
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.15)',
  },
  tabBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: vs(3),
  },
  tabLabel: {
    fontSize: ms(9),
    fontWeight: '700',
    color: 'rgba(148,163,184,0.9)',
    letterSpacing: 0.2,
  },
  cartBadge: {
    position: 'absolute',
    top: vs(-7),
    right: ms(-12),
    backgroundColor: '#e11d48',
    borderRadius: ms(9),
    minWidth: ms(18),
    height: ms(18),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(3),
    borderWidth: 2,
    borderColor: '#ffffff',
    zIndex: 3,
  },
  cartBadgeText: {
    color: '#ffffff',
    fontSize: ms(8),
    fontWeight: '900',
  },
});
