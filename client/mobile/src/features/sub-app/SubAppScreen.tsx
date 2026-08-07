import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import SubAppWrapper from '@/components/SubAppWrapper';
import { useCartStore, type CartItem } from '@/state/cartStore';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SubApp'>;

export function SubAppScreen({ navigation, route }: Props) {
  const { subAppId } = route.params;
  const cartItems = useCartStore((s) => s.cart);
  const addToCart = useCartStore((s) => s.addToCart);
  const storeUpdateQuantity = useCartStore((s) => s.updateQuantity);
  const clearCart = useCartStore((s) => s.clearCart);
  const replaceCart = useCartStore((s) => s.replaceCart);

  const updateCartQuantity = useCallback(
    (id: string, delta: number) => storeUpdateQuantity(id, delta),
    [storeUpdateQuantity]
  );

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

  const handleReset = useCallback(() => {
    clearCart();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }, [clearCart, navigation]);

  return (
    <View style={styles.container}>
      <SubAppWrapper
        subAppId={subAppId}
        onExit={() => navigation.goBack()}
        addToCart={addToCart}
        cartItems={cartItems}
        setCartItems={setCartItems}
        updateCartQuantity={updateCartQuantity}
        handleReset={handleReset}
        setShowLocationRequestState={() => {}}
        setIsLoggedIn={() => {}}
        onProductClick={(product) => navigation.navigate('ProductDetail', { product })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
});
