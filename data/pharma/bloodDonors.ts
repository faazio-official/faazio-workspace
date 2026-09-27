/**
 * @mock Discoverable donor directory for the targeted Ask Blood flow.
 * This registry is intentionally behind a repository seam in the mobile app;
 * the Go Chi donor registry will replace it without changing the screens.
 */
import type { BloodGroup, DonationTypeId, YesNo } from './bloodDonor';

export interface DonorProfile {
  id: string;
  userId: string;
  name: string;
  bloodGroup: BloodGroup;
  city: string;
  donationType: DonationTypeId;
  willingToTravel: YesNo;
  available: boolean;
}

export const BLOOD_DONORS: DonorProfile[] = [
  {
    id: 'donor-1',
    userId: 'user_9000000001',
    name: 'Ananya Kumar',
    bloodGroup: 'O+',
    city: 'Chennai',
    donationType: 'both',
    willingToTravel: 'yes',
    available: true,
  },
  {
    id: 'donor-2',
    userId: 'user_9000000002',
    name: 'Vikram Rao',
    bloodGroup: 'A+',
    city: 'Chennai',
    donationType: 'hospital',
    willingToTravel: 'no',
    available: true,
  },
  {
    id: 'donor-3',
    userId: 'user_9000000003',
    name: 'Meera Iyer',
    bloodGroup: 'B+',
    city: 'Bengaluru',
    donationType: 'blood-bank',
    willingToTravel: 'yes',
    available: true,
  },
  {
    id: 'donor-4',
    userId: 'user_9000000004',
    name: 'Arjun Nair',
    bloodGroup: 'O-',
    city: 'Kochi',
    donationType: 'both',
    willingToTravel: 'yes',
    available: true,
  },
  {
    id: 'donor-5',
    userId: 'user_9000000005',
    name: 'Priya Menon',
    bloodGroup: 'AB+',
    city: 'Chennai',
    donationType: 'blood-bank',
    willingToTravel: 'yes',
    available: true,
  },
];
