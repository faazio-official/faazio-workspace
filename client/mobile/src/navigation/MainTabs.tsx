import React, { Suspense, lazy } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { hs, vs, ms, SCREEN_W } from '@/utils/responsive';
import { Home, Heart, ShoppingBag, User } from 'lucide-react-native';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useCartStore } from '@/state/cartStore';
import AppText from '@/components/AppText';
import { HomeTabScreen } from '@/features/home/HomeTabScreen';
import { SplashFallback } from '@/components/SplashFallback';
import type { MainTabParamList } from '@/navigation/types';
import NavbarHomeShortcut from '@/components/shared/NavbarHomeShortcut';
import { neutral, parentRamp, semantic } from '@/theme/brandTokens';
import { ICON } from '@/theme/tokens';

const lazyNamed = <T extends { [K in string]: unknown }>(
  loader: () => Promise<T>,
  name: keyof T & string,
) => lazy(() => loader().then((m) => ({ default: m[name] as React.ComponentType<any> })));

const FavouritesTabScreen = lazyNamed(() => import('@/features/favourites/FavouritesTabScreen'), 'FavouritesTabScreen');
const AccountScreen = lazyNamed(() => import('@/features/profile/AccountScreen'), 'AccountScreen');
const CartTabScreen = lazyNamed(() => import('@/features/cart/CartTabScreen'), 'CartTabScreen');

const TAB_LABELS: Record<keyof MainTabParamList, string> = {
  Home: 'Home',
  Favourites: 'Favourites',
  Cart: 'Cart',
  You: 'You',
};

const TAB_ICONS: Record<keyof MainTabParamList, React.ComponentType<any>> = {
  Home,
  Favourites: Heart,
  Cart: ShoppingBag,
  You: User,
};

const TAB_BAR_PAD = hs(12);
const TAB_BAR_H = vs(60);
const ACTIVE_TINT = parentRamp.deep;
const INACTIVE_TINT = neutral.inkMuted;

function HubTabBar({ state, navigation }: BottomTabBarProps) {
  const tabBarH = TAB_BAR_H;
  const totalCartQty = useCartStore((s) => s.cart).reduce((acc, curr) => acc + curr.quantity, 0);

  return (
    <View style={[styles.tabBarWrap, { height: tabBarH }]}>
      <View style={styles.tabBarInner}>
        {state.routes.map((route, index) => {
          const name = route.name as keyof MainTabParamList;
          const isActive = state.index === index;
          const tint = isActive ? ACTIVE_TINT : INACTIVE_TINT;
          const Icon = TAB_ICONS[name];
          return (
            <TouchableOpacity
              key={route.key}
              onPress={() => navigation.navigate(name)}
              style={styles.tabItem}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={TAB_LABELS[name]}
            >
              <View>
                <Icon
                  size={ICON.lg}
                  color={tint}
                  strokeWidth={2}
                  fill={isActive ? tint : 'transparent'}
                />
                {name === 'Cart' && totalCartQty > 0 && (
                  <View style={styles.cartBadge}>
                    <AppText style={styles.cartBadgeText}>{totalCartQty > 99 ? '99+' : totalCartQty}</AppText>
                  </View>
                )}
              </View>
              <AppText style={[styles.tabLabel, isActive && { color: ACTIVE_TINT }]}>
                {TAB_LABELS[name]}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>
      {state.index !== 0 ? (
        <NavbarHomeShortcut
          centerX={TAB_BAR_PAD + (SCREEN_W - 2 * TAB_BAR_PAD) / 8}
          barHeight={tabBarH}
          onPress={() => navigation.navigate('Home')}
        />
      ) : null}
    </View>
  );
}

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  return (
    <View style={styles.entranceRoot}>
      <Suspense fallback={<SplashFallback />}>
        <Tab.Navigator
          tabBar={(props) => <HubTabBar {...props} />}
          screenOptions={{ headerShown: false, lazy: true }}
        >
          <Tab.Screen name="Home" component={HomeTabScreen} />
          <Tab.Screen name="Favourites" component={FavouritesTabScreen} />
          <Tab.Screen name="Cart" component={CartTabScreen} />
          <Tab.Screen name="You" component={AccountScreen} />
        </Tab.Navigator>
      </Suspense>
    </View>
  );
}

const styles = StyleSheet.create({
  entranceRoot: { flex: 1 },
  tabBarWrap: {
    backgroundColor: neutral.card,
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
    borderTopColor: neutral.border,
  },
  tabBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: vs(3),
  },
  tabLabel: {
    fontSize: ms(11),
    fontWeight: '600',
    color: INACTIVE_TINT,
  },
  cartBadge: {
    position: 'absolute',
    top: vs(-7),
    right: ms(-12),
    backgroundColor: semantic.danger,
    borderRadius: ms(9),
    minWidth: ms(18),
    height: ms(18),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(3),
    borderWidth: 2,
    borderColor: neutral.card,
    zIndex: 3,
  },
  cartBadgeText: {
    color: '#ffffff',
    fontSize: ms(11),
    fontWeight: '600',
  },
});