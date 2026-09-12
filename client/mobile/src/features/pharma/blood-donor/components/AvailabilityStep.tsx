import React from 'react';
import { StyleSheet, View } from 'react-native';
import { hs, vs } from '@/utils/responsive';
import { DONATION_TYPES } from '@data/index';
import type { BloodDonorDraft, DonationTypeId } from '@data/index';
import { LocationField } from './LocationField';
import { YesNoField } from './YesNoField';
import { RadioGroupField } from './RadioGroupField';

interface AvailabilityStepProps {
  draft: BloodDonorDraft;
  onUpdate: (patch: Partial<BloodDonorDraft>) => void;
}

export function AvailabilityStep({ draft, onUpdate }: AvailabilityStepProps) {
  return (
    <View style={styles.section}>
      <LocationField
        label="Preferred Location"
        required
        value={draft.preferredLocation}
        onChange={(preferredLocation) => onUpdate({ preferredLocation })}
      />

      <YesNoField
        label="Willing to travel?"
        value={draft.willingToTravel}
        onChange={(willingToTravel) => onUpdate({ willingToTravel })}
      />

      <RadioGroupField<DonationTypeId>
        label="Preferred Donation Type"
        options={DONATION_TYPES}
        value={draft.donationType}
        onChange={(donationType) => onUpdate({ donationType })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: vs(24),
  },
});
