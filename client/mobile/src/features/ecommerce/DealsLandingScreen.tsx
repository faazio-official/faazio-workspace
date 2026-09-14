import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Dimensions, type ListRenderItemInfo } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { hs, ms, vs } from '@/utils/responsive';
import AppText from '@/components/AppText';
import type { Product } from '@data/types';
import { adCampaigns, getCampaignProducts, getCampaignStore } from '@data/home/campaigns';
import { getStoreById } from '@data/directory/stores';
import { getDiscountedProducts } from '@/services/categoryVendors';
import { useCartStore } from '@/state/cartStore';
import type { RootStackParamList } from '@/navigation/types';
import MartProductCard from '@/features/ecommerce/cards/MartProductCard';

type Props = NativeStackScreenProps<RootStackParamList, 'DealsLanding'>;

const CARD_GAP = hs(12);
const SCREEN_W = Dimensions.get('window').width;
const GRID_CARD_W = (SCREEN_W - hs(32) - CARD_GAP) / 2;

/**
 * Deals landing page — one page, two entry modes:
 * - `campaign`: a brand campaign's full product grid (from the Home "Deals of the
 *   day" carousel "View all").
 * - `discounts`: a vendor's discounted products (from the Mart vendor profile
 *   "View All").
 */
export function DealsLandingScreen({ navigation, route }: Props) {
  const { mode, campaignId, storeId, app = 'FA_MART' } = route.params;
  const insets = useSafeAreaInsets();
  const cartItems = useCartStore((s) => s.cart);
  const addToCart = useCartStore((s) => s.addToCart);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  const campaign = useMemo(
    () => (mode === 'campaign' ? adCampaigns.find((c) => c.id === campaignId) : undefined),
    [mode, campaignId],
  );
  const campaignStore = useMemo(
    () => (campaign ? getCampaignStore(campaign) : undefined),
    [campaign],
  );
  const store = useMemo(
    () => (mode === 'discounts' ? getStoreById(storeId ?? '') : undefined),
    [mode, storeId],
  );

  const products = useMemo<Product[]>(() => {
    if (mode === 'campaign') return campaign ? getCampaignProducts(campaign) : [];
    return store ? getDiscountedProducts(store.id, app) : [];
  }, [mode, campaign, store, app]);

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

  const notFound = (mode === 'campaign' && !campaign) || (mode === 'discounts' && !store);

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

  const title = mode === 'campaign' ? (campaignStore?.name ?? '') : (store?.name ?? '');

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + vs(4) }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft size={ms(20)} color="#1E2022" strokeWidth={2.6} />
        </TouchableOpacity>
        <AppText style={styles.topBarTitle} numberOfLines={1}>{title}</AppText>
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
            <View style={styles.hero}>
              <AppText style={styles.heroBrand}>{store?.name}</AppText>
              <AppText style={styles.heroSub}>Discounted Products</AppText>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <AppText style={styles.emptyTitle}>No deals right now</AppText>
            <AppText style={styles.emptySub}>Check back soon for new offers.</AppText>
          </View>
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
    paddingBottom: vs(40),
  },
  productRow: {
    gap: CARD_GAP,
    marginBottom: vs(16),
  },
  hero: {
    marginBottom: vs(16),
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
