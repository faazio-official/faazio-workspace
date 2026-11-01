import React, { memo, type ReactNode } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { foodTheme } from '../constants/theme';

interface SectionHeaderProps {
  title: string;
  onSeeAll?: () => void;
  right?: ReactNode;
}

const SectionHeader = memo(function SectionHeader({ title, onSeeAll, right }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <AppText style={styles.title} numberOfLines={1}>
        {title}
      </AppText>
      {right ??
        (onSeeAll ? (
          <TouchableOpacity onPress={onSeeAll} style={styles.seeAllBtn} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={`${title}, see all`}>
            <AppText style={styles.seeAllText}>See All</AppText>
            <ChevronRight size={ms(15)} color={foodTheme.primary} strokeWidth={2.5} />
          </TouchableOpacity>
        ) : null)}
    </View>
  );
});

export default SectionHeader;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: ms(16),
    fontWeight: '700',
    color: foodTheme.textPrimary,
    flexShrink: 1,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: vs(32),
    paddingHorizontal: hs(4),
    marginLeft: hs(8),
  },
  seeAllText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: foodTheme.primaryDeep,
  },
});
