import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { MapPin, ChevronDown } from 'lucide-react-native';
import { FaazioLogo } from '@/components/FaazioLogo';
import AppTextInput from '@/components/AppTextInput';
import AppText from '@/components/AppText';
import { HubGradient } from '@/features/home/HubGradient';
import {
  HEADER_TOPINSET,
  HEADER_ROW_GAP,
  HEADER_BOTTOM_PAD,
  HEADER_SEARCH_H,
  NONHOME_H,
} from '@/features/home/hubHeader';

interface CompactHubHeaderProps {
  onLocationPress?: () => void;
}

export function CompactHubHeader({ onLocationPress }: CompactHubHeaderProps) {
  return (
    <View style={[styles.headerOuter, { height: NONHOME_H }]} collapsable={false} pointerEvents="box-none">
      <HubGradient />
      <View style={styles.headerContent}>
        <View style={styles.headerTopRow}>
          <FaazioLogo size={ms(28)} />

          <View style={styles.headerCenter}>
            <TouchableOpacity style={styles.locationRow} activeOpacity={0.7} onPress={onLocationPress}>
              <MapPin size={ms(11)} color="#7CE045" />
              <AppText style={styles.locationText} numberOfLines={1}>
                Sunnambukkara Street, Karaikal
              </AppText>
              <ChevronDown size={ms(11)} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.searchBar}>
        <AppTextInput
          style={styles.searchInput}
          placeholder="Search for food, groceries or more..."
          placeholderTextColor="#94a3b8"
          textAlign="center"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerOuter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    overflow: 'hidden',
    shadowColor: 'rgba(17,98,211,0.12)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: { paddingTop: HEADER_TOPINSET, paddingHorizontal: hs(16) },
  headerTopRow: { flexDirection: 'row', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    maxWidth: hs(200),
  },
  locationText: {
    fontSize: ms(10),
    fontWeight: '900',
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    maxWidth: hs(160),
  },
  searchBar: {
    position: 'absolute',
    bottom: HEADER_BOTTOM_PAD,
    left: hs(16),
    right: hs(16),
    height: HEADER_SEARCH_H,
    borderRadius: ms(22),
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  searchInput: {
    fontSize: ms(12),
    fontWeight: '600',
    color: '#0f172a',
    paddingHorizontal: hs(20),
  },
});
