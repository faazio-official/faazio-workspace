import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { brandRamp } from '@/theme/brandTokens';

/** Mart anchor. `base` is a fill only — it cannot carry text or sit on white. */
const MART_YELLOW = brandRamp.MART.base;
/** Mart ink. Use for text and icons on light surfaces. */
const MART_INK = brandRamp.MART.deep;

interface MartSectionHeaderProps {
  title: string;
  onViewAll?: () => void;
}

const MartSectionHeader = memo(function MartSectionHeader({
  title,
  onViewAll,
}: MartSectionHeaderProps) {
  return (
    <View style={styles.row}>
      <AppText style={styles.title} numberOfLines={1}>
        {title}
      </AppText>
      {onViewAll ? (
        <TouchableOpacity
          onPress={onViewAll}
          style={styles.viewAllBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`${title}, view all`}
        >
          <AppText style={styles.viewAllText}>View All</AppText>
          <ChevronRight size={ms(14)} color={MART_INK} strokeWidth={2.6} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

export default MartSectionHeader;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingTop: SPACE.SECTION,
    paddingBottom: SPACE.BLOCK,
  },
  title: {
    fontSize: ms(16),
    fontWeight: '700',
    color: '#1E2022',
    flexShrink: 1,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: vs(40),
    paddingLeft: hs(12),
    marginRight: hs(-2),
  },
  viewAllText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: MART_INK,
  },
});
