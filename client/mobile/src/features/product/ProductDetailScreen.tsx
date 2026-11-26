import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import CommonProductDetailView from '@/features/product/CommonProductDetailView';
import { gateway } from '@/services/api/GatewayClient';
import type { ProductView, ProductReviewSummary } from '@/services/api/GatewayClient';
import { applyActiveDiscount, useActiveDiscounts } from '@/services/pricing';
import { useCartStore } from '@/state/cartStore';
import { useFavoriteStore } from '@/state/favoriteStore';
import { useOrdersStore } from '@/state/ordersStore';
import { canReviewProduct } from '@/services/productReviews';
import { storeProfileToFoodRestaurant } from '@/features/food/utils/restaurantForProduct';
import type { SubAppId } from '@/state/uiStore';
import type { RootStackParamList } from '@/navigation/types';
import type { Product } from '@data/types';
import type { ReviewRow } from '@data/reviews/reviews';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetail'>;

export function ProductDetailScreen({ navigation, route }: Props) {
  const { product } = route.params;
  const addToCart = useCartStore((s) => s.addToCart);
  const cartItems = useCartStore((s) => s.cart);
  const updateCartQuantity = useCartStore((s) => s.updateQuantity);
  const favorites = useFavoriteStore((s) => s.favorites);
  const toggleFavorite = useFavoriteStore((s) => s.toggleFavorite);
  const orders = useOrdersStore((s) => s.orders);
  const serverOrders = useOrdersStore((s) => s.serverOrders);

  // Behavior analytics (ID-only, allowlisted); best-effort and a no-op in mock mode.
  useEffect(() => {
    if (product?.id) void gateway.trackEvent(product.id, 'view').catch(() => {});
  }, [product?.id]);

  // Price authority: re-resolve the canonical catalog row (base price) so an already-overlaid
  // object from a rail/search never gets the festival discount applied twice. Offline / on error
  // the passed product is used as-is.
  const [canonical, setCanonical] = useState<ProductView | undefined>(undefined);
  const [reviews, setReviews] = useState<ReviewRow[] | undefined>(undefined);
  const [reviewSummary, setReviewSummary] = useState<ProductReviewSummary | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  useEffect(() => {
    if (!product?.id || !gateway.remoteEnabled) {
      setCanonical(undefined);
      setReviews(undefined);
      setReviewSummary(undefined);
      setLoadFailed(false);
      return;
    }
    let active = true;
    setLoadFailed(false);
    gateway
      .getProduct(product.id)
      .then((r) => {
        if (!active || !r?.product) return;
        setCanonical(r.product);
        setReviews(r.reviews);
        void gateway
          .getProductReviewSummary(product.id)
          .then((summary) => {
            if (active) setReviewSummary(summary);
          })
          .catch(() => undefined);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, [product?.id, reloadToken]);

  const handleRetry = useCallback(() => setReloadToken((n) => n + 1), []);

  const discounts = useActiveDiscounts(canonical ? [canonical.id] : []);
  const pricedProduct = useMemo<Product | undefined>(() => {
    if (!product) return undefined;
    if (!canonical) return product;
    const priced = applyActiveDiscount(canonical, discounts[canonical.id]);
    // Canonical detail carries the richer PDP fields (brand, pack, gallery, variants, compliance).
    // Keep the passed object as the base so a storeId/shop the rail already knows is never lost.
    return {
      ...product,
      ...canonical,
      price: priced.price,
      originalPrice: priced.originalPrice,
      storeId: product.storeId ?? canonical.storeId,
    };
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
  const handleSelectVariant = useCallback(
    async (variantId: string) => {
      const result = await gateway.getProduct(variantId).catch(() => undefined);
      if (result?.product) navigation.push('ProductDetail', { product: result.product });
    },
    [navigation],
  );

  const canReview = useMemo(
    () => (product?.id ? canReviewProduct(product.id) : false),
    [product?.id, orders, serverOrders],
  );
  const handleWriteReview = useCallback(() => {
    if (!product?.id) return;
    navigation.navigate('RateProduct', { productId: product.id, productName: product.name });
  }, [navigation, product?.id, product?.name]);

  // FOOD PDPs need a real restaurant object to open the restaurant profile. The product carries the
  // venue id (storeId) from its menu/search source; resolve the public store row and adapt it. No
  // invented restaurant when the id is absent or the read fails.
  const [restaurant, setRestaurant] = useState<
    ReturnType<typeof storeProfileToFoodRestaurant> | undefined
  >(undefined);
  useEffect(() => {
    if (product?.app !== 'FOOD') {
      setRestaurant(undefined);
      return;
    }
    const storeId = product.storeId ?? canonical?.storeId;
    if (!storeId) {
      setRestaurant(undefined);
      return;
    }
    let active = true;
    gateway
      .getStore(storeId)
      .then((row) => {
        if (!active) return;
        setRestaurant(row ? storeProfileToFoodRestaurant(row) : undefined);
      })
      .catch(() => {
        if (active) setRestaurant(undefined);
      });
    return () => {
      active = false;
    };
  }, [product?.app, product?.storeId, canonical?.storeId]);
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
      onSelectVariant={handleSelectVariant}
      restaurantId={restaurant?.id}
      reviews={reviews}
      onWriteReview={canReview ? handleWriteReview : undefined}
      stock={canonical?.stock}
      onRetry={loadFailed ? handleRetry : undefined}
      reviewSummary={reviewSummary}
      activeDiscountPercent={canonical ? discounts[canonical.id]?.discountPercent : undefined}
      onUploadPrescription={
        product.app === 'PHARMA'
          ? () => navigation.navigate('PrescriptionFlow', { presetVendorId: product.storeId })
          : undefined
      }
    />
  );
}
