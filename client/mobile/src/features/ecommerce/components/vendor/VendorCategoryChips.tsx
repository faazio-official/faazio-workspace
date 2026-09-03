import React, { memo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { VENDOR_YELLOW, TEXT_LIGHT, TEXT_DARK } from './theme';

interface VendorCategoryChipsProps {
  categories: string[];
  active: string;
  onSelect: (category: string) => void;
}

const VendorCategoryChips = memo(function VendorCategoryChips({
  categories,
  active,
  onSelect,
}: VendorCategoryChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      {categories.map((cat) => {
        const isActive = cat === active;
        return (
          <TouchableOpacity
            key={cat}
            onPress={() => onSelect(cat)}
            style={[styles.chip, isActive && styles.activeChip]}
            activeOpacity={0.8}
          >
            <AppText style={[styles.text, isActive && styles.activeText]}>{cat}</AppText>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});

export default VendorCategoryChips;

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: hs(16),
    paddingBottom: vs(2),
  },
  chip: {
    paddingHorizontal: hs(16),
    paddingVertical: vs(8),
    borderRadius: ms(20),
    marginRight: hs(8),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  activeChip: {
    backgroundColor: '#FFF8E1',
    borderColor: VENDOR_YELLOW,
  },
  text: {
    fontSize: ms(13),
    color: TEXT_DARK,
    fontWeight: '500',
  },
  activeText: {
    color: '#B45309',
    fontWeight: '700',
  },
});
