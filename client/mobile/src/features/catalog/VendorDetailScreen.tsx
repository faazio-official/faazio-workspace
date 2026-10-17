import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  type ListRenderItemInfo,
} from 'react-native';
import { ArrowLeft, MapPin, Search, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { getStoreById, type StoreRecord } from '@data/directory/stores';
import { gateway, type HeroAd } from '@/services/api/GatewayClient';
import { openHeroTarget } from '@/services/adsTarget';
import CampaignHero from '@/components/shared/CampaignHero';
import type { Product } from '@data/types';
import { getVendorProducts, matchesQuery } from '@/services/categoryVendors';
import { applyActiveDiscounts, useActiveDiscounts } from '@/services/pricing';
import type { RootStackParamList } from '@/navigation/types';
import SearchMartProductCard from '@/features/ecommerce/components/SearchMartProductCard';
import SearchPharmaProductCard from '@/features/pharma/components/SearchPharmaProductCard';

type Props = NativeStackScreenProps<RootStackParamList, 'VendorDetails'>;

/** One-per-row product card, branched per app — consistent with the Search route. */
const ProductRow = memo(function ProductRow({
  product,
  app,
  onPress,
}: {
  product: Product;
  app: 'FA_MART' | 'PHARMA';
  onPress?: (product: Product) => void;
}) {
  if (app === 'PHARMA') {
    return <SearchPharmaProductCard product={product} onPress={onPress} showStoreHeader={false} />;
  }
  return <SearchMartProductCard product={product} onPress={onPress} showStoreHeader={false} />;
});

/**
 * Vendor Details page: a single store's products with an inline searchbar to its
 * right of the back arrow. The tapped sub-category's query is pre-applied and the
 * field auto-focuses; typing re-filters that vendor's product pool live.
 */
export function VendorDetailScreen({ navigation, route }: Props) {
  const { storeId, app, initialQuery } = route.params;
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput | null>(null);
  const [query, setQuery] = useState(initialQuery ?? '');

  // Progressive enhancement: render the local directory fixture immediately, then
  // upgrade to the server row (directory.stores) when it arrives. `GatewayClient`
  // falls back to the fixture offline, so this never regresses.
  const [store, setStore] = useState<StoreRecord | undefined>(() => getStoreById(storeId));
  const [resolved, setResolved] = useState(false);
  useEffect(() => {
    let active = true;
    gateway
      .getStore(storeId)
      .then((s) => {
        if (active && s) setStore(s);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setResolved(true);
      });
    return () => {
      active = false;
    };
  }, [storeId]);

  const products = useMemo(() => getVendorProducts(storeId, app), [storeId, app]);

  // Overlay approved festival discounts on the vendor's pool (no-op offline / when none apply).
  const discounts = useActiveDiscounts(products.map((p) => p.id));
  const pricedProducts = useMemo(
    () => applyActiveDiscounts(products, discounts),
    [products, discounts],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return pricedProducts;
    return pricedProducts.filter((p) => matchesQuery(p, query));
  }, [pricedProducts, query]);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleProductPress = useCallback(
    (product: Product) => navigation.navigate('ProductDetail', { product }),
    [navigation],
  );

  /** Paid STORE_TOP tap-through. A STORE target equal to this store is a no-op (already here). */
  const handleHeroPress = useCallback(
    (ad: HeroAd) => {
      void openHeroTarget(ad, {
        onProduct: (product) => navigation.navigate('ProductDetail', { product: product as Product }),
        onStore: (target) => {
          if (target.id === storeId) return;
          if (target.app === 'PHARMA') navigation.navigate('MedicalShopDetails', { storeId: target.id });
          else navigation.navigate('VendorDetails', { storeId: target.id, app: 'FA_MART' });
        },
      });
    },
    [navigation, storeId],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Product>) => (
      <ProductRow product={item} app={app} onPress={handleProductPress} />
    ),
    [app, handleProductPress],
  );

  if (!store) {
    if (!resolved) {
      return (
        <View style={[styles.container, styles.center]}>
          <ActivityIndicator color="#1162D3" />
        </View>
      );
    }
    return (
      <View style={[styles.container, styles.center]}>
        <AppText style={styles.emptyTitle}>Store not found</AppText>
        <AppText style={styles.emptySub}>This vendor is no longer available.</AppText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top bar: back arrow + inline searchbar filling the rest. */}
      <View style={[styles.topBar, { paddingTop: insets.top + vs(4) }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft size={ms(20)} color="#1E2022" strokeWidth={2.6} />
        </TouchableOpacity>
        <View style={styles.searchWrap}>
          <Search size={ms(16)} color="#94a3b8" strokeWidth={2.2} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search this store..."
            placeholderTextColor="#94a3b8"
            autoFocus
            returnKeyType="search"
            clearButtonMode="never"
            accessibilityLabel="Search within this store"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={ms(16)} color="#94a3b8" strokeWidth={2.4} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <View>
            {/* Compact profile block. */}
            <View style={styles.board}>
              <ExpoImage source={{ uri: store.coverImage }} style={styles.cover} contentFit="cover" cachePolicy="memory-disk" />
              <View style={styles.storeInfoRow}>
                <View style={styles.logoContainer}>
                  <ExpoImage source={{ uri: store.coverImage }} style={styles.logo} contentFit="cover" cachePolicy="memory-disk" />
                  <View style={styles.ratingBadge}>
                    <AppText style={styles.ratingText}>{store.rating}</AppText>
                  </View>
                </View>
                <View style={styles.storeDetails}>
                  <AppText style={styles.storeName} numberOfLines={1}>{store.name}</AppText>
                  <View style={styles.metaRow}>
                    <MapPin size={ms(13)} color="#94a3b8" />
                    <AppText style={styles.metaText} numberOfLines={1}>
                      {store.address ? store.address.split(',').slice(0, 2).join(',') : store.distance} · {store.distance}
                    </AppText>
                  </View>
                  <View style={styles.metaRow}>
                    <AppText style={styles.metaText}>{store.deliveryTime} delivery</AppText>
                    {store.offerTag ? (
                      <View style={styles.offerBadge}>
                        <AppText style={styles.offerText} numberOfLines={1}>{store.offerTag}</AppText>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            </View>

            <CampaignHero
              placement="STORE_TOP"
              app={app === 'FA_MART' ? 'MART' : 'PHARMA'}
              storeId={storeId}
              onPress={handleHeroPress}
              style={styles.storeHero}
            />

            <View style={styles.resultsHeader}>
              <AppText style={styles.resultsCount}>
                {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
              </AppText>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <AppText style={styles.emptyTitle}>No matches found</AppText>
            <AppText style={styles.emptySub}>Try a different search for this store.</AppText>
          </View>
        }
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

export default VendorDetailScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  searchWrap: {
    flex: 1,
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    paddingHorizontal: hs(14),
  },
  searchInput: {
    flex: 1,
    fontSize: ms(12),
    color: '#1E2022',
    paddingVertical: 0,
  },
  listContent: {
    paddingBottom: SPACE.LIST_BOTTOM,
  },
  board: {
    paddingHorizontal: hs(16),
    paddingTop: vs(4),
  },
  cover: {
    width: '100%',
    height: vs(110),
    borderRadius: ms(16),
  },
  storeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(12),
    marginTop: SPACE.ITEM,
  },
  logoContainer: {
    position: 'relative',
  },
  logo: {
    width: ms(56),
    height: ms(56),
    borderRadius: ms(14),
  },
  ratingBadge: {
    position: 'absolute',
    bottom: -ms(6),
    alignSelf: 'center',
    backgroundColor: '#22C55E',
    borderRadius: ms(8),
    paddingHorizontal: hs(6),
    paddingVertical: vs(1),
  },
  ratingText: {
    fontSize: ms(9),
    fontWeight: '900',
    color: '#FFFFFF',
  },
  storeDetails: {
    flex: 1,
    gap: vs(4),
  },
  storeName: {
    fontSize: ms(16),
    fontWeight: '800',
    color: '#1E2022',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(5),
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: ms(10),
    fontWeight: '600',
    color: '#64748b',
  },
  offerBadge: {
    backgroundColor: '#F0F4FE',
    borderRadius: ms(6),
    paddingHorizontal: hs(6),
    paddingVertical: vs(2),
    maxWidth: hs(200),
  },
  offerText: {
    fontSize: ms(8.5),
    fontWeight: '700',
    color: '#1162D3',
  },
  storeHero: {
    marginTop: SPACE.ITEM,
    marginHorizontal: hs(16),
  },
  resultsHeader: {
    paddingHorizontal: hs(16),
    paddingTop: vs(16),
    paddingBottom: vs(8),
  },
  resultsCount: {
    fontSize: ms(11),
    fontWeight: '800',
    color: '#1E2022',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: SPACE.LIST_BOTTOM,
    paddingHorizontal: hs(24),
  },
  emptyTitle: {
    fontSize: ms(12),
    fontWeight: '800',
    color: '#1E2022',
  },
  emptySub: {
    fontSize: ms(9.5),
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: vs(4),
    textAlign: 'center',
  },
});
