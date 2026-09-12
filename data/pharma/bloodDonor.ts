/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 *
 * Blood Donor feature contract: types, wizard step registry, option lists and copy
 * live in the data layer (SDUI direction) so the mobile feature and store both
 * consume the same source of truth.
 */

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'O+' | 'O-' | 'AB+' | 'AB-';

export type YesNo = 'yes' | 'no';

/** Age-range ids used by the health & eligibility step. */
export type AgeRangeId = '18-24' | '25-34' | '35-44' | '45-54' | '55-65';

/** Preferred donation-type ids used by the availability step. */
export type DonationTypeId = 'hospital' | 'blood-bank' | 'both';

/** Notification-source ids used by the notifications (alerts) step. */
export type NotificationSourceId = 'hospitals' | 'bloodBanks' | 'emergencyAlerts';

/** Per-step answers captured during the registration wizard (before submit). */
export interface BloodDonorDraft {
  bloodGroup: BloodGroup | null;
  ageRange: AgeRangeId | null;
  weightKg: number | null;
  goodHealth: YesNo | null;
  donatedBefore: YesNo | null;
  chronicConditions: YesNo | null;
  onMedication: YesNo | null;
  preferredLocation: string | null;
  willingToTravel: YesNo | null;
  donationType: DonationTypeId | null;
  /** Opt-in alert preferences (default ON — a toggle is an opt-out, not a claim). */
  notificationPrefs: Record<NotificationSourceId, boolean>;
  /** Consent ticked on the Review step (default OFF — never pre-seeded). */
  consentGiven: boolean;
}

/** Committed registration produced on wizard completion (snapshot of the draft). */
export interface BloodDonorRegistration {
  id: string;
  /** ISO timestamp of when the registration was submitted. */
  registeredAt: string;
  profile: BloodDonorDraft;
  /** Phone of the logged-in account at submit time; null if none on file. */
  accountPhone: string | null;
}

/** Wizard step descriptor rendered by the dynamic stepper. */
export interface BloodDonorStep {
  id: string;
  /** Short label shown under the stepper circle. */
  label: string;
  /** Step heading (e.g. "Your Blood Details"). */
  title: string;
  /** Sub-heading shown under the title. */
  subtitle: string;
  /** Whether the "Every drop counts" info banner shows on this step. */
  showBanner?: boolean;
}

/** Ordered wizard step registry (single source of truth for the stepper + nav). */
export const BLOOD_DONOR_STEPS: BloodDonorStep[] = [
  {
    id: 'blood-details',
    label: 'Blood Details',
    title: 'Your Blood Details',
    subtitle: 'Tell us about your blood type and basic details.',
    showBanner: true,
  },
  {
    id: 'health-info',
    label: 'Health Info',
    title: 'Health & Eligibility',
    subtitle: 'Help us keep the donation process safe for you and the recipient.',
  },
  {
    id: 'availability',
    label: 'Availability',
    title: 'Availability & Location',
    subtitle: 'Let us know when and where you can donate.',
  },
  {
    id: 'notifications',
    label: 'Alerts',
    title: 'Notification Preferences',
    subtitle: 'Choose who can notify you about donation requests in your area.',
  },
  {
    id: 'review',
    label: 'Review',
    title: 'Review & Confirm',
    subtitle: 'Check your details before you submit.',
  },
];

/** All selectable blood-group chips (2 rows × 4). */
export const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export const BLOOD_DONOR_BANNER = {
  title: 'Every drop counts',
  subtitle: 'Help save lives with the right match.',
};

/** Age-range options for the health & eligibility step (voluntary-donation band). */
export const AGE_RANGES: { id: AgeRangeId; label: string }[] = [
  { id: '18-24', label: '18–24 years' },
  { id: '25-34', label: '25–34 years' },
  { id: '35-44', label: '35–44 years' },
  { id: '45-54', label: '45–54 years' },
  { id: '55-65', label: '55–65 years' },
];

/** Shared Yes/No radio options used by every health question. */
export const YES_NO_OPTIONS: { value: YesNo; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

/** The four Yes/No eligibility questions on the health & eligibility step. */
export interface HealthYesNoQuestion {
  id: 'goodHealth' | 'donatedBefore' | 'chronicConditions' | 'onMedication';
  label: string;
  hint?: string;
}

export const HEALTH_YESNO_QUESTIONS: HealthYesNoQuestion[] = [
  { id: 'goodHealth', label: 'Are you in good health today?' },
  {
    id: 'donatedBefore',
    label: 'Have you donated blood in the last 3 months?',
  },
  {
    id: 'chronicConditions',
    label: 'Do you have any chronic conditions?',
    hint: '(e.g., diabetes, blood pressure, etc.)',
  },
  {
    id: 'onMedication',
    label: 'Are you currently on any medication?',
  },
];

/** Weight input bounds (format validation only — no medical deferral rules). */
export const WEIGHT_LIMITS = {
  min: 20,
  max: 300,
};

/** Preferred donation-type options for the availability step (optional, no `*`). */
export const DONATION_TYPES: { value: DonationTypeId; label: string }[] = [
  { value: 'hospital', label: 'At Hospital' },
  { value: 'blood-bank', label: 'At Blood Bank' },
  { value: 'both', label: 'Both' },
];

/** Minimum trimmed length for the free-text preferred-location input. */
export const LOCATION_MIN_LENGTH = 3;

/** Notification source rows (id → the feature maps each id to an icon). */
export const NOTIFICATION_SOURCES: { id: NotificationSourceId; label: string }[] = [
  { id: 'hospitals', label: 'Hospitals' },
  { id: 'bloodBanks', label: 'Blood Banks' },
  { id: 'emergencyAlerts', label: 'Emergency Alerts' },
];

/** Copy for the notifications step's info banner (delivery is a backend concern). */
export const NOTIFICATIONS_BANNER = {
  message: 'We will only notify you when there is a matching donation request in your area.',
};

/** Consent checkbox label on the Review step. */
export const CONSENT_LABEL = 'I agree to be contacted about blood donation requests that match my profile.';

/** Privacy note shown under the Complete Registration button. */
export const PRIVACY_NOTE = 'Your information is safe and secure. We never share your data without consent.';
