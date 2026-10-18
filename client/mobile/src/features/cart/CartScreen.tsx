import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import CartView from '@/features/cart/CartView';
import { useCartStore, type CartItem } from '@/state/cartStore';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Cart'>;

/**
 * Central "Your Cart" checkout page. Pushed on the root stack from any sub-app
 * or tab so the back arrow (`onBack`) naturally returns to the previous screen.
 * Renders the shared CartView (BAG -> ADDRESS -> PAYMENT -> RECEIPT wizard).
 */
export function CartScreen({ navigation, route }: Props) {
  const { restaurantId, restaurantName, couponCode } = route.params ?? {};
  const allItems = useCartStore((s) => s.cart);
  const storeUpdateQuantity = useCartStore((s) => s.updateQuantity);
  const replaceCart = useCartStore((s) => s.replaceCart);
  const clearRestaurantCart = useCartStore((s) => s.clearRestaurantCart);
  const removeFromCart = useCartStore((s) => s.removeFromCart);
  const insets = useSafeAreaInsets();

  // Scoped mode ("redirected from a restaurant") shows only that restaurant's
  // lines; the common cart (no params) is unchanged and still shows them.
  const cartItems = useMemo(
    () => (restaurantId ? allItems.filter((i) => i.restaurantId === restaurantId) : allItems),
    [allItems, restaurantId],
  );

  // Scope-aware write-back: in scoped mode only the scoped slice is replaced,
  // so checkout/clear can never wipe other restaurants'/common items.
  const setCartItems = useCallback(
    (action: CartItem[] | ((prev: CartItem[]) => CartItem[])) => {
      const prevAll = useCartStore.getState().cart;
      const prevScoped = restaurantId
        ? prevAll.filter((i) => i.restaurantId === restaurantId)
        : prevAll;
      const nextScoped = typeof action === 'function' ? action(prevScoped) : action;
      if (restaurantId) {
        const others = prevAll.filter((i) => i.restaurantId !== restaurantId);
        replaceCart([...others, ...nextScoped]);
      } else {
        replaceCart(nextScoped);
      }
    },
    [replaceCart, restaurantId]
  );

  const handleClearScoped = useCallback(() => {
    if (restaurantId) clearRestaurantCart(restaurantId);
  }, [clearRestaurantCart, restaurantId]);

  const handleGoToHub = useCallback(() => {
    navigation.navigate('MainTabs', { screen: 'Home' });
  }, [navigation]);

  const handleTrackOrder = useCallback(
    (orderId: string) => {
      navigation.navigate('MyOrders', { highlightOrderId: orderId });
    },
    [navigation],
  );

  return (
    <View style={styles.container}>
      <CartView
        contentInset={insets.top}
        cartItems={cartItems}
        setCartItems={setCartItems}
        updateCartQuantity={storeUpdateQuantity}
        setActiveTab={() => {}}
        onBack={() => navigation.goBack()}
        onGoToHub={handleGoToHub}
        onTrackOrder={handleTrackOrder}
        restaurantName={restaurantName}
        initialCouponCode={couponCode}
        onClearItems={restaurantId ? handleClearScoped : undefined}
        onDeleteItem={restaurantId ? removeFromCart : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
});
