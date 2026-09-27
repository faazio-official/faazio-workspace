import React from 'react';
import { StyleSheet, View } from 'react-native';
import AppText from '@/components/AppText';
import { hs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { BLOOD_GROUPS } from '@data/index';
import type { BloodGroup, BloodDonorDraft } from '@data/index';
import { InfoBanner } from './InfoBanner';
import { OptionChipGrid } from './OptionChipGrid';
import { BLOOD_TEXT } from '../tokens';

interface BloodDetailsStepProps {
  draft: BloodDonorDraft;
  onUpdate: (patch: Partial<BloodDonorDraft>) => void;
}

export function BloodDetailsStep({ draft, onUpdate }: BloodDetailsStepProps) {
  return (
    <View style={styles.section}>
      <View style={styles.block}>
        <AppText style={styles.label}>Blood Group <AppText style={styles.req}>*</AppText></AppText>
        <OptionChipGrid<BloodGroup>
          options={BLOOD_GROUPS}
          selected={draft.bloodGroup}
          onSelect={(group) => onUpdate({ bloodGroup: group })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: SPACE.SECTION,
  },
  block: {
    gap: SPACE.BLOCK,
  },
  label: {
    fontSize: ms(14),
    fontWeight: '700',
    color: BLOOD_TEXT,
  },
  req: {
    color: '#EF4444',
  },
});
