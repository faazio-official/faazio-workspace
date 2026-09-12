import React, { useCallback } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import CommonProductDetailView from '@/features/product/CommonProductDetailView';
import { useCartStore } from '@/state/cartStore';
import { useFavoriteStore } from '@/state/favoriteStore';
import type { SubAppId } from '@/state/uiStore';
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
  const appToSubApp: Record<string, SubAppId> = {
    FOOD: 'FOOD',
    MART: 'FA_MART',
    PHARMA: 'PHARMA',
  };
  const handleSearch = useCallback(
    () => navigation.navigate('Search', { subApp: product ? (appToSubApp[product.app] ?? 'HOME') : 'HOME' }),
    [navigation, product, appToSubApp],
  );
  const handleCart = useCallback(() => navigation.navigate('Cart'), [navigation]);

  return (
    <CommonProductDetailView
      product={product}
      onClose={handleClose}
      onSearch={handleSearch}
      onCart={handleCart}
      addToCart={addToCart}
      cartItems={cartItems}
      updateCartQuantity={updateCartQuantity}
      favorites={favorites}
      toggleFavorite={toggleFavorite}
    />
  );
}
