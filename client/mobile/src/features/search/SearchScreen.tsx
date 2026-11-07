import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, type TextInput, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { Search, ArrowRight } from 'lucide-react-native';
import { hs, ms, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import AppText from '@/components/AppText';
import { useSearchStore } from '@/state/searchStore';
import SearchHeader from './SearchHeader';
import SegmentedToggle from './SegmentedToggle';
import FilterChipsRail from './FilterChipsRail';
import FilterSortBar from './FilterSortBar';
import RecentSearches from './RecentSearches';
import SearchSuggestions from './SearchSuggestions';
import { useFacets } from './useFacets';
import { gateway } from '@/services/api/GatewayClient';
import { useLiveOrigin } from '@/hooks/useLiveLocation';
import { ReportIssueButton } from '@/components/shared/ReportIssueButton';
import type { ActiveFacets, SearchScreenConfig } from './types';
import { semantic } from '@/theme/brandTokens';

const PAGE_SIZE = 10;

interface SearchScreenProps {
  config: SearchScreenConfig;
  onBack: () => void;
  /** Pre-seed the query (e.g. a term tapped from a Home shortcut). */
  initialQuery?: string;
  /** Open in a specific mode/toggle instead of the first one (e.g. 'dishes'). */
  initialMode?: string;
  /** Optional external ref to the search input. Falls back to an internal one when omitted; the field auto-focuses on mount regardless. */
  inputRef?: React.RefObject<TextInput | null>;
  /** Optional scroll callback forwarded to the underlying FlatList. */
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
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
  initialMode,
  inputRef,
  onScroll,
}: SearchScreenProps) {
  const defaultKey = config.toggles[0]?.key ?? '';
  const [activeKey, setActiveKey] = useState(
    initialMode && config.toggles.some((t) => t.key === initialMode) ? initialMode : defaultKey,
  );
  const [query, setQuery] = useState(initialQuery ?? '');
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery ?? '');
  const [activeFilterIds, setActiveFilterIds] = useState<string[]>([]);
  const [activeSortId, setActiveSortId] = useState(config.sortOptions[0]?.id ?? '');
  const [activeFacets, setActiveFacets] = useState<ActiveFacets>({});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const addRecentSearch = useSearchStore((s) => s.addRecentSearch);
  const liveOrigin = useLiveOrigin();
  const fallbackInputRef = useRef<TextInput | null>(null);
  const headerInputRef = inputRef ?? fallbackInputRef;

  useEffect(() => {
    const t = setTimeout(() => headerInputRef.current?.focus(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mode = config.modes[activeKey];
  const hasFacets = !!config.facetSchema && config.facetSchema.length > 0;
  const preSearch = submittedQuery.trim().length === 0;

  // Server-backed results: when a mode supplies `fetch` and a query is committed, the server pool
  // is the only source while online (authored `mode.data` is the offline/error fallback, never a
  // first paint that could flash stale prices).
  const [remoteData, setRemoteData] = useState<any[] | null>(null);
  const [remoteFailed, setRemoteFailed] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    setRemoteData(null);
    setRemoteFailed(false);
    if (preSearch || !mode?.fetch) {
      setFetching(false);
      return;
    }
    let active = true;
    setFetching(true);
    mode
      .fetch(submittedQuery)
      .then((rows) => {
        if (!active) return;
        setRemoteData(rows);
        // Behavior analytics (ID-only, allowlisted). The `search` event has no product id of
        // its own, so it is anchored to the top result — the closest stable ID available.
        const anchor = rows.find((r) => r?.id)?.id;
        if (anchor) void gateway.trackEvent(String(anchor), 'search').catch(() => {});
      })
      .catch(() => {
        if (active) setRemoteFailed(true);
      })
      .finally(() => {
        if (active) setFetching(false);
      });
    return () => {
      active = false;
    };
  }, [mode, submittedQuery, preSearch, retryKey]);

  // On a server failure the authored `mode.data` pool is used as an offline fallback and
  // filtered locally; `effectiveQuery` stays the typed query so the predicate still applies.
  const usingFallback = remoteFailed && !!mode?.data?.length;
  const dataPool = remoteData ?? (usingFallback ? mode!.data : []);
  const effectiveQuery = remoteData ? '' : submittedQuery;

  const allResults = useMemo(() => {
    if (!mode) return [];
    if (preSearch) return [];
    const filtered = dataPool.filter((item) =>
      mode.predicate(item, effectiveQuery, activeFilterIds, activeFacets),
    );
    const sorter = mode.sorters[activeSortId];
    const sorted = sorter ? [...filtered].sort(sorter) : filtered;
    // Relevance is nearby-first once a live fix exists; explicit sorts stay authoritative.
    if (!liveOrigin || activeSortId !== 'relevance' || !mode.distanceOf) return sorted;
    const distanceOf = mode.distanceOf;
    return [...sorted].sort((a, b) => {
      const da = distanceOf(a, liveOrigin);
      const db = distanceOf(b, liveOrigin);
      if (da === undefined && db === undefined) return 0;
      if (da === undefined) return 1;
      if (db === undefined) return -1;
      return da - db;
    });
  }, [
    mode,
    preSearch,
    effectiveQuery,
    activeFilterIds,
    activeFacets,
    activeSortId,
    dataPool,
    liveOrigin,
  ]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setIsLoadingMore(false);
  }, [submittedQuery, activeFilterIds, activeFacets, activeSortId, activeKey]);

  const visibleItems = useMemo(
    () => allResults.slice(0, visibleCount),
    [allResults, visibleCount],
  );

  const handleLoadMore = () => {
    if (preSearch) return;
    if (isLoadingMore) return;
    if (visibleCount >= allResults.length) return;
    // The full result set is already in memory, so reveal the next window immediately —
    // no artificial delay, which only made the list feel slower than it is.
    setVisibleCount((c) => Math.min(c + PAGE_SIZE, allResults.length));
  };

  const facetGroups = useFacets({
    data: dataPool,
    predicate: mode?.predicate ?? (() => true),
    query: effectiveQuery,
    chipIds: activeFilterIds,
    facetSchema: config.facetSchema,
    activeFacets,
  });

  const trimmedQuery = query.trim();
  const typing = trimmedQuery.length > 0 && trimmedQuery !== submittedQuery;
  const suggestions = useMemo(
    () =>
      typing && config.buildSuggestions && mode
        ? config.buildSuggestions(mode.data, trimmedQuery)
        : [],
    [typing, config.buildSuggestions, mode, trimmedQuery],
  );

  const commitQuery = () => {
    const trimmed = query.trim();
    setSubmittedQuery(trimmed);
    if (trimmed) {
      addRecentSearch(trimmed);
      headerInputRef.current?.blur();
    }
  };

  const handleSuggestionPress = (term: string) => {
    setQuery(term);
    setSubmittedQuery(term);
    addRecentSearch(term);
    headerInputRef.current?.blur();
  };

  const handleChangeText = (text: string) => {
    setQuery(text);
    if (text.trim().length === 0) setSubmittedQuery('');
  };

  const handleRecentSelect = (term: string) => {
    setQuery(term);
    setSubmittedQuery(term);
  };

  const toggleFilter = (id: string) => {
    setActiveFilterIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const applyFacets = (facets: ActiveFacets) => setActiveFacets(facets);

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    if (!mode) return null;
    return mode.renderCard(item, index);
  };

  const empty = preSearch
    ? null
    : allResults.length === 0
      ? remoteFailed && !usingFallback
        ? (
            <View style={styles.emptyErrorWrap}>
              <AppText style={styles.emptyErrorTitle}>Couldn’t reach search</AppText>
              <AppText style={styles.emptyErrorBody}>Check your connection and try again.</AppText>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => setRetryKey((key) => key + 1)}
                accessibilityRole="button"
                accessibilityLabel="Retry search"
              >
                <AppText style={styles.retryText}>Try again</AppText>
              </TouchableOpacity>
            </View>
          )
        : (mode?.empty ?? (
            <EmptyState
              accentColor={config.accentColor}
              hasQuery={submittedQuery.trim().length > 0}
              hasActiveFilters={activeFilterIds.length > 0 || Object.keys(activeFacets).length > 0}
              onClearQuery={() => {
                setQuery('');
                setSubmittedQuery('');
              }}
              onClearFilters={() => {
                setActiveFilterIds([]);
                setActiveFacets({});
              }}
            />
          ))
      : null;

  return (
    <View style={styles.container}>
      <SearchHeader
        onBack={onBack}
        value={query}
        onChangeText={handleChangeText}
        placeholder={config.searchPlaceholder}
        inputRef={headerInputRef}
        onSubmit={commitQuery}
        accentColor={config.accentColor}
      />

      {typing ? (
        <SearchSuggestions
          suggestions={suggestions}
          query={trimmedQuery}
          accentColor={config.accentColor}
          onSelect={handleSuggestionPress}
        />
      ) : preSearch ? (
        <RecentSearches onSelect={handleRecentSelect} accentColor={config.accentColor} />
      ) : (
        <>
          {config.showToggles !== false ? (
            <SegmentedToggle options={config.toggles} activeKey={activeKey} onChange={setActiveKey} />
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
        </>
      )}

      {!typing && usingFallback ? (
        <View style={styles.fallbackBanner}>
          <AppText style={styles.fallbackText}>Showing offline results</AppText>
        </View>
      ) : null}

      {!typing && (
        <FlatList
          data={visibleItems}
          keyExtractor={config.keyFor ?? ((item: any, index: number) => String((item as { id?: string })?.id ?? `item-${index}`))}
          renderItem={renderItem}
          numColumns={config.numColumns ?? 1}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            fetching ? (
              <ActivityIndicator
                size="small"
                color={config.accentColor ?? semantic.info}
                style={styles.listEmptySpinner}
              />
            ) : (
              <>
                {empty}
                {remoteFailed ? (
                  <ReportIssueButton context={`search "${submittedQuery}"`} />
                ) : null}
              </>
            )
          }
          ListFooterComponent={
            isLoadingMore && visibleCount < allResults.length ? (
              <ActivityIndicator size="small" color={config.accentColor ?? semantic.info} style={styles.listFooter} />
            ) : null
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.2}
          bounces={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        />
      )}
    </View>
  );
});

function EmptyState({
  accentColor,
  hasQuery,
  hasActiveFilters,
  onClearQuery,
  onClearFilters,
}: {
  accentColor?: string;
  hasQuery?: boolean;
  hasActiveFilters?: boolean;
  onClearQuery?: () => void;
  onClearFilters?: () => void;
}) {
  const linkColor = accentColor ?? semantic.info;
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIconCircle}>
        <Search size={ms(27)} strokeWidth={1.75} color="#6B7280" />
      </View>
      <AppText style={styles.emptyTitle}>No results found</AppText>
      <View style={styles.emptyLinks}>
        {hasQuery && onClearQuery ? (
          <TouchableOpacity
            onPress={onClearQuery}
            style={styles.emptyLink}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <AppText style={[styles.emptyLinkText, { color: linkColor }]}>Try another search</AppText>
            <ArrowRight size={ms(14)} strokeWidth={2} color={linkColor} />
          </TouchableOpacity>
        ) : null}
        {hasActiveFilters && onClearFilters ? (
          <TouchableOpacity
            onPress={onClearFilters}
            style={styles.emptyLink}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <AppText style={[styles.emptyLinkText, { color: linkColor }]}>Clear filters</AppText>
            <ArrowRight size={ms(14)} strokeWidth={2} color={linkColor} />
          </TouchableOpacity>
        ) : null}
      </View>
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
    paddingTop: SPACE.BLOCK,
    paddingBottom: vs(120),
    flexGrow: 1,
  },
  listFooter: {
    paddingVertical: vs(16),
  },
  listEmptySpinner: {
    marginTop: vs(32),
  },
  emptyErrorWrap: {
    alignItems: 'center',
    marginTop: vs(40),
    paddingHorizontal: hs(32),
  },
  emptyErrorTitle: {
    fontSize: ms(15),
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
  },
  emptyErrorBody: {
    fontSize: ms(13),
    color: '#64748b',
    textAlign: 'center',
    marginTop: vs(6),
  },
  retryBtn: {
    minHeight: 44,
    marginTop: vs(14),
    paddingHorizontal: hs(20),
    borderRadius: ms(22),
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    fontSize: ms(14),
    fontWeight: '600',
    color: '#0f172a',
  },
  fallbackBanner: {
    backgroundColor: '#FEF3C7',
    paddingVertical: vs(6),
    paddingHorizontal: hs(16),
  },
  fallbackText: {
    fontSize: ms(12),
    fontWeight: '500',
    color: '#854D0E',
  },
  emptyCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: '#F0F0F0',
    paddingVertical: vs(40),
    paddingHorizontal: hs(24),
    marginHorizontal: hs(16),
    marginTop: vs(8),
  },
  emptyIconCircle: {
    width: ms(56),
    height: ms(56),
    borderRadius: ms(28),
    backgroundColor: '#F0F3F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(14),
  },
  emptyTitle: {
    fontSize: ms(15),
    fontWeight: 'bold',
    color: '#1E2022',
  },
  emptyLinks: {
    alignItems: 'center',
    marginTop: SPACE.BLOCK,
    gap: SPACE.BLOCK,
  },
  emptyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(5),
  },
  emptyLinkText: {
    fontSize: ms(13),
    fontWeight: '600',
  },
});
