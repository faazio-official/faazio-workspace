import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import CartView from '@/features/cart/CartView';
import { CompactHubHeader } from '@/features/home/CompactHubHeader';
import { useCartStore, type CartItem } from '@/state/cartStore';
import { NONHOME_H } from '@/features/home/hubHeader';
import type { MainTabParamList, RootStackParamList } from '@/navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Cart'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function CartTabScreen({ navigation }: Props) {
  const cartItems = useCartStore((s) => s.cart);
  const storeUpdateQuantity = useCartStore((s) => s.updateQuantity);
  const replaceCart = useCartStore((s) => s.replaceCart);

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

  const handleSetActiveTab = useCallback(
    (tab: 'Home' | 'Categories' | 'Explore' | 'Account' | 'Cart') => {
      if (tab === 'Explore') {
        navigation.navigate('Categories');
        return;
      }
      navigation.navigate(tab);
    },
    [navigation]
  );

  return (
    <View style={styles.container}>
      <CompactHubHeader onLocationPress={() => navigation.navigate('Location')} />
      <CartView
        contentInset={NONHOME_H}
        cartItems={cartItems}
        setCartItems={setCartItems}
        updateCartQuantity={storeUpdateQuantity}
        setActiveTab={handleSetActiveTab}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
});
