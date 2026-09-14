/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 *
 * Blood Donor dashboard + request-details contract: the registered-donor feed
 * (donation requests), urgency semantics, detail fields and page copy live in the
 * data layer (SDUI direction) so the dashboard and detail page stay presentational
 * and a backend feed can replace the seed without touching UI code.
 */

import type { BloodGroup } from './bloodDonor';

/** Urgency band for a request — drives badge colors + the "For:" line emphasis. */
export type BloodRequestUrgency = 'urgent' | 'high' | 'normal';

/**
 * A hospital/blood-bank donation request shown on the registered-donor dashboard
 * and its detail page. Detail fields are required (never optional) — every seed
 * request is fully specified so the detail page renders only real data.
 */
export interface BloodRequest {
  id: string;
  /** Requesting hospital or blood bank. */
  hospital: string;
  /** City part of the request location (used by the "Nearby" filter). */
  city: string;
  /** State part of the request location. */
  state: string;
  /** Blood group required. */
  bloodGroup: BloodGroup;
  /** Units required. */
  unitsRequired: number;
  /** Short patient context shown as the "For: …" line / Purpose heading. */
  patientContext: string;
  /** Hours elapsed since the request was posted (relative label is computed). */
  postedHoursAgo: number;
  /** Deadline chip copy (e.g. "Needed within 6 hours"). */
  neededWithin: string;
  /** Whether the hospital is verified (green chip). */
  verified: boolean;
  /** Urgency band (badge color + For-line emphasis). */
  urgency: BloodRequestUrgency;
  /** Hospital photo (Unsplash, mock-stage convention). */
  imageUrl: string;
  /** One-line purpose description under the context (e.g. ICU status). */
  purposeDescription: string;
  /** Patient age in years. */
  patientAge: number;
  /** Patient gender label. */
  patientGender: string;
  /** Hospital contact number (tel: link). */
  hospitalContact: string;
  /** Full hospital address (map search query). */
  hospitalAddress: string;
  /** Coordinating-remarks note for the donor. */
  remarks: string;
  /** Distance from the donor's registered location (mock geo until backend). */
  distanceKm: number;
}

/**
 * Seed donation requests (dashboard feed + detail pages) — replaced by the
 * backend feed later. Realigned to the reference dashboard/detail designs.
 */
export const BLOOD_REQUESTS: BloodRequest[] = [
  {
    id: 'br-1',
    hospital: 'Government General Hospital',
    city: 'Chennai',
    state: 'Tamil Nadu',
    bloodGroup: 'O+',
    unitsRequired: 3,
    patientContext: 'Accident Patient (Emergency)',
    postedHoursAgo: 2,
    neededWithin: 'Needed within 24 hours',
    verified: true,
    urgency: 'urgent',
    imageUrl:
      'https://images.unsplash.com/photo-1586773867764-31fc3e2c1e1f?fm=jpg&fit=crop&q=80&w=400&h=400',
    purposeDescription: 'Patient is in the ICU and requires an immediate transfusion.',
    patientAge: 32,
    patientGender: 'Male',
    hospitalContact: '+91 98765 43210',
    hospitalAddress: 'Park Town, Chennai, Tamil Nadu',
    remarks: 'Donor should carry a valid ID proof at the time of donation.',
    distanceKm: 4.2,
  },
  {
    id: 'br-2',
    hospital: 'Apollo Hospitals',
    city: 'Chennai',
    state: 'Tamil Nadu',
    bloodGroup: 'A-',
    unitsRequired: 2,
    patientContext: 'Thalassemia patient — regular transfusion',
    postedHoursAgo: 5,
    neededWithin: 'Needed within 48 hours',
    verified: true,
    urgency: 'high',
    imageUrl:
      'https://images.unsplash.com/photo-1519494026892-80bbd2d6a0d4?fm=jpg&fit=crop&q=80&w=400&h=400',
    purposeDescription: 'Scheduled transfusion cycle; donor compatibility already confirmed.',
    patientAge: 27,
    patientGender: 'Female',
    hospitalContact: '+91 98450 11223',
    hospitalAddress: 'Greams Road, Chennai, Tamil Nadu',
    remarks: 'Prefer donors who have donated at Apollo before.',
    distanceKm: 6.8,
  },
  {
    id: 'br-3',
    hospital: 'MIOT International',
    city: 'Chennai',
    state: 'Tamil Nadu',
    bloodGroup: 'B+',
    unitsRequired: 1,
    patientContext: 'Cancer patient — platelet transfusion',
    postedHoursAgo: 8,
    neededWithin: 'Flexible date',
    verified: true,
    urgency: 'normal',
    imageUrl:
      'https://images.unsplash.com/photo-1538108149393-fbbd81895907?fm=jpg&fit=crop&q=80&w=400&h=400',
    purposeDescription: 'Oncology day-care unit; platelets needed for the ongoing cycle.',
    patientAge: 45,
    patientGender: 'Male',
    hospitalContact: '+91 97110 44556',
    hospitalAddress: 'Manapakkam, Chennai, Tamil Nadu',
    remarks: 'Platelet donors should be non-smokers.',
    distanceKm: 9.5,
  },
  {
    id: 'br-4',
    hospital: 'Global Hospitals',
    city: 'Chennai',
    state: 'Tamil Nadu',
    bloodGroup: 'AB+',
    unitsRequired: 4,
    patientContext: 'Emergency surgery patient',
    postedHoursAgo: 1,
    neededWithin: 'Needed within 6 hours',
    verified: true,
    urgency: 'urgent',
    imageUrl:
      'https://images.unsplash.com/photo-1587351021759-3e566e65f0c7?fm=jpg&fit=crop&q=80&w=400&h=400',
    purposeDescription: 'Cardiac surgery in progress; standby units required immediately.',
    patientAge: 58,
    patientGender: 'Male',
    hospitalContact: '+91 99410 88776',
    hospitalAddress: 'Perumbakkam, Chennai, Tamil Nadu',
    remarks: 'Hospital can arrange pickup for the donor if needed.',
    distanceKm: 12.3,
  },
  {
    id: 'br-5',
    hospital: 'Kauvery Hospital',
    city: 'Chennai',
    state: 'Tamil Nadu',
    bloodGroup: 'O-',
    unitsRequired: 1,
    patientContext: 'Postpartum complication patient',
    postedHoursAgo: 24,
    neededWithin: 'Needed within 72 hours',
    verified: true,
    urgency: 'normal',
    imageUrl:
      'https://images.unsplash.com/photo-1584467775842-be905dbd21a9?fm=jpg&fit=crop&q=80&w=400&h=400',
    purposeDescription: 'Obstetrics unit; O- units are critically low in stock.',
    patientAge: 30,
    patientGender: 'Female',
    hospitalContact: '+91 90030 22110',
    hospitalAddress: 'Alwarpet, Chennai, Tamil Nadu',
    remarks: 'Universal donor type — most impactful donation.',
    distanceKm: 7.4,
  },
];

/** Unread donor-alert count seed (bell badge) until push infra exists. */
export const BLOOD_DONOR_UNREAD_ALERTS = 3;

/** Copy for the request-details page (save banner + confirm note). */
export const BLOOD_REQUEST_DETAIL_COPY = {
  bannerTitle: 'Your donation can save a life.',
  bannerSubtitle: 'The hospital will contact you directly to coordinate the donation.',
  confirmNote: 'Your details will be shared with the hospital only after you confirm.',
};

/**
 * A blood request posted by the app user ("Ask Blood") rather than a hospital.
 * Deliberately lighter than `BloodRequest`: the Ask form only collects these
 * fields, so we never fabricate required detail-page fields (patientAge,
 * verified, imageUrl, …). `id` uses a `uba-` prefix so it never collides with
 * the `br-` seed ids.
 */
export interface UserBloodRequest {
  id: string;
  bloodGroup: BloodGroup;
  unitsRequired: number;
  hospital: string;
  city: string;
  contact: string;
  /** Deadline chip label (e.g. "Needed within 24 hours"). */
  neededWithin: string;
  /** Urgency band derived from the chosen deadline chip. */
  urgency: BloodRequestUrgency;
  /** Optional "For: …" patient context. */
  note: string | null;
  /** ISO timestamp — the relative "Just now / x hours ago" label is computed from this. */
  postedAt: string;
}

/** Deadline chip options for the Ask Blood form — each maps to a deadline + urgency band. */
export const ASK_BLOOD_URGENCY_OPTIONS: {
  id: string;
  label: string;
  neededWithin: string;
  urgency: BloodRequestUrgency;
}[] = [
  { id: '6h', label: 'Within 6 hours', neededWithin: 'Needed within 6 hours', urgency: 'urgent' },
  { id: '24h', label: 'Within 24 hours', neededWithin: 'Needed within 24 hours', urgency: 'high' },
  { id: '48h', label: 'Within 48 hours', neededWithin: 'Needed within 48 hours', urgency: 'high' },
  { id: 'flexible', label: 'Flexible', neededWithin: 'Flexible date', urgency: 'normal' },
];

/** Copy for the Ask Blood sheet. Success copy frames the (client-side) fan-out honestly. */
export const ASK_BLOOD_COPY = {
  fabLabel: 'Ask Blood',
  sheetTitle: 'Ask for Blood',
  sheetSubtitle: 'Registered donors in your area will be alerted to help.',
  submitLabel: 'Ask',
  successTitle: 'Request posted',
  successMessage: 'Registered donors will be alerted to your request. We will let you know when someone responds.',
  doneLabel: 'Done',
};

/** Units stepper bounds for the Ask Blood form. */
export const ASK_BLOOD_UNITS = {
  min: 1,
  max: 10,
};
