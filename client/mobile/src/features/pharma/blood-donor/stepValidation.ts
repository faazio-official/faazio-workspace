import { WEIGHT_LIMITS, LOCATION_MIN_LENGTH, BLOOD_DONOR_STEPS } from '@data/index';
import type { BloodDonorDraft } from '@data/index';

/** Single validation owner for the whole wizard — `BloodDonorScreen` stays dumb. */
export function isStepComplete(stepId: string, draft: BloodDonorDraft): boolean {
  switch (stepId) {
    case 'blood-details':
      return draft.bloodGroup !== null;
    case 'health-info':
      return (
        draft.ageRange !== null &&
        draft.weightKg !== null &&
        draft.weightKg >= WEIGHT_LIMITS.min &&
        draft.weightKg <= WEIGHT_LIMITS.max &&
        draft.goodHealth !== null &&
        draft.donatedBefore !== null &&
        draft.chronicConditions !== null &&
        draft.onMedication !== null
      );
    case 'availability':
      return (
        (draft.preferredLocation ?? '').trim().length >= LOCATION_MIN_LENGTH &&
        draft.willingToTravel !== null
      );
    case 'notifications':
      // No ungated inputs — toggles always carry a value and default ON.
      return true;
    case 'review':
      return (
        isStepComplete('blood-details', draft) &&
        isStepComplete('health-info', draft) &&
        isStepComplete('availability', draft) &&
        isStepComplete('notifications', draft) &&
        draft.consentGiven
      );
    default:
      return true;
  }
}

/**
 * Resume helper — the wizard re-opens at the first step that is still incomplete
 * (all complete → Review, the last step). Completeness-driven, so it can never
 * strand a user on an incomplete step and needs no extra persisted state.
 */
export function firstIncompleteStep(draft: BloodDonorDraft): number {
  for (let i = 0; i < BLOOD_DONOR_STEPS.length; i++) {
    if (!isStepComplete(BLOOD_DONOR_STEPS[i].id, draft)) return i;
  }
  return BLOOD_DONOR_STEPS.length - 1;
}
