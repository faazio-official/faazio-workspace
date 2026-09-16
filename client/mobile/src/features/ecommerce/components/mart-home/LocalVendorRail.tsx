import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import AppText from '@/components/AppText';
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
  return (
    <View style={styles.wrap}>
      <MartSectionHeader title="Local Vendors Near You" onViewAll={onViewAll} />
      <View style={styles.list}>
        {vendors.map((store) => (
          <LocalVendorCard
            key={store.id}
            store={store}
            onPress={onVendorPress}
          />
        ))}
        {vendors.length === 0 ? (
          <View style={styles.emptyWrap}>
            <AppText style={styles.emptyText}>No vendors found</AppText>
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
