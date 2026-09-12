import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet, type TextInput } from 'react-native';
import { ChevronLeft, Search, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppTextInput from '@/components/AppTextInput';
import { hs, ms, vs } from '@/utils/responsive';

interface SearchHeaderProps {
  onBack: () => void;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Forwarded ref to the underlying text input (autofocus from parent). */
  inputRef?: React.RefObject<TextInput | null>;
  /** Called on the keyboard search/return action. */
  onSubmit?: () => void;
}

/**
 * Shared search header — back chevron (left) beside a pill search bar. The bar
 * carries an X clear button on the right that is disabled while the input is
 * empty and becomes active once the user types.
 */
const SearchHeader = memo(function SearchHeader({
  onBack,
  value,
  onChangeText,
  placeholder = 'Search…',
  inputRef,
  onSubmit,
}: SearchHeaderProps) {
  const insets = useSafeAreaInsets();
  const hasText = value.length > 0;

  return (
    <View style={[styles.bar, { paddingTop: insets.top + vs(6) }]}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.backBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <ChevronLeft size={ms(24)} color="#111827" strokeWidth={2.4} />
      </TouchableOpacity>

      <View style={styles.searchPill}>
        <Search size={ms(18)} color="#94A3B8" strokeWidth={2.2} />
        <AppTextInput
          ref={inputRef}
          style={styles.searchInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={onSubmit}
        />
        <TouchableOpacity
          onPress={() => onChangeText('')}
          disabled={!hasText}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.clearBtn}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          accessibilityState={{ disabled: !hasText }}
        >
          <X size={ms(16)} color={hasText ? '#111827' : '#D1D5DB'} strokeWidth={2.4} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

export default SearchHeader;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
    paddingHorizontal: hs(12),
    paddingBottom: vs(10),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  backBtn: {
    width: ms(40),
    height: vs(40),
    borderRadius: ms(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    height: vs(42),
    paddingHorizontal: hs(14),
    borderRadius: 999,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  searchInput: {
    flex: 1,
    fontSize: ms(13),
    color: '#111827',
    paddingVertical: 0,
    height: vs(26),
    textAlignVertical: 'center',
  },
  clearBtn: {
    width: ms(22),
    height: vs(22),
    borderRadius: ms(11),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
