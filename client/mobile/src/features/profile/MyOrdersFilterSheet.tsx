import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { myOrdersStatusFilters } from '@data/index';
import type { MyOrdersStatusFilter } from '@data/types';
import SlideUpSheet from '@/components/shared/SlideUpSheet';
import AppText from '@/components/AppText';

interface MyOrdersFilterSheetProps {
  visible: boolean;
  /** Staged status selection (not committed until Apply). */
  staged: MyOrdersStatusFilter;
  /** Per-status order counts (labels from myOrdersStatusFilters). */
  counts: Record<string, number>;
  onSelectStatus: (s: MyOrdersStatusFilter) => void;
  onClear: () => void;
  onApply: () => void;
  /** Backdrop tap / back — discards staged changes and closes. */
  onClose: () => void;
}

const ACCENT = '#16A34A';

/**
 * Bottom sheet to filter orders by status. Single-select radio rows with live
 * counts; backdrop tap / back discards staged changes, "Apply" commits them.
 */
const MyOrdersFilterSheet = memo(function MyOrdersFilterSheet({
  visible,
  staged,
  counts,
  onSelectStatus,
  onClear,
  onApply,
  onClose,
}: MyOrdersFilterSheetProps) {
  const stagedCount = staged === 'All Orders' ? 0 : 1;

  return (
    <SlideUpSheet visible={visible} onRequestClose={onClose}>
      <View style={styles.header}>
        <AppText style={styles.title}>Filter orders</AppText>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Close filter"
        >
          <X size={ms(22)} color="#6B7280" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      <AppText style={styles.sectionLabel}>Order status</AppText>

      <View style={styles.options}>
        {myOrdersStatusFilters.map((filter) => {
          const isSelected = staged === filter.name;
          return (
            <TouchableOpacity
              key={filter.name}
              onPress={() => onSelectStatus(filter.name)}
              style={styles.optionRow}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
            >
              <View style={[styles.radio, isSelected && styles.radioActive]}>
                {isSelected ? <View style={styles.radioDot} /> : null}
              </View>
              <AppText style={[styles.optionLabel, isSelected && styles.optionLabelActive]}>
                {filter.name}
              </AppText>
              <AppText style={styles.optionCount}>{counts[filter.name] ?? 0}</AppText>
              {isSelected ? <Check size={ms(18)} color={ACCENT} strokeWidth={2.5} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity onPress={onClear} style={styles.clearBtn} activeOpacity={0.8}>
          <AppText style={styles.clearText}>Clear</AppText>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onApply}
          style={styles.applyBtn}
          activeOpacity={0.85}
        >
          <AppText style={styles.applyText}>Apply {stagedCount > 0 ? `(${stagedCount})` : ''}</AppText>
        </TouchableOpacity>
      </View>
    </SlideUpSheet>
  );
});

export default MyOrdersFilterSheet;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginTop: vs(6),
    marginBottom: vs(16),
  },
  title: {
    fontSize: ms(18),
    fontWeight: '800',
    color: '#111827',
  },
  closeBtn: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: ms(12),
    fontWeight: '700',
    color: '#9CA3AF',
    alignSelf: 'flex-start',
    marginBottom: vs(6),
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  options: {
    alignSelf: 'stretch',
    borderRadius: ms(12),
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(12),
    paddingHorizontal: hs(16),
    paddingVertical: vs(13),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEF1F5',
  },
  radio: {
    width: ms(20),
    height: ms(20),
    borderRadius: ms(10),
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: ACCENT,
  },
  radioDot: {
    width: ms(10),
    height: ms(10),
    borderRadius: ms(5),
    backgroundColor: ACCENT,
  },
  optionLabel: {
    flex: 1,
    fontSize: ms(14),
    fontWeight: '600',
    color: '#374151',
  },
  optionLabelActive: {
    color: '#111827',
    fontWeight: '700',
  },
  optionCount: {
    fontSize: ms(12),
    fontWeight: '700',
    color: '#94A3B8',
  },
  footer: {
    flexDirection: 'row',
    gap: hs(12),
    alignSelf: 'stretch',
    marginTop: vs(20),
  },
  clearBtn: {
    flex: 0.4,
    height: vs(48),
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    fontSize: ms(13),
    fontWeight: '700',
    color: '#374151',
  },
  applyBtn: {
    flex: 0.6,
    height: vs(48),
    borderRadius: ms(12),
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: {
    fontSize: ms(14),
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
