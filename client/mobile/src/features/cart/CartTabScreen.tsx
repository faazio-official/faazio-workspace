import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import CartView from '@/features/cart/CartView';
import { useCartStore, type CartItem } from '@/state/cartStore';
import type { MainTabParamList, RootStackParamList } from '@/navigation/types';

/**
 * The Cart tab. Renders the shared cart/checkout wizard for the common cart;
 * restaurant-scoped carts still push the root `Cart` route so the back arrow
 * returns to the restaurant.
 */
export function CartTabScreen() {
  const insets = useSafeAreaInsets();
  const cartItems = useCartStore((s) => s.cart);
  const updateCartQuantity = useCartStore((s) => s.updateQuantity);
  const replaceCart = useCartStore((s) => s.replaceCart);
  const removeFromCart = useCartStore((s) => s.removeFromCart);
  const clearCart = useCartStore((s) => s.clearCart);
  const navigation = useNavigation<NavigationProp<RootStackParamList & MainTabParamList>>();

  const setCartItems = useCallback<React.Dispatch<React.SetStateAction<CartItem[]>>>(
    (action) => {
      const prev = useCartStore.getState().cart;
      const next = typeof action === 'function' ? action(prev) : action;
      replaceCart(next);
    },
    [replaceCart],
  );

  return (
    <View style={styles.container}>
      <CartView
        contentInset={insets.top}
        cartItems={cartItems}
        setCartItems={setCartItems}
        updateCartQuantity={updateCartQuantity}
        setActiveTab={() => {}}
        onBack={() => navigation.navigate('Home')}
        onGoToHub={() => navigation.navigate('MainTabs', { screen: 'Home' })}
        onTrackOrder={(orderId) => navigation.navigate('MyOrders', { highlightOrderId: orderId })}
        onClearItems={() => void clearCart()}
        onDeleteItem={removeFromCart}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
});