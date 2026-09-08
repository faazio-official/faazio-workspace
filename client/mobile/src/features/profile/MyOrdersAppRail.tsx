import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Layers } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { portalSectors } from '@data/index';
import { SECTOR_VISUALS } from '@/theme/sectorVisuals';
import type { AppBrand } from '@data/types';
import AppText from '@/components/AppText';

export type AppFilter = 'ALL' | AppBrand;

interface MyOrdersAppRailProps {
  activeApp: AppFilter;
  counts: Record<string, number>;
  onSelect: (app: AppFilter) => void;
}

/** Horizontal chip rail: leading "All" chip, then one chip per sub-app (Mart/Food/Grocery/Pharma). */
const MyOrdersAppRail = memo(function MyOrdersAppRail({
  activeApp,
  counts,
  onSelect,
}: MyOrdersAppRailProps) {
  return (
    <View style={styles.band}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Chip
          label="All"
          count={counts['ALL'] ?? 0}
          isActive={activeApp === 'ALL'}
          iconColor="#64748B"
          fill="#F1F5F9"
          onPress={() => onSelect('ALL')}
        />
        {portalSectors.map((sector) => {
          const visual = SECTOR_VISUALS[sector.app];
          const isActive = activeApp === sector.app;
          return (
            <Chip
              key={sector.app}
              label={sector.name}
              count={counts[sector.app] ?? 0}
              isActive={isActive}
              Icon={visual.Icon}
              iconColor={visual.iconColor}
              fill={isActive ? visual.fill : '#F3F4F6'}
              onPress={() => onSelect(sector.app)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
});

interface ChipProps {
  label: string;
  count: number;
  isActive: boolean;
  iconColor: string;
  fill: string;
  Icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; fill?: string }>;
  onPress: () => void;
}

function Chip({ label, count, isActive, iconColor, fill, Icon, onPress }: ChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: fill },
        isActive && styles.chipActive,
      ]}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={`${label} orders`}
    >
      {Icon ? <Icon size={ms(16)} color={iconColor} strokeWidth={2.2} /> : null}
      <AppText style={[styles.label, isActive && { color: iconColor }]} numberOfLines={1}>
        {label}
      </AppText>
      <View style={[styles.countBadge, isActive && { backgroundColor: iconColor }]}>
        <AppText style={[styles.countText, isActive && styles.countTextActive]}>{count}</AppText>
      </View>
    </TouchableOpacity>
  );
}

export default MyOrdersAppRail;

const styles = StyleSheet.create({
  band: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  content: {
    paddingHorizontal: hs(12),
    paddingVertical: vs(10),
    gap: hs(8),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
    paddingVertical: vs(7),
    paddingHorizontal: hs(12),
    borderRadius: ms(20),
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    borderColor: '#D1D5DB',
  },
  label: {
    fontSize: ms(12),
    fontWeight: '700',
    color: '#374151',
  },
  countBadge: {
    minWidth: ms(18),
    height: ms(18),
    borderRadius: ms(9),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(5),
    backgroundColor: '#E5E7EB',
  },
  countText: {
    fontSize: ms(10),
    fontWeight: '800',
    color: '#6B7280',
  },
  countTextActive: {
    color: '#FFFFFF',
  },
});
