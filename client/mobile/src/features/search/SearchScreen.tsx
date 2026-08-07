import React, { memo, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Search } from 'lucide-react-native';
import { hs, ms, vs } from '@/utils/responsive';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import SearchHeader from './SearchHeader';
import SegmentedToggle from './SegmentedToggle';
import FilterChipsRail from './FilterChipsRail';
import type { SearchScreenConfig } from './types';

interface SearchScreenProps {
  config: SearchScreenConfig;
  onBack: () => void;
  onClose: () => void;
}

/**
 * Shared search/listing screen shell. App-agnostic: the config supplies the
 * toggles, filter chips, data, card renderer and sort comparators. Renders the
 * header, free-text search input, segmented toggle, filter rail and the results
 * list. Bottom chrome (tab bar / floating cart) is owned by the parent screen.
 */
const SearchScreen = memo(function SearchScreen({ config, onBack, onClose }: SearchScreenProps) {
  const [activeKey, setActiveKey] = useState(config.toggles[0]?.key ?? '');
  const [query, setQuery] = useState('');
  const [activeFilterIds, setActiveFilterIds] = useState<string[]>([]);
  const [activeSortId, setActiveSortId] = useState(config.sortOptions[0]?.id ?? '');

  const mode = config.modes[activeKey];

  const items = useMemo(() => {
    if (!mode) return [];
    const filtered = mode.data.filter((item) => mode.predicate(item, query, activeFilterIds));
    const sorter = mode.sorters[activeSortId];
    return sorter ? [...filtered].sort(sorter) : filtered;
  }, [mode, query, activeFilterIds, activeSortId]);

  const toggleFilter = (id: string) => {
    setActiveFilterIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    if (!mode) return null;
    return mode.renderCard(item);
  };

  const empty = items.length === 0 ? (mode?.empty ?? <EmptyState query={query} />) : null;

  return (
    <View style={styles.container}>
      <SearchHeader title={config.title} onBack={onBack} onClose={onClose} />

      <View style={styles.searchWrap}>
        <Search size={ms(15)} color="#94A3B8" strokeWidth={2.2} />
        <AppTextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={config.searchPlaceholder ?? 'Search…'}
          placeholderTextColor="#94A3B8"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <AppText style={styles.clearText}>Clear</AppText>
          </TouchableOpacity>
        ) : null}
      </View>

      <SegmentedToggle options={config.toggles} activeKey={activeKey} onChange={setActiveKey} />

      <FilterChipsRail
        chips={config.filterChips}
        activeIds={activeFilterIds}
        onToggleChip={toggleFilter}
        sortOptions={config.sortOptions}
        activeSortId={activeSortId}
        onSelectSort={setActiveSortId}
        accentColor={config.accentColor}
      />

      <FlatList
        data={items}
        keyExtractor={config.keyFor ?? ((item: any, index: number) => String((item as { id?: string })?.id ?? `item-${index}`))}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={empty}
        bounces={false}
      />
    </View>
  );
});

function EmptyState({ query }: { query: string }) {
  return (
    <View style={styles.empty}>
      <AppText style={styles.emptyEmoji}>🔍</AppText>
      <AppText style={styles.emptyTitle}>No results found</AppText>
      <AppText style={styles.emptySub}>
        {query ? `Nothing matches "${query}". Try a different search.` : 'Try adjusting your filters.'}
      </AppText>
    </View>
  );
}

export default SearchScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    marginHorizontal: hs(16),
    marginTop: vs(10),
    marginBottom: vs(4),
    paddingHorizontal: hs(12),
    borderRadius: ms(12),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    minHeight: vs(42),
  },
  searchInput: {
    flex: 1,
    fontSize: ms(13),
    color: '#111827',
    paddingVertical: 0,
  },
  clearText: {
    fontSize: ms(12),
    fontWeight: '700',
    color: '#FF4500',
  },
  listContent: {
    paddingTop: vs(10),
    paddingBottom: vs(120),
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(32),
    paddingVertical: vs(60),
    gap: vs(6),
  },
  emptyEmoji: {
    fontSize: ms(34),
    marginBottom: vs(6),
  },
  emptyTitle: {
    fontSize: ms(15),
    fontWeight: '700',
    color: '#111827',
  },
  emptySub: {
    fontSize: ms(12),
    fontWeight: '400',
    color: '#666666',
    textAlign: 'center',
    lineHeight: ms(17),
  },
});
