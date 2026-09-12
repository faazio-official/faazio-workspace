import React, { memo } from 'react';
import { View, FlatList, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { ArrowUpLeft, Search } from 'lucide-react-native';
import { hs, ms, vs } from '@/utils/responsive';
import AppText from '@/components/AppText';
import type { SearchSuggestion } from './suggestions';

interface SearchSuggestionsProps {
  suggestions: SearchSuggestion[];
  query: string;
  accentColor?: string;
  onSelect: (term: string) => void;
}

/**
 * Flipkart-style type-ahead suggestion list shown while the user types but has
 * not yet committed. Full-bleed rows: thumbnail · title · blue "In <category>"
 * subtitle · ↖ ArrowUpLeft. When no product matches, a single "Search for
 * '<query>'" row lets the user run the exact free-text search.
 */
const SearchSuggestions = memo(function SearchSuggestions({
  suggestions,
  query,
  accentColor = '#2563EB',
  onSelect,
}: SearchSuggestionsProps) {
  const data: SearchSuggestion[] =
    suggestions.length > 0
      ? suggestions
      : [{ id: '__literal__', term: query, category: '' }];

  const renderRow = ({ item }: { item: SearchSuggestion }) => {
    const isLiteral = item.id === '__literal__';
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => onSelect(item.term)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={isLiteral ? `Search for ${item.term}` : item.term}
      >
        {isLiteral ? (
          <View style={styles.literalIcon}>
            <Search size={ms(16)} color={accentColor} strokeWidth={2.2} />
          </View>
        ) : item.image ? (
          <Image source={{ uri: item.image }} style={styles.thumb} resizeMode="contain" />
        ) : (
          <View style={styles.thumb} />
        )}

        <View style={styles.details}>
          <AppText style={styles.term} numberOfLines={1} ellipsizeMode="tail">
            {item.term}
          </AppText>
          {!isLiteral && item.category ? (
            <AppText style={[styles.category, { color: accentColor }]} numberOfLines={1}>
              In {item.category}
            </AppText>
          ) : null}
        </View>

        <ArrowUpLeft size={ms(15)} color="#9CA3AF" strokeWidth={2.2} />
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      renderItem={renderRow}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
      bounces={false}
    />
  );
});

export default SearchSuggestions;

const styles = StyleSheet.create({
  content: {
    paddingTop: vs(4),
    paddingBottom: vs(120),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
    paddingHorizontal: hs(12),
    paddingVertical: vs(9),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F2F4',
  },
  thumb: {
    width: ms(34),
    height: ms(34),
    borderRadius: ms(6),
    backgroundColor: '#F5F5F5',
  },
  literalIcon: {
    width: ms(34),
    height: ms(34),
    borderRadius: ms(6),
    backgroundColor: '#F0F6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    flex: 1,
    gap: vs(1),
  },
  term: {
    fontSize: ms(13),
    fontWeight: '500',
    color: '#1E2022',
  },
  category: {
    fontSize: ms(11),
    fontWeight: '600',
  },
});
