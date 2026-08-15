/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */
import type { UserProfile, SaverMembership } from '../types';

export const userProfile: UserProfile = {
  name: 'Rohit Sharma',
  email: 'rohit.sharma@gmail.com',
  phone: '+91 98765 43210',
};

export const saverMembership: SaverMembership = {
  title: 'Smart Saver',
  savedLabel: 'You saved',
  savedAmount: 1843,
};
