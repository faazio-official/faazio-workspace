import React from 'react';
import { StyleSheet, View } from 'react-native';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import { hs, vs, ms } from '@/utils/responsive';
import { AGE_RANGES, HEALTH_YESNO_QUESTIONS } from '@data/index';
import type { AgeRangeId, BloodDonorDraft, YesNo } from '@data/index';
import { SelectField } from './SelectField';
import { YesNoField } from './YesNoField';
import { BLOOD_TEXT, BLOOD_TEXT_MUTED, BLOOD_BORDER, BLOOD_RADII } from '../tokens';

interface HealthInfoStepProps {
  draft: BloodDonorDraft;
  onUpdate: (patch: Partial<BloodDonorDraft>) => void;
}

/** Sanitises weight input to digits + one decimal separator. */
function sanitizeWeight(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) return `${parts[0]}.${parts[1]}`;
  return cleaned;
}

export function HealthInfoStep({ draft, onUpdate }: HealthInfoStepProps) {
  const handleWeightChange = (text: string) => {
    const sanitized = sanitizeWeight(text);
    onUpdate({ weightKg: sanitized === '' ? null : Number(sanitized) });
  };

  const weightText = draft.weightKg === null ? '' : String(draft.weightKg);

  const ageOptions = AGE_RANGES.map((a) => ({ value: a.id, label: a.label }));

  return (
    <View style={styles.section}>
      <SelectField<AgeRangeId>
        label="Age"
        placeholder="Select age range"
        options={ageOptions}
        value={draft.ageRange}
        onChange={(ageRange) => onUpdate({ ageRange })}
        required
      />

      <View style={styles.block}>
        <AppText style={styles.label}>
          Weight <AppText style={styles.req}>*</AppText>
        </AppText>
        <View style={styles.weightField}>
          <AppTextInput
            style={styles.weightInput}
            value={weightText}
            onChangeText={handleWeightChange}
            keyboardType="decimal-pad"
            placeholder="Enter your weight"
            placeholderTextColor={BLOOD_TEXT_MUTED}
          />
          <View style={styles.weightUnit}>
            <AppText style={styles.weightUnitText}>kg</AppText>
          </View>
        </View>
      </View>

      {HEALTH_YESNO_QUESTIONS.map((q) => (
        <YesNoField
          key={q.id}
          label={q.label}
          hint={q.hint}
          value={draft[q.id] as YesNo | null}
          onChange={(value) => onUpdate({ [q.id]: value } as Partial<BloodDonorDraft>)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: vs(24),
  },
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
  weightField: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ms(52),
    borderRadius: BLOOD_RADII.chip,
    borderWidth: 1.5,
    borderColor: BLOOD_BORDER,
    backgroundColor: '#ffffff',
    paddingHorizontal: hs(16),
  },
  weightInput: {
    flex: 1,
    fontSize: ms(14),
    fontWeight: '600',
    color: BLOOD_TEXT,
    paddingVertical: 0,
  },
  weightUnit: {
    paddingVertical: vs(4),
    paddingHorizontal: hs(12),
    borderRadius: ms(8),
    backgroundColor: '#F1F5F9',
  },
  weightUnitText: {
    fontSize: ms(13),
    fontWeight: '700',
    color: BLOOD_TEXT_MUTED,
  },
});
