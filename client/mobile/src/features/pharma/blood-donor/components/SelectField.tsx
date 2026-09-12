import React, { useState, type ReactNode } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { ChevronDown, ChevronRight, Check } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import SlideUpSheet from '@/components/shared/SlideUpSheet';
import { BLOOD_RED, BLOOD_RED_SOFT, BLOOD_TEXT, BLOOD_TEXT_MUTED, BLOOD_BORDER, BLOOD_RADII } from '../tokens';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectFieldProps<T extends string> {
  label: string;
  placeholder: string;
  options: readonly SelectOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  required?: boolean;
  /** Optional leading icon rendered inside the field (e.g. a clock). */
  leadingIcon?: ReactNode;
  /** Trailing chevron direction (defaults to `down`). */
  chevron?: 'down' | 'right';
}

/** Pressable field that opens a bottom sheet of selectable options. */
export function SelectField<T extends string>({
  label,
  placeholder,
  options,
  value,
  onChange,
  required = false,
  leadingIcon,
  chevron = 'down',
}: SelectFieldProps<T>) {
  const [visible, setVisible] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.block}>
      <AppText style={styles.label}>
        {label} {required ? <AppText style={styles.req}>*</AppText> : null}
      </AppText>

      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={styles.field}
        activeOpacity={0.8}
        accessibilityRole="button"
      >
        {leadingIcon}
        <AppText style={[styles.valueText, !selected && styles.placeholder]}>
          {selected ? selected.label : placeholder}
        </AppText>
        {chevron === 'right' ? (
          <ChevronRight size={ms(18)} color={BLOOD_TEXT_MUTED} strokeWidth={2.2} />
        ) : (
          <ChevronDown size={ms(18)} color={BLOOD_TEXT_MUTED} strokeWidth={2.2} />
        )}
      </TouchableOpacity>

      <SlideUpSheet visible={visible} onRequestClose={() => setVisible(false)}>
        <View style={styles.sheetHeader}>
          <AppText style={styles.sheetTitle}>{label}</AppText>
        </View>
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <TouchableOpacity
              key={option.value}
              style={styles.option}
              activeOpacity={0.7}
              onPress={() => {
                onChange(option.value);
                setVisible(false);
              }}
            >
              <AppText style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                {option.label}
              </AppText>
              {isSelected ? (
                <View style={styles.checkBox}>
                  <Check size={ms(13)} color="#ffffff" strokeWidth={3} />
                </View>
              ) : (
                <View style={styles.emptyCircle} />
              )}
            </TouchableOpacity>
          );
        })}
      </SlideUpSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: vs(8),
  },
  label: {
    fontSize: ms(14),
    fontWeight: '700',
    color: BLOOD_TEXT,
  },
  req: {
    color: '#EF4444',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: hs(10),
    height: ms(52),
    borderRadius: BLOOD_RADII.chip,
    borderWidth: 1.5,
    borderColor: BLOOD_BORDER,
    backgroundColor: '#ffffff',
    paddingHorizontal: hs(16),
  },
  valueText: {
    flex: 1,
    fontSize: ms(14),
    fontWeight: '600',
    color: BLOOD_TEXT,
  },
  placeholder: {
    color: BLOOD_TEXT_MUTED,
    fontWeight: '500',
  },
  sheetHeader: {
    width: '100%',
    paddingBottom: vs(8),
  },
  sheetTitle: {
    fontSize: ms(16),
    fontWeight: '800',
    color: BLOOD_TEXT,
    textAlign: 'center',
  },
  option: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: vs(14),
    borderBottomWidth: 1,
    borderBottomColor: BLOOD_BORDER,
  },
  optionText: {
    fontSize: ms(14),
    fontWeight: '600',
    color: BLOOD_TEXT,
  },
  optionTextSelected: {
    color: BLOOD_RED,
    fontWeight: '800',
  },
  checkBox: {
    width: ms(22),
    height: ms(22),
    borderRadius: ms(11),
    backgroundColor: BLOOD_RED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCircle: {
    width: ms(22),
    height: ms(22),
    borderRadius: ms(11),
    borderWidth: 2,
    borderColor: BLOOD_BORDER,
  },
});
