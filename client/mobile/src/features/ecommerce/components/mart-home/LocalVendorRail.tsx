import React, { memo, useMemo, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Search, X } from 'lucide-react-native';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import { hs, ms, vs } from '@/utils/responsive';
import type { StoreProfile } from '@data/types';
import MartSectionHeader from './MartSectionHeader';
import LocalVendorCard from './LocalVendorCard';

interface LocalVendorRailProps {
  vendors: StoreProfile[];
  onVendorPress?: (store: StoreProfile) => void;
  onViewAll?: () => void;
}

const LocalVendorRail = memo(function LocalVendorRail({
  vendors,
  onVendorPress,
  onViewAll,
}: LocalVendorRailProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.categories.some((c) => c.toLowerCase().includes(q)) ||
        v.desc.toLowerCase().includes(q) ||
        (v.offerTag ?? '').toLowerCase().includes(q),
    );
  }, [vendors, query]);

  return (
    <View style={styles.wrap}>
      <MartSectionHeader title="Local Vendors Near You" onViewAll={onViewAll} />
      <View style={styles.searchWrap}>
        <View style={styles.searchPill}>
          <Search size={ms(19)} color="#64748b" strokeWidth={2.2} />
          <AppTextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search local vendors or stores"
            placeholderTextColor="#94a3b8"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search local vendors or stores"
          />
          {query.length > 0 ? (
            <TouchableOpacity
              onPress={() => setQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <X size={ms(16)} color="#64748b" strokeWidth={2.2} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      <View style={styles.list}>
        {filtered.map((store) => (
          <LocalVendorCard
            key={store.id}
            store={store}
            onPress={onVendorPress}
          />
        ))}
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <AppText style={styles.emptyText}>No vendors found for "{query}"</AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
});

export default LocalVendorRail;

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: vs(8),
  },
  searchWrap: {
    paddingHorizontal: hs(16),
    marginBottom: vs(8),
  },
  searchPill: {
    height: vs(42),
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
  list: {
    gap: hs(10),
    paddingBottom: vs(4),
  },
  emptyWrap: {
    paddingVertical: vs(24),
    alignItems: 'center',
  },
  emptyText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: '#94a3b8',
  },
});
