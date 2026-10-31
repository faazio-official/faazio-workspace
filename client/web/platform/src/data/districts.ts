// Provenance: admins.district_master (migration 0046) — production coverage = Tamil Nadu (38) +
// Puducherry (4). Mirrors data/districts.ts; the gateway is the authority. Used by the district
// admin and seller-district pickers (offline fallback only).
export interface DistrictInfo {
  districtCode: string;
  name: string;
  stateCode: string;
}

export const DISTRICTS: DistrictInfo[] = [
  { districtCode: 'TNA', name: 'Ariyalur', stateCode: 'TN' },
  { districtCode: 'TNC', name: 'Chengalpattu', stateCode: 'TN' },
  { districtCode: 'TCH', name: 'Chennai', stateCode: 'TN' },
  { districtCode: 'TCO', name: 'Coimbatore', stateCode: 'TN' },
  { districtCode: 'TCD', name: 'Cuddalore', stateCode: 'TN' },
  { districtCode: 'TDP', name: 'Dharmapuri', stateCode: 'TN' },
  { districtCode: 'TDG', name: 'Dindigul', stateCode: 'TN' },
  { districtCode: 'TER', name: 'Erode', stateCode: 'TN' },
  { districtCode: 'TKL', name: 'Kallakurichi', stateCode: 'TN' },
  { districtCode: 'TKP', name: 'Kanchipuram', stateCode: 'TN' },
  { districtCode: 'TKK', name: 'Kanyakumari', stateCode: 'TN' },
  { districtCode: 'TKR', name: 'Karur', stateCode: 'TN' },
  { districtCode: 'TKG', name: 'Krishnagiri', stateCode: 'TN' },
  { districtCode: 'TMD', name: 'Madurai', stateCode: 'TN' },
  { districtCode: 'TMY', name: 'Mayiladuthurai', stateCode: 'TN' },
  { districtCode: 'TNP', name: 'Nagapattinam', stateCode: 'TN' },
  { districtCode: 'TNK', name: 'Namakkal', stateCode: 'TN' },
  { districtCode: 'TNG', name: 'Nilgiris', stateCode: 'TN' },
  { districtCode: 'TPE', name: 'Perambalur', stateCode: 'TN' },
  { districtCode: 'TPK', name: 'Pudukkottai', stateCode: 'TN' },
  { districtCode: 'TRT', name: 'Ramanathapuram', stateCode: 'TN' },
  { districtCode: 'TRN', name: 'Ranipet', stateCode: 'TN' },
  { districtCode: 'TSL', name: 'Salem', stateCode: 'TN' },
  { districtCode: 'TSK', name: 'Sivaganga', stateCode: 'TN' },
  { districtCode: 'TTK', name: 'Tenkasi', stateCode: 'TN' },
  { districtCode: 'TTH', name: 'Thanjavur', stateCode: 'TN' },
  { districtCode: 'TTE', name: 'Theni', stateCode: 'TN' },
  { districtCode: 'TTT', name: 'Thoothukudi', stateCode: 'TN' },
  { districtCode: 'TTC', name: 'Tiruchirappalli', stateCode: 'TN' },
  { districtCode: 'TTL', name: 'Tirunelveli', stateCode: 'TN' },
  { districtCode: 'TTP', name: 'Tirupathur', stateCode: 'TN' },
  { districtCode: 'TPP', name: 'Tiruppur', stateCode: 'TN' },
  { districtCode: 'TLV', name: 'Tiruvallur', stateCode: 'TN' },
  { districtCode: 'TVA', name: 'Tiruvannamalai', stateCode: 'TN' },
  { districtCode: 'TVR', name: 'Tiruvarur', stateCode: 'TN' },
  { districtCode: 'VEL', name: 'Vellore', stateCode: 'TN' },
  { districtCode: 'VLP', name: 'Villupuram', stateCode: 'TN' },
  { districtCode: 'VIR', name: 'Virudhunagar', stateCode: 'TN' },
  { districtCode: 'PY1', name: 'Karaikal', stateCode: 'PY' },
  { districtCode: 'PY2', name: 'Mahé', stateCode: 'PY' },
  { districtCode: 'PY0', name: 'Puducherry', stateCode: 'PY' },
  { districtCode: 'PY3', name: 'Yanam', stateCode: 'PY' },
];

/** Districts of one state (empty when the state has no production coverage). */
export function districtsForState(stateCode: string): DistrictInfo[] {
  const code = stateCode.trim().toUpperCase();
  return DISTRICTS.filter((d) => d.stateCode === code);
}

/** Parent state code for a district, or ''. */
export function stateForDistrict(districtCode: string): string {
  return DISTRICTS.find((d) => d.districtCode === districtCode.trim().toUpperCase())?.stateCode ?? '';
}

/** Display name for a district code, or ''. */
export function districtName(districtCode: string): string {
  return DISTRICTS.find((d) => d.districtCode === districtCode.trim().toUpperCase())?.name ?? '';
}
