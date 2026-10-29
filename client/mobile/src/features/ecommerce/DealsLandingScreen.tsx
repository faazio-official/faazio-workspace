import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Dimensions, ActivityIndicator, type ListRenderItemInfo } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { hs, ms, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import AppText from '@/components/AppText';
import InfoButton from '@/components/shared/InfoButton';
import type { Product } from '@data/types';
import { gateway, type HomeCampaignDetail } from '@/services/api/GatewayClient';
import { adCampaigns, getCampaignProducts, getCampaignStore } from '@data/home/campaigns';
import { getStoreById } from '@data/directory/stores';
import { isDiscounted } from '@/services/categoryVendors';
import { applyActiveDiscounts, useActiveDiscounts } from '@/services/pricing';
import { useCartStore } from '@/state/cartStore';
import type { RootStackParamList } from '@/navigation/types';
import MartProductCard from '@/features/ecommerce/cards/MartProductCard';
import SponsoredRail from '@/components/shared/SponsoredRail';

type Props = NativeStackScreenProps<RootStackParamList, 'DealsLanding'>;

const CARD_GAP = hs(12);
const SCREEN_W = Dimensions.get('window').width;
const GRID_CARD_W = (SCREEN_W - hs(32) - CARD_GAP) / 2;

/**
 * Deals landing page — one page, four entry modes:
 * - `campaign`: a brand campaign's full product grid (from the Home "Deals of the
 *   day" carousel "View all").
 * - `discounts`: a vendor's discounted products (from the Mart vendor profile
 *   "View All").
 * - `martDeals` / `martEssentials`: a Mart rail's full product list (from the rail
 *   "View All"), catalog-resolved from the passed `productIds`.
 */
export function DealsLandingScreen({ navigation, route }: Props) {
  const { mode, campaignId, storeId, productIds, title: routeTitle } = route.params;
  const insets = useSafeAreaInsets();
  const cartItems = useCartStore((s) => s.cart);
  const addToCart = useCartStore((s) => s.addToCart);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  const isListMode = mode === 'martDeals' || mode === 'martEssentials';

  const campaign = useMemo(
    () => (mode === 'campaign' ? adCampaigns.find((c) => c.id === campaignId) : undefined),
    [mode, campaignId],
  );
  // Server-backed campaign drill-in (`GET /home/campaigns/{id}`, portal-published on the SDUI
  // `hotBrandDeals` section). `getHomeCampaign` falls back to the `@data` fixture offline, so this
  // resolves even without the gateway; the local `campaign` above is the last-resort fallback.
  const [campaignView, setCampaignView] = useState<HomeCampaignDetail | null>(null);
  const [campaignLoading, setCampaignLoading] = useState(false);
  useEffect(() => {
    if (mode !== 'campaign' || !campaignId) {
      setCampaignView(null);
      setCampaignLoading(false);
      return;
    }
    let active = true;
    setCampaignLoading(true);
    gateway
      .getHomeCampaign(campaignId)
      .then((view) => {
        if (active) setCampaignView(view ?? null);
      })
      .catch(() => {
        if (active) setCampaignView(null);
      })
      .finally(() => {
        if (active) setCampaignLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mode, campaignId]);

  const campaignStore = useMemo(
    () => campaignView?.store ?? (campaign ? getCampaignStore(campaign) : undefined),
    [campaignView, campaign],
  );
  const store = useMemo(
    () => (mode === 'discounts' ? getStoreById(storeId ?? '') : undefined),
    [mode, storeId],
  );

  // `discounts` mode reads the vendor's ACTIVE catalog rows from the server (the same
  // `GET /stores/{id}/products` the vendor drill-in uses); `martDeals`/`martEssentials` resolve the
  // explicit id list through the batch catalog read. The `@data` local pool is the offline fallback
  // inside `GatewayClient`. `campaign` mode stays on the Home-owned `@data` campaigns.
  const [storeProducts, setStoreProducts] = useState<Product[]>([]);
  const [listProducts, setListProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (mode !== 'discounts' || !store) {
      setStoreProducts([]);
      setLoading(false);
      setFailed(false);
      return;
    }
    let active = true;
    setLoading(true);
    setFailed(false);
    gateway
      .getStoreProducts(store.id)
      .then((rows) => {
        if (active) setStoreProducts(rows as unknown as Product[]);
      })
      .catch(() => {
        if (active) {
          setStoreProducts([]);
          setFailed(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mode, store]);

  useEffect(() => {
    if (!isListMode || !productIds?.length) {
      setListProducts([]);
      if (!isListMode) {
        setLoading(false);
        setFailed(false);
      }
      return;
    }
    let active = true;
    setLoading(true);
    setFailed(false);
    gateway
      .getProductsByIds(productIds)
      .then((rows) => {
        if (active) setListProducts(rows as unknown as Product[]);
      })
      .catch(() => {
        if (active) {
          setListProducts([]);
          setFailed(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isListMode, productIds]);

  const baseProducts = useMemo<Product[]>(() => {
    if (mode === 'campaign') {
      if (campaignView?.products?.length) return campaignView.products as unknown as Product[];
      return campaign ? getCampaignProducts(campaign) : [];
    }
    if (isListMode) return listProducts;
    // The full vendor pool (not just fixture-discounted rows) so an approved festival opt-in on a
    // product without an authored MRP still surfaces once the server discount is overlaid.
    return storeProducts;
  }, [mode, campaignView, campaign, isListMode, listProducts, storeProducts]);

  // Overlay server-owned festival discounts (no-op in mock mode / when none apply), then keep only
  // what is actually on offer in `discounts` mode (authored MRP or an active opt-in).
  const discounts = useActiveDiscounts(baseProducts.map((p) => p.id));
  const products = useMemo(() => {
    const overlaid = applyActiveDiscounts(baseProducts, discounts);
    return mode === 'discounts' ? overlaid.filter(isDiscounted) : overlaid;
  }, [baseProducts, discounts, mode]);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleProductPress = useCallback(
    (product: Product) => navigation.navigate('ProductDetail', { product }),
    [navigation],
  );

  const qtyOf = (id: string) => cartItems.find((c) => c.id === id)?.quantity ?? 0;

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Product>) => {
      const qty = qtyOf(item.id);
      return (
        <MartProductCard
          product={item}
          width={GRID_CARD_W}
          quantity={qty}
          isAdded={qty > 0}
          onPress={() => handleProductPress(item)}
          onAdd={() => addToCart(item.id, item.name, item.price, item.emoji)}
          onIncrement={() => updateQuantity(item.id, 1)}
          onDecrement={() => updateQuantity(item.id, -1)}
        />
      );
    },
    [cartItems, handleProductPress, addToCart, updateQuantity],
  );

  const notFound =
    (mode === 'campaign' && !campaign && !campaignView && !campaignLoading) ||
    (mode === 'discounts' && !store);

  if (notFound) {
    return (
      <View style={[styles.container, styles.center]}>
        <AppText style={styles.emptyTitle}>
          {mode === 'campaign' ? 'Campaign not found' : 'Store not found'}
        </AppText>
        <AppText style={styles.emptySub}>
          This {mode === 'campaign' ? 'campaign' : 'vendor'} is no longer available.
        </AppText>
      </View>
    );
  }

  const title =
    mode === 'campaign'
      ? (campaignStore?.name ?? '')
      : mode === 'discounts'
        ? (store?.name ?? '')
        : (routeTitle ?? (mode === 'martDeals' ? 'Deals of the Day' : 'Daily Essentials'));

  // Paid sector rail (SECTOR_RAIL) — same ad-server fill/labelling as the Home rail.
  const sectorRail = (
    <SponsoredRail
      placement="SECTOR_RAIL"
      onProductClick={handleProductPress}
      addToCart={addToCart}
      renderCard={(product, h) => (
        <MartProductCard
          key={product.id}
          product={product as unknown as Product}
          width={GRID_CARD_W}
          variant="rail"
          showAdLabel
          isAdded={h.isAdded}
          onPress={h.onPress}
          onAdd={h.onAdd}
        />
      )}
    />
  );

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + vs(4) }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft size={ms(20)} color="#1E2022" strokeWidth={2.6} />
        </TouchableOpacity>
        <AppText style={styles.topBarTitle} numberOfLines={1}>{title}</AppText>
        <InfoButton contentKey="DealsLanding" />
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.productRow}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={renderItem}
        ListHeaderComponent={
          mode === 'campaign' ? (
            <View style={styles.hero}>
              <AppText style={styles.heroBrand} numberOfLines={1}>
                {campaignStore?.name}
              </AppText>
              {campaignStore?.offerTag ? (
                <View style={styles.discountPill}>
                  <AppText style={styles.discountText} numberOfLines={1}>
                    {campaignStore.offerTag}
                  </AppText>
                </View>
              ) : null}
            </View>
          ) : mode === 'discounts' ? (
            <View>
              <View style={styles.hero}>
                <AppText style={styles.heroBrand}>{store?.name}</AppText>
                <AppText style={styles.heroSub}>Discounted Products</AppText>
              </View>
              {sectorRail}
            </View>
          ) : isListMode ? (
            sectorRail
          ) : null
        }
        ListEmptyComponent={
          loading || campaignLoading ? (
            <View style={styles.emptyWrap}>
              <ActivityIndicator color="#1162D3" />
            </View>
          ) : failed ? (
            <View style={styles.emptyWrap}>
              <AppText style={styles.emptyTitle}>Couldn’t load deals</AppText>
              <AppText style={styles.emptySub}>Please check your connection and try again.</AppText>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <AppText style={styles.emptyTitle}>No deals right now</AppText>
              <AppText style={styles.emptySub}>Check back soon for new offers.</AppText>
            </View>
          )
        }
      />
    </View>
  );
}

export default DealsLandingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
    paddingHorizontal: hs(16),
    paddingBottom: vs(10),
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: ms(38),
    height: ms(38),
    borderRadius: ms(19),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  topBarTitle: {
    fontSize: ms(16),
    fontWeight: '800',
    color: '#1E2022',
    flexShrink: 1,
  },
  listContent: {
    padding: hs(16),
    paddingBottom: SPACE.LIST_BOTTOM,
  },
  productRow: {
    gap: CARD_GAP,
    marginBottom: SPACE.ITEM,
  },
  hero: {
    marginBottom: SPACE.BLOCK,
  },
  heroBrand: {
    fontSize: ms(20),
    fontWeight: '900',
    color: '#1E2022',
  },
  discountPill: {
    alignSelf: 'flex-start',
    marginTop: vs(6),
    backgroundColor: '#FEF3C7',
    paddingHorizontal: hs(10),
    paddingVertical: vs(4),
    borderRadius: ms(10),
  },
  discountText: {
    fontSize: ms(9),
    fontWeight: '900',
    color: '#B45309',
  },
  heroSub: {
    fontSize: ms(12),
    fontWeight: '600',
    color: '#64748b',
    marginTop: vs(6),
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: vs(60),
    paddingHorizontal: hs(24),
  },
  emptyTitle: {
    fontSize: ms(13),
    fontWeight: '800',
    color: '#1E2022',
  },
  emptySub: {
    fontSize: ms(10),
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: vs(6),
    textAlign: 'center',
  },
});
