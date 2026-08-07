import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';

interface FoodSectionHeaderProps {
  title: string;
  onSeeAll?: () => void;
}

/**
 * Compact section header — bold title (~18) on the left, brand-colored
 * "See all >" on the right.
 */
const FoodSectionHeader = memo(function FoodSectionHeader({ title, onSeeAll }: FoodSectionHeaderProps) {
  return (
    <View style={styles.row}>
      <AppText style={styles.title} numberOfLines={1}>
        {title}
      </AppText>
      {onSeeAll ? (
        <TouchableOpacity
          onPress={onSeeAll}
          style={styles.seeAllBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`${title}, see all`}
        >
          <AppText style={styles.seeAllText}>See all</AppText>
          <ChevronRight size={ms(14)} color={foodTheme.primary} strokeWidth={2.6} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

export default FoodSectionHeader;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingVertical: vs(10),
  },
  title: {
    fontSize: ms(15),
    fontWeight: '700',
    color: foodTheme.textPrimary,
    flexShrink: 1,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: vs(40),
    paddingLeft: hs(12),
    marginRight: hs(-2),
  },
  seeAllText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: foodTheme.primary,
  },
});
