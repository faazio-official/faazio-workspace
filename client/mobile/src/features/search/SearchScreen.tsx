import React, { memo, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, FlatList, type TextInput } from 'react-native';
import { hs, ms, vs } from '@/utils/responsive';
import AppText from '@/components/AppText';
import { useSearchStore } from '@/state/searchStore';
import SearchHeader from './SearchHeader';
import SegmentedToggle from './SegmentedToggle';
import FilterChipsRail from './FilterChipsRail';
import FilterSortBar from './FilterSortBar';
import RecentSearches from './RecentSearches';
import { useFacets } from './useFacets';
import type { ActiveFacets, SearchScreenConfig } from './types';

interface SearchScreenProps {
  config: SearchScreenConfig;
  onBack: () => void;
  /** Pre-seed the query (e.g. a term tapped from a Home shortcut). */
  initialQuery?: string;
  /** Input ref so a parent can focus the field after mount (fade transition). */
  inputRef?: React.RefObject<TextInput | null>;
}

/**
 * Shared search/listing screen shell. App-agnostic: the config supplies the
 * toggles, filter chips, data, card renderer, sort comparators and (optionally)
 * a facet schema. With a schema it switches to facet mode — a Filter + sort bar
 * and a facet overlay instead of the boolean chip rail. Recent searches show
 * while the query is empty.
 */
const SearchScreen = memo(function SearchScreen({
  config,
  onBack,
  initialQuery,
  inputRef,
}: SearchScreenProps) {
  const [activeKey, setActiveKey] = useState(config.toggles[0]?.key ?? '');
  const [query, setQuery] = useState(initialQuery ?? '');
  const [activeFilterIds, setActiveFilterIds] = useState<string[]>([]);
  const [activeSortId, setActiveSortId] = useState(config.sortOptions[0]?.id ?? '');
  const [activeFacets, setActiveFacets] = useState<ActiveFacets>({});

  const addRecentSearch = useSearchStore((s) => s.addRecentSearch);
  const fallbackInputRef = useRef<TextInput | null>(null);
  const headerInputRef = inputRef ?? fallbackInputRef;

  const mode = config.modes[activeKey];
  const hasFacets = !!config.facetSchema && config.facetSchema.length > 0;

  const items = useMemo(() => {
    if (!mode) return [];
    const filtered = mode.data.filter((item) =>
      mode.predicate(item, query, activeFilterIds, activeFacets),
    );
    const sorter = mode.sorters[activeSortId];
    return sorter ? [...filtered].sort(sorter) : filtered;
  }, [mode, query, activeFilterIds, activeFacets, activeSortId]);

  const facetGroups = useFacets({
    data: mode?.data ?? [],
    predicate: mode?.predicate ?? (() => true),
    query,
    chipIds: activeFilterIds,
    facetSchema: config.facetSchema,
    activeFacets,
  });

  const commitQuery = () => {
    const trimmed = query.trim();
    if (trimmed) {
      addRecentSearch(trimmed);
      headerInputRef.current?.blur();
    }
  };

  const toggleFilter = (id: string) => {
    setActiveFilterIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const applyFacets = (facets: ActiveFacets) => setActiveFacets(facets);

  const renderItem = ({ item }: { item: any }) => {
    if (!mode) return null;
    return mode.renderCard(item);
  };

  const empty = items.length === 0 ? (mode?.empty ?? <EmptyState query={query} />) : null;

  return (
    <View style={styles.container}>
      <SearchHeader
        onBack={onBack}
        value={query}
        onChangeText={setQuery}
        placeholder={config.searchPlaceholder}
        inputRef={headerInputRef}
        onSubmit={commitQuery}
      />

      <SegmentedToggle options={config.toggles} activeKey={activeKey} onChange={setActiveKey} />

      {query.trim().length === 0 ? (
        <RecentSearches onSelect={setQuery} accentColor={config.accentColor} />
      ) : null}

      {hasFacets ? (
        <FilterSortBar
          groups={facetGroups}
          activeFacets={activeFacets}
          onApply={applyFacets}
          sortOptions={config.sortOptions}
          activeSortId={activeSortId}
          onSelectSort={setActiveSortId}
          accentColor={config.accentColor}
        />
      ) : (
        <FilterChipsRail
          chips={config.filterChips}
          activeIds={activeFilterIds}
          onToggleChip={toggleFilter}
          sortOptions={config.sortOptions}
          activeSortId={activeSortId}
          onSelectSort={setActiveSortId}
          accentColor={config.accentColor}
        />
      )}

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
