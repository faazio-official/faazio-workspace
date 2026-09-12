import React from 'react';
import { StyleSheet, View } from 'react-native';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { RadioRow, type RadioOption } from './RadioRow';
import { BLOOD_TEXT, BLOOD_TEXT_MUTED } from '../tokens';

interface RadioGroupFieldProps<T extends string> {
  label: string;
  /** Show the required `*` after the label. */
  required?: boolean;
  /** Optional muted hint line under the label. */
  hint?: string;
  options: readonly RadioOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
}

/** Generic question block: label + optional `*` + optional hint + a radio row. */
export function RadioGroupField<T extends string>({
  label,
  required = false,
  hint,
  options,
  value,
  onChange,
}: RadioGroupFieldProps<T>) {
  return (
    <View style={styles.block}>
      <AppText style={styles.label}>
        {label} {required ? <AppText style={styles.req}>*</AppText> : null}
      </AppText>
      {hint ? <AppText style={styles.hint}>{hint}</AppText> : null}
      <RadioRow<T> options={options} value={value} onChange={onChange} />
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
  hint: {
    fontSize: ms(11),
    color: BLOOD_TEXT_MUTED,
    marginTop: vs(-4),
  },
});
