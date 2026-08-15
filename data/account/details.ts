/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */
import type { UserDetailsData } from '../types';

export const accountDetails: UserDetailsData = {
  accountId: 'HC12345678',
  personalInfo: [
    { icon: 'user', title: 'Full Name', subtitle: 'Rohit Sharma' },
    { icon: 'mail', title: 'Email Address', subtitle: 'rohit.sharma@gmail.com' },
    { icon: 'phone', title: 'Mobile Number', subtitle: '+91 98765 43210' },
    { icon: 'calendar', title: 'Date of Birth', subtitle: '15 May 1992' },
    { icon: 'gender', title: 'Gender', subtitle: 'Male' },
    { icon: 'globe', title: 'Preferred Language', subtitle: 'English' },
  ],
  preferences: [
    {
      icon: 'map-pin',
      title: 'Default Location',
      subtitle: 'Greenwood Regency, Bengaluru, Karnataka 560001',
    },
    {
      icon: 'bell',
      title: 'Notification Preferences',
      subtitle: 'Manage what you want to be notified',
    },
    {
      icon: 'lock',
      title: 'Privacy Settings',
      subtitle: 'Manage your privacy and data',
    },
  ],
  securityTitle: 'Your data is 100% secure with us',
  securitySubtitle: 'We never share your personal information with anyone.',
};
