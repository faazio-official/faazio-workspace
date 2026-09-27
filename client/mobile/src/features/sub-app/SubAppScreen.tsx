import React, { useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import SubAppWrapper from '@/components/SubAppWrapper';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useCartStore, type CartItem } from '@/state/cartStore';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SubApp'>;

export function SubAppScreen({ navigation, route }: Props) {
  const subAppId = route.params?.subAppId;
  const initialVendorStoreId = route.params?.initialVendorStoreId;
  const cartItems = useCartStore((s) => s.cart);
  const addToCart = useCartStore((s) => s.addToCart);
  const storeUpdateQuantity = useCartStore((s) => s.updateQuantity);
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

  // A launcher passing an unknown/absent id must not blank the whole app.
  if (!subAppId) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackTitle}>Sub-app unavailable</Text>
        <Text style={styles.fallbackSub}>This section couldn&apos;t be opened.</Text>
        <TouchableOpacity style={styles.fallbackBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Text style={styles.fallbackBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ErrorBoundary
        scope="SubApp"
        onReset={() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] })}
      >
        <SubAppWrapper
          subAppId={subAppId}
          initialVendorStoreId={initialVendorStoreId}
          onExit={() => navigation.goBack()}
          addToCart={addToCart}
          cartItems={cartItems}
          setCartItems={setCartItems}
          updateCartQuantity={updateCartQuantity}
          onProductClick={(product) => navigation.navigate('ProductDetail', { product })}
          onSearchPress={(query) => navigation.navigate('Search', { subApp: subAppId, initialQuery: query })}
          onCartPress={() => navigation.navigate('Cart')}
        />
      </ErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 8,
  },
  fallbackSub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
  },
  fallbackBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1162D3',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  fallbackBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
