import React, { memo, useState } from 'react';
import { View, Modal, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { ChevronLeft, SlidersHorizontal, Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { brandRamp } from '@/theme/brandTokens';
import type { ActiveFacets, FacetGroup } from './types';

interface FilterOverlaySheetProps {
  visible: boolean;
  groups: FacetGroup[];
  /** Staged facet selections (not committed until Apply). */
  staged: ActiveFacets;
  /** Number of staged selections pending commit (drives the Apply badge). */
  stagedCount: number;
  onSelectGroup: (key: string) => void;
  onToggleOption: (facetKey: string, value: string) => void;
  onClearAll: () => void;
  onApply: () => void;
  /** Back chevron — discards staged changes and closes. */
  onClose: () => void;
  accentColor?: string;
}

/**
 * Full-screen facet overlay. Left rail lists the facet groups; the right pane
 * renders the selected group's options as checkboxes with live counts. The back
 * chevron discards staged changes; the footer's "Apply (N)" commits staged →
 * active and closes.
 */
const FilterOverlaySheet = memo(function FilterOverlaySheet({
  visible,
  groups,
  staged,
  stagedCount,
  onSelectGroup,
  onToggleOption,
  onClearAll,
  onApply,
  onClose,
  accentColor = brandRamp.FOOD.deep,
}: FilterOverlaySheetProps) {
  const insets = useSafeAreaInsets();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const activeGroupKey = selectedKey ?? groups[0]?.key ?? null;
  const activeGroup = groups.find((g) => g.key === activeGroupKey);
  const selectedValues = (activeGroupKey ? staged[activeGroupKey] : undefined) ?? [];

  const handleSelectGroup = (key: string) => {
    setSelectedKey(key);
    onSelectGroup(key);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Back (discard filters)"
          >
            <ChevronLeft size={ms(24)} color="#111827" strokeWidth={2.4} />
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            <SlidersHorizontal size={ms(16)} color="#111827" strokeWidth={2.4} />
            <AppText style={styles.headerTitle}>Filters</AppText>
          </View>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.body}>
          <ScrollView style={styles.rail} showsVerticalScrollIndicator={false}>
            {groups.map((group) => {
              const isActive = group.key === activeGroupKey;
              const groupCount = (staged[group.key] ?? []).length;
              return (
                <TouchableOpacity
                  key={group.key}
                  onPress={() => handleSelectGroup(group.key)}
                  style={[styles.railItem, isActive && { backgroundColor: `${accentColor}14` }]}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                >
                  <AppText style={[styles.railLabel, isActive && { color: accentColor, fontWeight: '800' }]}>
                    {group.label}
                  </AppText>
                  {groupCount > 0 ? (
                    <View style={[styles.railBadge, { backgroundColor: accentColor }]}>
                      <AppText style={styles.railBadgeText}>{groupCount}</AppText>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView style={styles.pane} showsVerticalScrollIndicator={false}>
            {activeGroup ? (
              activeGroup.options.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => onToggleOption(activeGroupKey, option.value)}
                    style={styles.optionRow}
                    activeOpacity={0.8}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                  >
                    <View style={[styles.checkbox, isSelected && { backgroundColor: accentColor, borderColor: accentColor }]}>
                      {isSelected ? <Check size={ms(13)} color="#FFFFFF" strokeWidth={3} /> : null}
                    </View>
                    <AppText style={styles.optionLabel} numberOfLines={1}>
                      {option.label}
                    </AppText>
                    <AppText style={styles.optionCount}>{option.count}</AppText>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyPane}>
                <AppText style={styles.emptyText}>No filters available</AppText>
              </View>
            )}
          </ScrollView>
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + vs(8) }]}>
          <TouchableOpacity onPress={onClearAll} style={styles.clearBtn} activeOpacity={0.8}>
            <AppText style={styles.clearText}>Clear all</AppText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onApply}
            style={[styles.applyBtn, { backgroundColor: accentColor }]}
            activeOpacity={0.85}
          >
            <AppText style={styles.applyText}>Apply {stagedCount > 0 ? `(${stagedCount})` : ''}</AppText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
});

export default FilterOverlaySheet;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(12),
    paddingVertical: vs(8),
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  backBtn: {
    width: ms(40),
    height: vs(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
  },
  headerTitle: {
    fontSize: ms(16),
    fontWeight: '800',
    color: '#111827',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  rail: {
    width: hs(120),
    backgroundColor: '#F7F8FA',
  },
  railItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingVertical: vs(15),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEF0F3',
  },
  railLabel: {
    fontSize: ms(12),
    fontWeight: '700',
    color: '#374151',
    flexShrink: 1,
  },
  railBadge: {
    minWidth: ms(16),
    height: ms(16),
    borderRadius: ms(8),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(3),
  },
  railBadgeText: {
    color: '#FFFFFF',
    fontSize: ms(9),
    fontWeight: '900',
  },
  pane: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(12),
    paddingHorizontal: hs(16),
    paddingVertical: vs(13),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  checkbox: {
    width: ms(20),
    height: ms(20),
    borderRadius: ms(6),
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: ms(13),
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  optionCount: {
    fontSize: ms(11),
    fontWeight: '700',
    color: '#94A3B8',
  },
  emptyPane: {
    padding: hs(24),
    alignItems: 'center',
  },
  emptyText: {
    fontSize: ms(12),
    color: '#94A3B8',
  },
  footer: {
    flexDirection: 'row',
    gap: hs(12),
    paddingHorizontal: hs(16),
    paddingTop: vs(10),
    borderTopWidth: 1,
    borderTopColor: '#EFEFEF',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: {
    fontSize: ms(14),
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
