/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */
import type { Address } from '../types';

export const defaultAddresses: Address[] = [
  { id: 'addr-1', label: 'Greenwood', address: 'Greenwood Regency, Greenwood Regt Rd, Greenwood City - 609602', isDefault: true },
  { id: 'addr-2', label: 'Greenwood Office', address: '7th Floor, Greenwood Tech Park, Greenwood City - 609602', isDefault: false },
];
