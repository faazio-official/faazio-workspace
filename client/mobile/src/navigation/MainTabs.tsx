import React, { Suspense, lazy } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import Animated from 'react-native-reanimated';
import { hs, vs, ms, SCREEN_W } from '@/utils/responsive';
import { Home, Heart, ShoppingBag, User } from 'lucide-react-native';
import { createBottomTabNavigator, type BottomTabBarProps, BottomTabBarHeightCallbackContext } from '@react-navigation/bottom-tabs';
import { useCartStore } from '@/state/cartStore';
import AppText from '@/components/AppText';
import { HomeTabScreen } from '@/features/home/HomeTabScreen';
import { SplashFallback } from '@/components/SplashFallback';
import type { MainTabParamList } from '@/navigation/types';
import NavbarHomeShortcut from '@/components/shared/NavbarHomeShortcut';
import { neutral, parentRamp, semantic } from '@/theme/brandTokens';
import { ICON } from '@/theme/tokens';
import { FLOATING_NAV } from '@/theme/spacing';
import { useThemeMode } from '@/hooks/useThemeMode';
import { revealNavBar, useNavBarHideStyle } from '@/hooks/useAutoHideNavBar';

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
/** Capsule width once both side margins are taken off the screen. */
const CAPSULE_W = SCREEN_W - 2 * FLOATING_NAV.MARGIN;
function HubTabBar({ state, navigation }: BottomTabBarProps) {
  const { palette } = useThemeMode();
  const reportHeight = React.useContext(BottomTabBarHeightCallbackContext);
  const tabBarH = TAB_BAR_H;
  const totalCartQty = useCartStore((s) => s.cart).reduce((acc, curr) => acc + curr.quantity, 0);
  // Slide the capsule away on scroll-down (the same gesture that collapses the Home header).
  // Clear the raised Home shortcut (~ms(48)) so it hides fully too.
  const hideStyle = useNavBarHideStyle(tabBarH + FLOATING_NAV.GAP + ms(56));

  // A fresh tab starts with the nav shown, never inherited-hidden from the previous tab.
  React.useEffect(() => {
    revealNavBar();
  }, [state.index]);

  return (
    <Animated.View
      style={[styles.tabBarDock, { paddingBottom: FLOATING_NAV.GAP }, hideStyle]}
      pointerEvents="box-none"
      onLayout={(event) => reportHeight?.(event.nativeEvent.layout.height)}
    >
      <View
        style={[
          styles.tabBarWrap,
          {
            height: tabBarH,
            backgroundColor: palette.card,
            borderColor: palette.border,
          },
        ]}
      >
        <View style={styles.tabBarInner}>
          {state.routes.map((route, index) => {
            const name = route.name as keyof MainTabParamList;
            const isActive = state.index === index;
            const tint = isActive ? palette.accentStrong : palette.textMuted;
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
                    <View style={[styles.cartBadge, { borderColor: palette.card }]}>
                      <AppText style={styles.cartBadgeText}>{totalCartQty > 99 ? '99+' : totalCartQty}</AppText>
                    </View>
                  )}
                </View>
                <AppText style={[styles.tabLabel, { color: tint }]}>
                  {TAB_LABELS[name]}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </View>
        {state.index !== 0 ? (
          <NavbarHomeShortcut
            centerX={TAB_BAR_PAD + (CAPSULE_W - 2 * TAB_BAR_PAD) / 8}
            barHeight={tabBarH}
            onPress={() => navigation.navigate('Home')}
          />
        ) : null}
      </View>
    </Animated.View>
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
  tabBarDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    backgroundColor: 'transparent',
    paddingHorizontal: FLOATING_NAV.MARGIN,
  },
  tabBarWrap: {
    backgroundColor: neutral.card,
    borderRadius: ms(28),
    paddingHorizontal: TAB_BAR_PAD,
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: neutral.border,
    overflow: 'visible',
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