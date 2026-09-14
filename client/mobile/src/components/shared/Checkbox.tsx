import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Check, Minus } from 'lucide-react-native';
import { hs, ms } from '@/utils/responsive';

interface CheckboxProps {
  checked: boolean;
  onToggle: () => void;
  /** When true, renders a minus (partial group selection) instead of a check. */
  indeterminate?: boolean;
  disabled?: boolean;
  size?: number;
}

/**
 * Shared rounded checkbox primitive. Mirrors the visual language first
 * established in CoinsRedeemRow: grey `#D1D5DB` border when unchecked, filled
 * green `#118C4F` with a white check when checked. Used for cart item selection
 * and category group selection.
 */
export default function Checkbox({
  checked,
  onToggle,
  indeterminate = false,
  disabled = false,
  size = 22,
}: CheckboxProps) {
  const box = ms(size);
  const filled = checked || indeterminate;
  return (
    <TouchableOpacity
      onPress={onToggle}
      disabled={disabled}
      style={[
        styles.box,
        { width: box, height: box, borderRadius: ms(size / 3) },
        filled && styles.boxFilled,
        disabled && styles.boxDisabled,
      ]}
      activeOpacity={0.8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
    >
      {indeterminate ? (
        <Minus size={ms(size * 0.6)} color="#ffffff" strokeWidth={3} />
      ) : checked ? (
        <Check size={ms(size * 0.6)} color="#ffffff" strokeWidth={3} />
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1.6,
    borderColor: '#D1D5DB',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: {
    backgroundColor: '#118C4F',
    borderColor: '#118C4F',
  },
  boxDisabled: {
    opacity: 0.4,
  },
});
