import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ShoppingCart, UtensilsCrossed, Carrot, Pill } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { portalSectors } from '@data/home/rails';
import { subAppIdFor } from './common';
import type { SectionProps } from './common';
import type { AppBrand } from '@data/types';
import AppText from '@/components/AppText';

interface SectorVisual {
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; fill?: string }>;
  fill: string;
  iconColor: string;
}

const SECTOR_VISUALS: Record<AppBrand, SectorVisual> = {
  MART: { Icon: ShoppingCart, fill: '#FEF9E7', iconColor: '#F59E0B' },
  FOOD: { Icon: UtensilsCrossed, fill: '#FFF4E6', iconColor: '#F97316' },
  GROCERY: { Icon: Carrot, fill: '#EAFBF1', iconColor: '#22C55E' },
  PHARMA: { Icon: Pill, fill: '#E8FBF8', iconColor: '#14B8A6' },
};

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
    width: '23%',
    height: vs(44),
    borderRadius: ms(12),
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
