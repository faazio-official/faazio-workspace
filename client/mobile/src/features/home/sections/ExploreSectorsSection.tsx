import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { portalSectors } from '@data/home/rails';
import { subAppIdFor } from './common';
import type { SectionProps } from './common';
import { SECTOR_VISUALS } from '@/theme/sectorVisuals';
import AppText from '@/components/AppText';

function ExploreSectorsSection({ onLaunchSubApp }: SectionProps) {
  return (
    <View style={styles.grid}>
      {portalSectors.map((sector) => {
        const { Icon, fill, iconColor } = SECTOR_VISUALS[sector.app];
        return (
          <TouchableOpacity
            key={sector.name}
            onPress={() => onLaunchSubApp(subAppIdFor(sector.app))}
            style={[styles.sectorButton, { backgroundColor: fill }]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Open ${sector.name}`}
          >
            <Icon size={ms(16)} color={iconColor} fill={iconColor} strokeWidth={2.2} />
            <AppText style={[styles.name, { color: '#111827' }]} numberOfLines={1}>
              {sector.name}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default memo(ExploreSectorsSection);

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  sectorButton: {
    width: '30%',
    height: vs(38),
    borderRadius: ms(11),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(5),
    paddingHorizontal: hs(6),
  },
  name: {
    fontSize: ms(10),
    fontWeight: '800',
    flexShrink: 1,
  },
});
