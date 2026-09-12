import React from 'react';
import { YES_NO_OPTIONS } from '@data/index';
import type { YesNo } from '@data/index';
import { RadioGroupField } from './RadioGroupField';

interface YesNoFieldProps {
  label: string;
  hint?: string;
  value: YesNo | null;
  onChange: (value: YesNo) => void;
}

/** Yes/No question block — a thin wrapper over the generic `RadioGroupField`. */
export function YesNoField({ label, hint, value, onChange }: YesNoFieldProps) {
  return (
    <RadioGroupField<YesNo>
      label={label}
      required
      hint={hint}
      options={YES_NO_OPTIONS}
      value={value}
      onChange={onChange}
    />
  );
}
