import React, { memo, useMemo, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { ChevronLeft, Search, X, PackageOpen } from 'lucide-react-native';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import { hs, ms, vs } from '@/utils/responsive';
import type { StoreProfile } from '@data/types';
import type { FulfillmentMode } from '@data/types';
import PharmaVendorCard from './PharmaVendorCard';
import PharmaFulfilmentSheet from './PharmaFulfilmentSheet';
import { PHARMA_INK } from '../mocks/pharmaHomeFeed';
import { usePharmaStores } from '../hooks/usePharmaStores';

interface PharmaVendorListProps {
  selected: StoreProfile | null;
  photos: string[];
  note: string;
  onBack: () => void;
  onSelect: (store: StoreProfile) => void;
  onConfirm: (fulfillment: FulfillmentMode) => void;
}

const PharmaVendorList = memo(function PharmaVendorList({
  selected,
  photos,
  note,
  onBack,
  onSelect,
  onConfirm,
}: PharmaVendorListProps) {
  const [query, setQuery] = useState('');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [activeVendor, setActiveVendor] = useState<StoreProfile | null>(selected);
  const { stores } = usePharmaStores();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return stores;
    return stores.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.categories.some((c) => c.toLowerCase().includes(q)) ||
        v.desc.toLowerCase().includes(q) ||
        (v.offerTag ?? '').toLowerCase().includes(q),
    );
  }, [query, stores]);

  const handleOrder = (store: StoreProfile) => {
    setActiveVendor(store);
    onSelect(store);
    setSheetVisible(true);
  };

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
          <ChevronLeft size={ms(20)} color={PHARMA_INK} strokeWidth={2.6} />
        </TouchableOpacity>
        <AppText style={styles.topTitle}>Choose a Pharmacy</AppText>
        <View style={{ width: ms(32) }} />
      </View>

      <View style={styles.metaRow}>
        <AppText style={styles.metaText}>
          {photos.length} pages{note ? ' • with note' : ''}
        </AppText>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchPill}>
          <Search size={ms(17)} color="#64748B" strokeWidth={2.2} />
          <AppTextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search pharmacy or medicine"
            placeholderTextColor="#94A3B8"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search pharmacy or medicine"
          />
          {query.length > 0 ? (
            <TouchableOpacity
              onPress={() => setQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <X size={ms(16)} color="#64748B" strokeWidth={2.2} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <PackageOpen size={ms(36)} color="#CBD5E1" strokeWidth={1.8} />
            <AppText style={styles.emptyText}>No pharmacies found for "{query}"</AppText>
          </View>
        ) : (
          filtered.map((store) => (
            <PharmaVendorCard
              key={store.id}
              store={store}
              selected={selected?.id === store.id}
              onPress={handleOrder}
            />
          ))
        )}
      </ScrollView>

      <PharmaFulfilmentSheet
        visible={sheetVisible}
        vendor={activeVendor}
        onRequestClose={() => setSheetVisible(false)}
        onConfirm={(fulfillment) => {
          setSheetVisible(false);
          onConfirm(fulfillment);
        }}
      />
    </View>
  );
});

export default PharmaVendorList;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingVertical: vs(12),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: ms(15),
    fontWeight: '800',
    color: PHARMA_INK,
  },
  metaRow: {
    paddingHorizontal: hs(16),
    paddingVertical: vs(10),
  },
  metaText: {
    fontSize: ms(11),
    fontWeight: '700',
    color: '#94A3B8',
  },
  searchWrap: {
    paddingHorizontal: hs(16),
    marginBottom: vs(12),
  },
  searchPill: {
    height: vs(44),
    borderRadius: ms(22),
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: hs(14),
    gap: hs(8),
    borderWidth: 1,
    borderColor: '#EFEFEF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: ms(13),
    fontWeight: '500',
    color: '#1E2022',
    padding: 0,
  },
  scroll: {
    flex: 1,
  },
  list: {
    paddingHorizontal: hs(16),
    paddingBottom: vs(24),
    gap: hs(10),
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: vs(48),
    gap: vs(8),
  },
  emptyText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: '#94A3B8',
  },
});
