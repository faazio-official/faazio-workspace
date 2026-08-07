import React, { useCallback } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ProductDetailView from '@/features/product/ProductDetailView';
import { useCartStore } from '@/state/cartStore';
import { useFavoriteStore } from '@/state/favoriteStore';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetail'>;

export function ProductDetailScreen({ navigation, route }: Props) {
  const { product } = route.params;
  const addToCart = useCartStore((s) => s.addToCart);
  const cartItems = useCartStore((s) => s.cart);
  const updateCartQuantity = useCartStore((s) => s.updateQuantity);
  const favorites = useFavoriteStore((s) => s.favorites);
  const toggleFavorite = useFavoriteStore((s) => s.toggleFavorite);

  const handleClose = useCallback(() => navigation.goBack(), [navigation]);

  return (
    <ProductDetailView
      product={product}
      onClose={handleClose}
      addToCart={addToCart}
      cartItems={cartItems}
      updateCartQuantity={updateCartQuantity}
      favorites={favorites}
      toggleFavorite={toggleFavorite}
    />
  );
}
