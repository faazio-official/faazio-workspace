import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { ArrowLeft, Clock, MapPin, Phone, Search, Star, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import InfoButton from '@/components/shared/InfoButton';
import { VendorReviewsSection } from '@/components/shared';
import CampaignHero from '@/components/shared/CampaignHero';
import { openHeroTarget } from '@/services/adsTarget';
import { gateway, type HeroAd } from '@/services/api/GatewayClient';
import { hs, ms, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import type { Product, StoreProfile } from '@data/types';
import { matchesQuery } from '@/services/categoryVendors';
import { useVendorProducts } from '@/features/catalog/hooks/useVendorProducts';
import { usePharmaStores } from './hooks/usePharmaStores';
import type { RootStackParamList } from '@/navigation/types';
import SearchPharmaProductCard from './components/SearchPharmaProductCard';
import PharmaImage from './components/pharma-home/PharmaImage';
import UploadPrescriptionFAB from './components/pharma-home/UploadPrescriptionFAB';
import { PHARMA_TEAL, PHARMA_INK } from './mocks/pharmaHomeFeed';

type Props = NativeStackScreenProps<RootStackParamList, 'MedicalShopDetails'>;

const StoreInfo = memo(function StoreInfo({ store }: { store: StoreProfile }) {
  return (
    <View style={styles.infoSection}>
      <PharmaImage uri={store.coverImage} style={styles.cover} contentFit="cover" />
      <View style={styles.identityRow}>
        <View style={styles.logoWrap}>
          <PharmaImage uri={store.coverImage} style={styles.logo} contentFit="cover" />
          <View style={styles.ratingBadge}>
            <Star size={ms(10)} color="#FFFFFF" fill="#FFFFFF" strokeWidth={1.5} />
            <AppText style={styles.ratingText}>{store.rating}</AppText>
          </View>
        </View>
        <View style={styles.identityBody}>
          <AppText style={styles.storeName} numberOfLines={1}>{store.name}</AppText>
          <View style={styles.metaRow}>
            <MapPin size={ms(13)} color="#64748B" strokeWidth={2} />
            <AppText style={styles.metaText}>{store.distance} away</AppText>
          </View>
          <View style={styles.metaRow}>
            <Clock size={ms(13)} color="#64748B" strokeWidth={2} />
            <AppText style={styles.metaText}>{store.deliveryTime} delivery</AppText>
          </View>
        </View>
      </View>

      {store.offerTag ? (
        <View style={styles.offerRow}>
          <AppText style={styles.offerText}>{store.offerTag}</AppText>
        </View>
      ) : null}

      <View style={styles.contactCard}>
        {store.address ? (
          <View style={styles.contactRow}>
            <MapPin size={ms(15)} color={PHARMA_TEAL} strokeWidth={2} />
            <AppText style={styles.contactText}>{store.address}</AppText>
          </View>
        ) : null}
        {store.phone ? (
          <View style={styles.contactRow}>
            <Phone size={ms(15)} color={PHARMA_TEAL} strokeWidth={2} />
            <AppText style={styles.contactText}>{store.phone}</AppText>
          </View>
        ) : null}
        {store.hours ? (
          <View style={styles.contactRow}>
            <Clock size={ms(15)} color={PHARMA_TEAL} strokeWidth={2} />
            <AppText style={styles.contactText}>Open {store.hours}</AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
});

export function MedicalShopDetailsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput | null>(null);
  const [query, setQuery] = useState('');
  const { stores } = usePharmaStores();
  const localStore = useMemo(
    () => stores.find((candidate) => candidate.id === route.params.storeId),
    [stores, route.params.storeId],
  );
  // Deep-link fallback (Mart W43 pattern): the directory list is paginated / may not carry a
  // recently-added or renamed pharmacy, so resolve the single store row directly before giving up.
  const [fetchedStore, setFetchedStore] = useState<StoreProfile | undefined>(undefined);
  const [lookupDone, setLookupDone] = useState(false);
  useEffect(() => {
    if (localStore) return;
    let active = true;
    gateway
      .getStore(route.params.storeId)
      .then((row) => {
        if (active && row) setFetchedStore(row as unknown as StoreProfile);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLookupDone(true);
      });
    return () => {
      active = false;
    };
  }, [localStore, route.params.storeId]);
  const store = localStore ?? fetchedStore;
  // Canonical store inventory: server `GET /stores/{id}/products` with approved festival discounts
  // overlaid (same hook the Mart vendor drill-in uses) — the local `@data` pool is the offline fallback.
  const { products } = useVendorProducts(route.params.storeId);
  const filtered = useMemo(
    () => query.trim() ? products.filter((product) => matchesQuery(product, query)) : products,
    [products, query],
  );

  const handleProductPress = useCallback(
    (product: Product) => navigation.navigate('ProductDetail', { product }),
    [navigation],
  );
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Product>) => (
      <SearchPharmaProductCard product={item} onPress={handleProductPress} showStoreHeader={false} />
    ),
    [handleProductPress],
  );

  /** Paid STORE_TOP tap-through. A STORE target equal to this store is a no-op (already here). */
  const handleHeroPress = useCallback(
    (ad: HeroAd) => {
      void openHeroTarget(ad, {
        onProduct: (product) => navigation.navigate('ProductDetail', { product: product as Product }),
        onStore: (target) => {
          if (target.id === route.params.storeId) return;
          if (target.app === 'PHARMA') navigation.navigate('MedicalShopDetails', { storeId: target.id });
          else navigation.navigate('VendorDetails', { storeId: target.id, app: 'FA_MART' });
        },
      });
    },
    [navigation, route.params.storeId],
  );

  if (!store) {
    if (!lookupDone) {
      return (
        <View style={[styles.container, styles.center]}>
          <ActivityIndicator color={PHARMA_TEAL} />
        </View>
      );
    }
    return (
      <View style={[styles.container, styles.center]}>
        <AppText style={styles.emptyTitle}>Medical not found</AppText>
        <AppText style={styles.emptySub}>This pharmacy is no longer available.</AppText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + vs(4) }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={ms(20)} color={PHARMA_INK} strokeWidth={2.6} />
        </TouchableOpacity>
        <View style={styles.searchWrap}>
          <Search size={ms(16)} color="#94A3B8" strokeWidth={2.2} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search this medical..."
            placeholderTextColor="#94A3B8"
            returnKeyType="search"
            accessibilityLabel="Search products in this medical"
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Clear search">
              <X size={ms(16)} color="#94A3B8" strokeWidth={2.4} />
            </TouchableOpacity>
          ) : null}
        </View>
        <InfoButton contentKey="MedicalShopDetails" />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            <StoreInfo store={store} />
            <CampaignHero
              placement="STORE_TOP"
              app="PHARMA"
              storeId={store.id}
              onPress={handleHeroPress}
              style={styles.storeHero}
            />
            <VendorReviewsSection
              vendorId={store.id}
              accentColor={PHARMA_TEAL}
              onRatePress={() => navigation.navigate('RateVendor', { vendorId: store.id, vendorName: store.name })}
              style={styles.reviewsSection}
            />
            <View style={styles.productsHeader}>
              <AppText style={styles.productsTitle}>Medicines & Essentials</AppText>
              <AppText style={styles.productsCount}>{filtered.length} items</AppText>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyProducts}>
            <AppText style={styles.emptyTitle}>No matches found</AppText>
            <AppText style={styles.emptySub}>Try a different search for this medical.</AppText>
          </View>
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: vs(96) }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />

      <UploadPrescriptionFAB onPress={() => navigation.navigate('PrescriptionFlow', { presetVendorId: store.id })} />
    </View>
  );
}

export default MedicalShopDetailsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { alignItems: 'center', justifyContent: 'center', padding: hs(24) },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
    paddingHorizontal: hs(16),
    paddingBottom: SPACE.BLOCK,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E6F2F1',
  },
  backBtn: {
    width: ms(38), height: ms(38), borderRadius: ms(19),
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F6F4',
  },
  searchWrap: {
    flex: 1, height: ms(40), borderRadius: ms(20), backgroundColor: '#F1FAF9',
    flexDirection: 'row', alignItems: 'center', gap: hs(8), paddingHorizontal: hs(14),
  },
  searchInput: { flex: 1, fontSize: ms(12), color: PHARMA_INK, paddingVertical: 0 },
  infoSection: { paddingHorizontal: hs(16), paddingTop: SPACE.BLOCK },
  cover: { width: '100%', height: vs(130), borderRadius: ms(16) },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: hs(12), marginTop: SPACE.BLOCK },
  logoWrap: { position: 'relative' },
  logo: { width: ms(60), height: ms(60), borderRadius: ms(15) },
  ratingBadge: {
    position: 'absolute', bottom: -ms(6), alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: hs(2),
    paddingHorizontal: hs(6), paddingVertical: vs(2), borderRadius: ms(7), backgroundColor: PHARMA_TEAL,
  },
  ratingText: { fontSize: ms(9), fontWeight: '900', color: '#FFFFFF' },
  identityBody: { flex: 1, gap: vs(5) },
  storeName: { fontSize: ms(17), fontWeight: '900', color: PHARMA_INK },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: hs(5) },
  metaText: { fontSize: ms(10), fontWeight: '700', color: '#64748B' },
  offerRow: { alignSelf: 'flex-start', marginTop: SPACE.SECTION, paddingHorizontal: hs(9), paddingVertical: vs(5), borderRadius: ms(7), backgroundColor: '#E8F6F4' },
  offerText: { fontSize: ms(10), fontWeight: '800', color: PHARMA_TEAL },
  contactCard: { marginTop: SPACE.SECTION, padding: hs(12), gap: SPACE.ITEM, borderRadius: ms(12), backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#EEF2F6' },
  contactRow: { flexDirection: 'row', alignItems: 'flex-start', gap: hs(9) },
  contactText: { flex: 1, fontSize: ms(10), lineHeight: vs(15), fontWeight: '600', color: '#475569' },
  storeHero: { marginTop: SPACE.SECTION, marginHorizontal: hs(16) },
  reviewsSection: { paddingHorizontal: hs(16), paddingTop: SPACE.SECTION },
  productsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: hs(16), paddingTop: SPACE.SECTION, paddingBottom: SPACE.BLOCK },
  productsTitle: { fontSize: ms(14), fontWeight: '900', color: PHARMA_INK },
  productsCount: { fontSize: ms(10), fontWeight: '700', color: '#94A3B8' },
  listContent: { paddingTop: vs(2) },
  emptyProducts: { alignItems: 'center', paddingVertical: SPACE.LIST_BOTTOM, paddingHorizontal: hs(24) },
  emptyTitle: { fontSize: ms(13), fontWeight: '800', color: PHARMA_INK },
  emptySub: { marginTop: vs(5), fontSize: ms(10), fontWeight: '600', textAlign: 'center', color: '#94A3B8' },
});
