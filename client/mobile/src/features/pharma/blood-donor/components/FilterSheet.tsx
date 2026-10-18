import React, { memo, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { BLOOD_GROUPS, type BloodGroup, type BloodRequestUrgency } from '@data/index';
import SlideUpSheet from '@/components/shared/SlideUpSheet';
import { OptionChipGrid } from './OptionChipGrid';
import { BLOOD_RED, BLOOD_TEXT, BLOOD_TEXT_MUTED, BLOOD_BORDER, BLOOD_RADII } from '../tokens';

/** The funnel filter state. `null`/`''` mean "no constraint". */
export interface BloodBoardFilters {
  bloodGroup: BloodGroup | null;
  urgency: BloodRequestUrgency | 'all';
  city: string;
}

export const EMPTY_BLOOD_FILTERS: BloodBoardFilters = { bloodGroup: null, urgency: 'all', city: '' };

const URGENCY_OPTIONS: { value: BloodRequestUrgency | 'all'; label: string }[] = [
  { value: 'all', label: 'Any urgency' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
];

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  value: BloodBoardFilters;
  onApply: (next: BloodBoardFilters) => void;
}

/** Blood-board filters (group / urgency / city) in the shared bottom sheet — no new route. */
const FilterSheet = memo(function FilterSheet({ visible, onClose, value, onApply }: FilterSheetProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<BloodBoardFilters>(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const apply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <SlideUpSheet visible={visible} onRequestClose={onClose}>
      <View style={styles.header}>
        <AppText style={styles.title}>Filter requests</AppText>
        <TouchableOpacity onPress={() => setDraft(EMPTY_BLOOD_FILTERS)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Clear filters">
          <AppText style={styles.clear}>Clear</AppText>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.block}>
          <AppText style={styles.label}>Blood group</AppText>
          <OptionChipGrid<BloodGroup> options={BLOOD_GROUPS} selected={draft.bloodGroup} onSelect={(g) => setDraft((d) => ({ ...d, bloodGroup: d.bloodGroup === g ? null : g }))} />
        </View>

        <View style={styles.block}>
          <AppText style={styles.label}>Urgency</AppText>
          <View style={styles.urgencyRow}>
            {URGENCY_OPTIONS.map((opt) => {
              const active = draft.urgency === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setDraft((d) => ({ ...d, urgency: opt.value }))}
                  style={[styles.chip, active && styles.chipActive]}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <AppText style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</AppText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.block}>
          <AppText style={styles.label}>City</AppText>
          <View style={styles.field}>
            <AppTextInput style={styles.input} value={draft.city} onChangeText={(city) => setDraft((d) => ({ ...d, city }))} placeholder="e.g. Chennai" placeholderTextColor={BLOOD_TEXT_MUTED} autoCapitalize="words" returnKeyType="done" />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, vs(8)) }]}>
        <TouchableOpacity onPress={apply} style={styles.applyBtn} activeOpacity={0.85} accessibilityRole="button">
          <AppText style={styles.applyText}>Apply filters</AppText>
        </TouchableOpacity>
      </View>
    </SlideUpSheet>
  );
});

export default FilterSheet;

const styles = StyleSheet.create({
  header: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: ms(18), fontWeight: '900', color: BLOOD_TEXT },
  clear: { fontSize: ms(13), fontWeight: '800', color: BLOOD_RED },
  scroll: { width: '100%' },
  content: { paddingTop: SPACE.BLOCK, paddingBottom: SPACE.BLOCK, gap: SPACE.SECTION },
  block: { gap: SPACE.BLOCK, width: '100%' },
  label: { fontSize: ms(12), fontWeight: '900', color: BLOOD_TEXT },
  urgencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: hs(8) },
  chip: { borderRadius: BLOOD_RADII.pill, borderWidth: 1, borderColor: BLOOD_BORDER, backgroundColor: '#ffffff', paddingHorizontal: hs(14), paddingVertical: vs(7) },
  chipActive: { backgroundColor: BLOOD_RED, borderColor: BLOOD_RED },
  chipText: { fontSize: ms(11), fontWeight: '700', color: BLOOD_TEXT_MUTED },
  chipTextActive: { color: '#ffffff' },
  field: { borderWidth: 1, borderColor: BLOOD_BORDER, borderRadius: BLOOD_RADII.chip, backgroundColor: '#ffffff' },
  input: { minHeight: ms(48), paddingHorizontal: hs(14), color: BLOOD_TEXT, fontSize: ms(13) },
  footer: { width: '100%', paddingTop: SPACE.BLOCK },
  applyBtn: { minHeight: ms(48), borderRadius: BLOOD_RADII.pill, backgroundColor: BLOOD_RED, alignItems: 'center', justifyContent: 'center' },
  applyText: { color: '#ffffff', fontSize: ms(14), fontWeight: '900' },
});