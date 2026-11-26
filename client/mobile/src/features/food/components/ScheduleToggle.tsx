import React, { memo } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';
import { useFoodFilterStore } from '@/state/foodFilterStore';

interface ScheduleToggleProps {
  /** Controlled value; omit to use the shared `foodFilterStore`. */
  value?: boolean;
  /** Controlled change handler; omit to write the shared `foodFilterStore`. */
  onChange?: (value: boolean) => void;
}

/**
 * Single "Pre-order" filter chip (0142). On = only restaurants that accept scheduled /
 * advance orders. Uncontrolled by default so it shares state with the Food home + search.
 */
const ScheduleToggle = memo(function ScheduleToggle({ value, onChange }: ScheduleToggleProps) {
  const storeValue = useFoodFilterStore((s) =>
    value === undefined ? s.scheduleOnly : undefined,
  );
  const setScheduleOnly = useFoodFilterStore((s) => s.setScheduleOnly);
  const active = value ?? storeValue ?? false;
  const handleChange = onChange ?? setScheduleOnly;

  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={() => handleChange(!active)}
      activeOpacity={0.8}
      accessibilityRole="switch"
      accessibilityLabel="Only restaurants accepting pre-orders"
      accessibilityState={{ checked: active }}
    >
      <AppText style={[styles.label, active && styles.labelActive]}>Pre-order</AppText>
    </TouchableOpacity>
  );
});

export default ScheduleToggle;

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: hs(10),
    paddingVertical: vs(6),
    borderRadius: ms(18),
    backgroundColor: '#ECECEC',
  },
  chipActive: {
    backgroundColor: foodTheme.primary,
  },
  label: {
    fontSize: ms(11),
    fontWeight: '700',
    color: '#6B7280',
  },
  labelActive: {
    color: '#FFFFFF',
  },
});
