import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Droplet, Beaker, Calendar, Clock, type LucideIcon } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { BLOOD_RED, BLOOD_RED_TINT, BLOOD_TEXT, BLOOD_TEXT_MUTED, BLOOD_BORDER, BLOOD_RADII } from '../tokens';

export interface InfoTile {
  label: string;
  value: string;
  /** Tile icon (rendered inside a red tint chip). */
  icon: LucideIcon;
  /** Accent for the value text — red for need facts, dark for Posted On (per image). */
  valueColor?: 'red' | 'dark';
}

interface BloodRequestInfoGridProps {
  tiles: InfoTile[];
}

/** 2×2 info tile grid on the request-details page (icon chip, label, value). */
export function BloodRequestInfoGrid({ tiles }: BloodRequestInfoGridProps) {
  return (
    <View style={styles.grid}>
      {tiles.map((tile) => {
        const Icon = tile.icon;
        const isRed = (tile.valueColor ?? 'red') === 'red';
        return (
          <View key={tile.label} style={styles.tile}>
            <View style={styles.iconChip}>
              <Icon size={ms(15)} color={BLOOD_RED} strokeWidth={2.2} />
            </View>
            <AppText style={styles.label}>{tile.label}</AppText>
            <AppText style={[styles.value, isRed ? styles.valueRed : styles.valueDark]}>
              {tile.value}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: hs(10),
  },
  tile: {
    width: '48.5%',
    backgroundColor: '#ffffff',
    borderRadius: BLOOD_RADII.chip,
    borderWidth: 1,
    borderColor: BLOOD_BORDER,
    paddingHorizontal: hs(12),
    paddingVertical: vs(12),
    gap: vs(4),
  },
  iconChip: {
    width: ms(30),
    height: ms(30),
    borderRadius: ms(9),
    backgroundColor: BLOOD_RED_TINT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(2),
  },
  label: {
    fontSize: ms(10),
    color: BLOOD_TEXT_MUTED,
    fontWeight: '600',
  },
  value: {
    fontSize: ms(14),
    fontWeight: '900',
  },
  valueRed: {
    color: BLOOD_RED,
  },
  valueDark: {
    color: BLOOD_TEXT,
  },
});
