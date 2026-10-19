import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import CommonProductDetailView from '@/features/product/CommonProductDetailView';
import { gateway } from '@/services/api/GatewayClient';
import { applyActiveDiscount, useActiveDiscounts } from '@/services/pricing';
import { useCartStore } from '@/state/cartStore';
import { useFavoriteStore } from '@/state/favoriteStore';
import { getDiningRestaurantForProduct } from '@/features/food/utils/restaurantForProduct';
import type { SubAppId } from '@/state/uiStore';
import type { RootStackParamList } from '@/navigation/types';
import type { Product } from '@data/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetail'>;

export function ProductDetailScreen({ navigation, route }: Props) {
  const { product } = route.params;
  const addToCart = useCartStore((s) => s.addToCart);
  const cartItems = useCartStore((s) => s.cart);
  const updateCartQuantity = useCartStore((s) => s.updateQuantity);
  const favorites = useFavoriteStore((s) => s.favorites);
  const toggleFavorite = useFavoriteStore((s) => s.toggleFavorite);

  // Behavior analytics (ID-only, allowlisted); best-effort and a no-op in mock mode.
  useEffect(() => {
    if (product?.id) void gateway.trackEvent(product.id, 'view').catch(() => {});
  }, [product?.id]);

  // Price authority: re-resolve the canonical catalog row (base price) so an already-overlaid
  // object from a rail/search never gets the festival discount applied twice. Offline / on error
  // the passed product is used as-is.
  const [canonical, setCanonical] = useState<Product | undefined>(undefined);
  useEffect(() => {
    if (!product?.id || !gateway.remoteEnabled) {
      setCanonical(undefined);
      return;
    }
    let active = true;
    gateway
      .getProduct(product.id)
      .then((r) => {
        if (active && r?.product) setCanonical(r.product);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [product?.id]);

  const discounts = useActiveDiscounts(canonical ? [canonical.id] : []);
  const pricedProduct = useMemo<Product | undefined>(() => {
    if (!product) return undefined;
    if (!canonical) return product;
    const priced = applyActiveDiscount(canonical, discounts[canonical.id]);
    // Keep the richer passed object (storeId/shop/…) but take the server's price authority.
    return { ...product, price: priced.price, originalPrice: priced.originalPrice };
  }, [product, canonical, discounts]);

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
  const handleCart = useCallback(() => navigation.navigate('Cart', {}), [navigation]);
  const handleViewVendor = useCallback(
    (storeId: string) => {
      // A Pharma store opens its canonical pharmacy profile (STORE_TOP + reviews + Rx FAB); Mart
      // stores open the Mart sub-app pinned to that vendor.
      if (product?.app === 'PHARMA') {
        navigation.navigate('MedicalShopDetails', { storeId });
        return;
      }
      navigation.navigate('SubApp', { subAppId: 'FA_MART', initialVendorStoreId: storeId });
    },
    [navigation, product?.app],
  );
  const handleOpenProduct = useCallback(
    (p: Product) => navigation.push('ProductDetail', { product: p }),
    [navigation],
  );

  const restaurant = useMemo(
    () => (product?.app === 'FOOD' ? getDiningRestaurantForProduct(product) : undefined),
    [product],
  );
  const handleViewRestaurant = useCallback(() => {
    if (!restaurant) return;
    navigation.navigate('FoodApp', {
      screen: 'RestaurantProfile',
      params: { restaurant },
    });
  }, [navigation, restaurant]);

  return (
    <CommonProductDetailView
      product={pricedProduct}
      onClose={handleClose}
      onSearch={handleSearch}
      onCart={handleCart}
      addToCart={addToCart}
      cartItems={cartItems}
      updateCartQuantity={updateCartQuantity}
      favorites={favorites}
      toggleFavorite={toggleFavorite}
      onViewVendor={handleViewVendor}
      onViewRestaurant={handleViewRestaurant}
      onOpenProduct={handleOpenProduct}
      restaurantId={restaurant?.id}
    />
  );
}
