import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';

interface SearchHeaderProps {
  title: string;
  onBack: () => void;
  onClose: () => void;
}

/**
 * Shared search header — back chevron (left), bold centered title, close icon
 * (right). White bar with a subtle bottom border, padded for the status bar.
 */
const SearchHeader = memo(function SearchHeader({ title, onBack, onClose }: SearchHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + vs(6) }]}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.iconBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <ChevronLeft size={ms(24)} color="#111827" strokeWidth={2.4} />
      </TouchableOpacity>

      <AppText style={styles.title} numberOfLines={1}>
        {title}
      </AppText>

      <TouchableOpacity
        onPress={onClose}
        style={styles.iconBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Close search"
      >
        <X size={ms(22)} color="#111827" strokeWidth={2.2} />
      </TouchableOpacity>
    </View>
  );
});

export default SearchHeader;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  iconBtn: {
    width: ms(40),
    height: vs(40),
    borderRadius: ms(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: ms(18),
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginHorizontal: hs(8),
  },
});
