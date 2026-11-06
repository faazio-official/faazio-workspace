import React, { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import AppText from '@/components/AppText';
import SlideUpSheet from '@/components/shared/SlideUpSheet';
import { hs, ms, vs } from '@/utils/responsive';
import { neutral, parentRamp } from '@/theme/brandTokens';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  label: string;
  options: SelectOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Branded single-select backed by the shared SlideUpSheet. Keyboard-free, one tap to open, one tap
 * to choose — used for the seller onboarding app + category pickers.
 */
export default function SelectDropdown<T extends string>({
  label,
  options,
  value,
  onChange,
  required = false,
  placeholder = 'Select',
  disabled = false,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.fieldWrap}>
      <AppText style={styles.label}>
        {label}
        {required ? <AppText style={styles.required}> *</AppText> : null}
      </AppText>
      <TouchableOpacity
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        onPress={() => setOpen(true)}
        disabled={disabled}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: open }}
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
      >
        <AppText style={[styles.triggerText, !selected && styles.placeholder]} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </AppText>
        <ChevronDown size={ms(16)} color={neutral.inkSubtle} strokeWidth={2.2} />
      </TouchableOpacity>

      <SlideUpSheet visible={open} onRequestClose={() => setOpen(false)}>
        <View style={styles.sheetHeader}>
          <AppText style={styles.sheetTitle}>{label}</AppText>
        </View>
        <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
          {options.map((option) => {
            const active = option.value === value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.option, active && styles.optionActive]}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <AppText style={[styles.optionText, active && styles.optionTextActive]}>
                  {option.label}
                </AppText>
                {active ? <Check size={ms(16)} color={parentRamp.base} strokeWidth={2.6} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SlideUpSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldWrap: { marginTop: vs(12) },
  label: {
    fontSize: ms(11),
    fontWeight: '700',
    color: neutral.inkSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: vs(6),
  },
  required: { color: parentRamp.base },
  trigger: {
    minHeight: Math.max(46, vs(46)),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: hs(8),
    backgroundColor: neutral.surface,
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: neutral.border,
    paddingHorizontal: hs(12),
  },
  triggerDisabled: { opacity: 0.5 },
  triggerText: { flex: 1, fontSize: ms(14), fontWeight: '600', color: neutral.ink },
  placeholder: { color: neutral.inkSubtle, fontWeight: '500' },
  sheetHeader: { alignSelf: 'stretch', paddingBottom: vs(8) },
  sheetTitle: { fontSize: ms(15), fontWeight: '900', color: neutral.ink },
  sheetList: { alignSelf: 'stretch', maxHeight: vs(360) },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: vs(13),
    paddingHorizontal: hs(6),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: neutral.border,
  },
  optionActive: { backgroundColor: parentRamp.tint, borderRadius: ms(10) },
  optionText: { fontSize: ms(14), fontWeight: '600', color: neutral.inkMuted },
  optionTextActive: { color: parentRamp.base, fontWeight: '800' },
});
