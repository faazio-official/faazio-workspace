import React, { memo } from 'react';
import { ScrollView, TouchableOpacity, StyleSheet, View } from 'react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';

export interface SubgroupRailOption {
  id: string;
  title: string;
}

interface SubgroupTextRailProps {
  options: SubgroupRailOption[];
  activeId: string;
  accent: string;
  onSelect: (id: string) => void;
}

/**
 * Plain-text subgroup rail for the category drill-in page. Unlike the pill chips
 * elsewhere, these are text-only (no background/border); the active one is tinted
 * with the accent colour and an underline bar beneath it.
 */
const SubgroupTextRail = memo(function SubgroupTextRail({
  options,
  activeId,
  accent,
  onSelect,
}: SubgroupTextRailProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {options.map((opt) => {
        const active = opt.id === activeId;
        return (
          <TouchableOpacity
            key={opt.id}
            onPress={() => onSelect(opt.id)}
            activeOpacity={0.7}
            style={styles.item}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.title}
          >
            <AppText style={[styles.label, active && { color: accent }]}>
              {opt.title}
            </AppText>
            {active && <View style={[styles.underline, { backgroundColor: accent }]} />}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});

export default SubgroupTextRail;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: hs(16),
    gap: hs(20),
    alignItems: 'flex-start',
  },
  item: {
    alignItems: 'center',
    paddingVertical: vs(8),
  },
  label: {
    fontSize: ms(12.5),
    fontWeight: '700',
    color: '#64748b',
  },
  underline: {
    marginTop: vs(4),
    height: vs(3),
    borderRadius: ms(2),
    alignSelf: 'stretch',
  },
});
