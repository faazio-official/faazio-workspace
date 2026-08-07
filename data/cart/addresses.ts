/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */
import type { Address } from '../types';

export const defaultAddresses: Address[] = [
  { id: 'addr-1', label: 'Home', address: '42, Lakeview Apartments, Sunnambukkara Street, Karaikal - 609602', isDefault: true },
  { id: 'addr-2', label: 'Office', address: '7th Floor, Tech Park, Pondicherry Road, Karaikal - 609602', isDefault: false },
];
