import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { PHARMA_TEAL } from '../../mocks/pharmaHomeFeed';

interface PharmaSectionHeaderProps {
  title: string;
  onViewAll?: () => void;
}

const PharmaSectionHeader = memo(function PharmaSectionHeader({
  title,
  onViewAll,
}: PharmaSectionHeaderProps) {
  return (
    <View style={styles.row}>
      <AppText style={styles.title} numberOfLines={1}>
        {title}
      </AppText>
      <TouchableOpacity
        onPress={onViewAll}
        style={styles.viewAllBtn}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={`${title}, view all`}
      >
        <AppText style={styles.viewAllText}>View all</AppText>
        <ChevronRight size={ms(14)} color={PHARMA_TEAL} strokeWidth={2.6} />
      </TouchableOpacity>
    </View>
  );
});

export default PharmaSectionHeader;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingVertical: vs(10),
  },
  title: {
    fontSize: ms(16),
    fontWeight: '800',
    color: PHARMA_TEAL,
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
    color: PHARMA_TEAL,
  },
});
