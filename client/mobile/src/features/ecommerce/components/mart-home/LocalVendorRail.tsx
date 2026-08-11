import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { hs, vs } from '@/utils/responsive';
import type { MartLocalVendor } from '../../mocks/martHomeFeed';
import MartSectionHeader from './MartSectionHeader';
import LocalVendorCard from './LocalVendorCard';

interface LocalVendorRailProps {
  vendors: MartLocalVendor[];
  onVendorPress?: (vendor: MartLocalVendor) => void;
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
        {vendors.map((vendor) => (
          <LocalVendorCard
            key={vendor.id}
            vendor={vendor}
            onPress={onVendorPress}
          />
        ))}
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
});
