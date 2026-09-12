import React, { useCallback } from 'react';
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
export function CartScreen({ navigation }: Props) {
  const cartItems = useCartStore((s) => s.cart);
  const storeUpdateQuantity = useCartStore((s) => s.updateQuantity);
  const replaceCart = useCartStore((s) => s.replaceCart);
  const insets = useSafeAreaInsets();

  const setCartItems = useCallback(
    (action: CartItem[] | ((prev: CartItem[]) => CartItem[])) => {
      if (typeof action === 'function') {
        const prev = useCartStore.getState().cart;
        replaceCart(action(prev));
      } else {
        replaceCart(action);
      }
    },
    [replaceCart]
  );

  const handleGoToHub = useCallback(() => {
    navigation.navigate('MainTabs', { screen: 'Home' });
  }, [navigation]);

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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
});
