import React, { memo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { X, Clock } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { brandRamp } from '@/theme/brandTokens';
import { useSearchStore } from '@/state/searchStore';

interface RecentSearchesProps {
  onSelect: (term: string) => void;
  accentColor?: string;
}

/**
 * Recent-search chips shown while the query is empty. Reads device-local recent
 * searches from the search store; selecting a chip seeds the query, and each
 * chip has an X to remove it.
 */
const RecentSearches = memo(function RecentSearches({
  onSelect,
  accentColor = brandRamp.FOOD.deep,
}: RecentSearchesProps) {
  const recent = useSearchStore((s) => s.recentSearches);
  const remove = useSearchStore((s) => s.removeRecentSearch);

  if (recent.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Clock size={ms(14)} color="#64748B" strokeWidth={2.4} />
          <AppText style={styles.title}>Recent Searches</AppText>
        </View>
        <TouchableOpacity
          onPress={() => useSearchStore.getState().clearRecentSearches()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Clear all recent searches"
        >
          <AppText style={styles.clear}>Clear</AppText>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        keyboardShouldPersistTaps="handled"
      >
        {recent.map((term) => (
          <View key={term} style={styles.chipRow}>
            <TouchableOpacity
              onPress={() => onSelect(term)}
              style={styles.chip}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Search ${term}`}
            >
              <AppText style={styles.chipText} numberOfLines={1}>
                {term}
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => remove(term)}
              style={styles.removeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${term}`}
            >
              <X size={ms(11)} color="#64748B" strokeWidth={2.6} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

export default RecentSearches;

const styles = StyleSheet.create({
  wrap: {
    paddingTop: vs(8),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingBottom: vs(8),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
  },
  title: {
    fontSize: ms(12),
    fontWeight: '800',
    color: '#1E293B',
  },
  clear: {
    fontSize: ms(11),
    fontWeight: '700',
    color: '#94A3B8',
  },
  chips: {
    paddingHorizontal: hs(16),
    gap: hs(8),
    alignItems: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: hs(14),
    paddingVertical: vs(8),
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    maxWidth: hs(220),
  },
  chipText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: '#374151',
  },
  removeBtn: {
    marginLeft: hs(8),
    width: ms(20),
    height: vs(20),
    borderRadius: ms(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
