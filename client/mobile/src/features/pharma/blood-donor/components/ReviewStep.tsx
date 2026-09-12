import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Pencil, Check } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { AGE_RANGES, NOTIFICATION_SOURCES, CONSENT_LABEL } from '@data/index';
import type { BloodDonorDraft, YesNo } from '@data/index';
import { BLOOD_RED, BLOOD_TEXT, BLOOD_TEXT_MUTED, BLOOD_BORDER, BLOOD_RADII } from '../tokens';

interface ReviewStepProps {
  draft: BloodDonorDraft;
  onUpdate: (patch: Partial<BloodDonorDraft>) => void;
  /** Edit pencil → jump back to step 1 to revise answers. */
  onEdit: () => void;
}

/** Review rows render only what the wizard actually collected — no invented fields. */
function formatYesNo(value: YesNo | null): string {
  if (value === null) return '—';
  return value === 'yes' ? 'Yes' : 'No';
}

export function ReviewStep({ draft, onUpdate, onEdit }: ReviewStepProps) {
  const ageLabel = AGE_RANGES.find((a) => a.id === draft.ageRange)?.label ?? '—';
  const enabledSources = NOTIFICATION_SOURCES.filter(
    (s) => draft.notificationPrefs[s.id],
  ).map((s) => s.label);
  const notificationsSummary =
    enabledSources.length > 0 ? enabledSources.join(', ') : 'None';

  const rows: { label: string; value: string }[] = [
    { label: 'Blood Group', value: draft.bloodGroup ?? '—' },
    { label: 'Age', value: ageLabel },
    { label: 'Weight', value: draft.weightKg !== null ? `${draft.weightKg} kg` : '—' },
    { label: 'Good Health Today', value: formatYesNo(draft.goodHealth) },
    { label: 'Donated (Last 3 Months)', value: formatYesNo(draft.donatedBefore) },
    { label: 'Chronic Conditions', value: formatYesNo(draft.chronicConditions) },
    { label: 'On Medication', value: formatYesNo(draft.onMedication) },
    { label: 'Location', value: draft.preferredLocation ?? '—' },
    { label: 'Willing to Travel', value: formatYesNo(draft.willingToTravel) },
    { label: 'Notifications', value: notificationsSummary },
  ];

  return (
    <View style={styles.section}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <AppText style={styles.cardTitle}>Your Details</AppText>
          <TouchableOpacity
            onPress={onEdit}
            style={styles.editBtn}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Edit your details"
          >
            <Pencil size={ms(16)} color="#ffffff" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        {rows.map((row, idx) => (
          <View key={row.label} style={styles.rowWrap}>
            {idx > 0 ? <View style={styles.rowDivider} /> : null}
            <View style={styles.row}>
              <AppText style={styles.rowLabel}>{row.label}</AppText>
              <AppText style={styles.rowValue}>{row.value}</AppText>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity
        onPress={() => onUpdate({ consentGiven: !draft.consentGiven })}
        style={styles.consentRow}
        activeOpacity={0.8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: draft.consentGiven }}
      >
        <View style={[styles.checkbox, draft.consentGiven && styles.checkboxChecked]}>
          {draft.consentGiven && <Check size={ms(13)} color="#ffffff" strokeWidth={3.2} />}
        </View>
        <AppText style={styles.consentText}>{CONSENT_LABEL}</AppText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: vs(20),
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: BLOOD_RADII.card,
    borderWidth: 1,
    borderColor: BLOOD_BORDER,
    paddingHorizontal: hs(18),
    paddingVertical: vs(16),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: vs(6),
  },
  cardTitle: {
    fontSize: ms(15),
    fontWeight: '900',
    color: BLOOD_TEXT,
  },
  editBtn: {
    width: ms(34),
    height: ms(34),
    borderRadius: ms(17),
    backgroundColor: BLOOD_RED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowWrap: {
    width: '100%',
  },
  rowDivider: {
    height: 1,
    backgroundColor: BLOOD_BORDER,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: hs(12),
    paddingVertical: vs(10),
  },
  rowLabel: {
    fontSize: ms(13),
    color: BLOOD_TEXT_MUTED,
    fontWeight: '600',
    flexShrink: 1,
  },
  rowValue: {
    fontSize: ms(13),
    color: BLOOD_TEXT,
    fontWeight: '800',
    textAlign: 'right',
    flexShrink: 1,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: hs(12),
  },
  checkbox: {
    width: ms(22),
    height: ms(22),
    borderRadius: ms(6),
    borderWidth: 2,
    borderColor: BLOOD_BORDER,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: vs(2),
  },
  checkboxChecked: {
    backgroundColor: BLOOD_RED,
    borderColor: BLOOD_RED,
  },
  consentText: {
    flex: 1,
    fontSize: ms(12),
    color: BLOOD_TEXT_MUTED,
    lineHeight: vs(17),
  },
});
