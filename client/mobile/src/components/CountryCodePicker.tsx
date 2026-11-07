import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { neutral, parentRamp } from '@/theme/brandTokens';

export const COUNTRY_OPTIONS = [
  { code: 'IN', label: 'India', dial: '+91' },
  { code: 'US', label: 'United States', dial: '+1' },
  { code: 'CA', label: 'Canada', dial: '+1' },
  { code: 'AE', label: 'United Arab Emirates', dial: '+971' },
  { code: 'GB', label: 'United Kingdom', dial: '+44' },
  { code: 'SG', label: 'Singapore', dial: '+65' },
  { code: 'AU', label: 'Australia', dial: '+61' },
] as const;

export type CountryOptionCode = (typeof COUNTRY_OPTIONS)[number]['code'];

interface CountryCodePickerProps {
  /** Current ISO 3166-1 alpha-2 code, e.g. `IN`. */
  value: string;
  onChange: (code: CountryOptionCode) => void;
  disabled?: boolean;
}

export function CountryCodePicker({ value, onChange, disabled = false }: CountryCodePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = COUNTRY_OPTIONS.find((c) => c.code === value) ?? COUNTRY_OPTIONS[0];

  // A disabled picker must not leave an interactive sheet open behind the screen.
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const openPicker = useCallback(() => {
    if (!disabled) setOpen(true);
  }, [disabled]);

  const select = useCallback(
    (code: CountryOptionCode) => {
      setOpen(false);
      if (code !== value) onChange(code);
    },
    [onChange, value],
  );

  return (
    <>
      <TouchableOpacity
        onPress={openPicker}
        disabled={disabled}
        activeOpacity={0.75}
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        accessibilityRole="button"
        accessibilityLabel={`Country calling code ${selected.dial}. Change country`}
      >
        <AppText style={styles.dial}>{selected.dial}</AppText>
        <ChevronDown size={ms(16)} color={neutral.inkMuted} strokeWidth={2.2} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={styles.sheet}
            onPress={() => undefined}
            accessibilityViewIsModal
            accessibilityLabel="Country selection"
          >
            <AppText style={styles.sheetTitle}>Select country</AppText>
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            >
              {COUNTRY_OPTIONS.map((option) => {
                const isSelected = option.code === value;
                return (
                  <TouchableOpacity
                    key={option.code}
                    style={styles.row}
                    onPress={() => select(option.code)}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <AppText style={styles.rowDial}>{option.dial}</AppText>
                    <AppText style={styles.rowLabel}>{option.label}</AppText>
                    {isSelected ? (
                      <Check size={ms(18)} color={parentRamp.base} strokeWidth={2.4} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(4),
    height: Math.max(46, vs(46)),
    paddingHorizontal: hs(12),
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: neutral.border,
    backgroundColor: neutral.surface,
  },
  triggerDisabled: { opacity: 0.6 },
  dial: { fontSize: ms(14), fontWeight: '700', color: neutral.ink },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(24),
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    alignSelf: 'stretch',
    backgroundColor: neutral.card,
    borderRadius: ms(18),
    paddingVertical: vs(8),
    paddingHorizontal: hs(8),
  },
  list: { maxHeight: vs(360) },
  listContent: { paddingBottom: vs(4) },
  sheetTitle: {
    fontSize: ms(13),
    fontWeight: '900',
    color: neutral.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: hs(10),
    paddingVertical: vs(10),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
    paddingHorizontal: hs(10),
    paddingVertical: vs(12),
    borderRadius: ms(10),
  },
  rowDial: { width: hs(52), fontSize: ms(13), fontWeight: '800', color: neutral.inkMuted },
  rowLabel: { flex: 1, fontSize: ms(14), fontWeight: '600', color: neutral.ink },
});
