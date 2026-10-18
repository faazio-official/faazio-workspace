import { BLOOD_DONORS } from '@data/index';
import type { BloodGroup, DonorProfile, DonationTypeId, YesNo } from '@data/index';
import {
  gateway,
  type BloodDonorProfile,
  type ReadSource,
} from '@/services/api/GatewayClient';

/**
 * Repository seam for donor discovery. Remote-first, with provenance: the consented, auth-scoped
 * server directory (`GET /donors` → `blood.donor_directory`, `consent AND available` only) is the
 * source of truth via the no-fallback `GatewayClient.fetchBloodDonors`, so the caller can tell a
 * live result (including an honest `200 []`) from the offline fixture — a health-PII gate must
 * never present fixture donors as if they were consented live rows.
 */

const DEFAULT_DONATION_TYPE: DonationTypeId = 'both';

/**
 * Map a server `blood.donor_directory` row onto the UI `DonorProfile`. The directory projects no
 * synthetic `id`, so the stable `userId` doubles as the row key (used by the detail route + targeted
 * request). `willingToTravel` is a boolean server-side and a `'yes' | 'no'` string on the UI type.
 */
function fromServer(p: BloodDonorProfile): DonorProfile {
  return {
    id: p.userId,
    userId: p.userId,
    name: p.name,
    bloodGroup: p.bloodGroup as BloodGroup,
    city: p.city,
    donationType: (p.donationType as DonationTypeId) ?? DEFAULT_DONATION_TYPE,
    willingToTravel: (p.willingToTravel ? 'yes' : 'no') as YesNo,
    available: p.available,
  };
}

/** Server-resolved donors from the last search, so the detail route (which only carries an id) resolves. */
const resolved = new Map<string, DonorProfile>();

function localMatches(
  city: string,
  bloodGroup: BloodGroup,
  requesterUserId?: string,
): DonorProfile[] {
  const normalizedCity = city.trim().toLowerCase();
  return BLOOD_DONORS
    .filter(
      (donor) =>
        donor.available &&
        donor.bloodGroup === bloodGroup &&
        donor.userId !== requesterUserId &&
        donor.city.toLowerCase() === normalizedCity,
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The matching donors plus their provenance so the sheet can label an offline/empty view honestly. */
export interface DonorDirectoryResult {
  donors: DonorProfile[];
  source: ReadSource;
}

/**
 * Find consented, available donors for a city + blood group. Reads the server directory through the
 * no-fallback `fetchBloodDonors` so the caller gets provenance:
 *  - live rows       → `source: 'live'`, cached so `getDonorById` can resolve a selected donor.
 *  - server `200 []` → `source: 'empty-authoritative'` (no consented donors — never masked by fixtures).
 *  - fetch failure   → the `@data` fixture filtered to the query + `source: 'offline-fallback'`.
 */
export async function findMatchingDonors(
  city: string,
  bloodGroup: BloodGroup,
  requesterUserId?: string,
): Promise<DonorDirectoryResult> {
  try {
    const remote = await gateway.fetchBloodDonors({ bloodGroup, city: city.trim() });
    const mapped = remote
      .map(fromServer)
      .filter((donor) => donor.available && donor.userId !== requesterUserId)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (mapped.length > 0) {
      for (const donor of mapped) resolved.set(donor.id, donor);
      return { donors: mapped, source: 'live' };
    }
    return { donors: [], source: 'empty-authoritative' };
  } catch {
    // Offline / mock — the fixture filtered to this query, always labelled as a fallback.
    return { donors: localMatches(city, bloodGroup, requesterUserId), source: 'offline-fallback' };
  }
}

/**
 * Resolve a donor by id. When the search that opened the detail route was live (or an honest empty),
 * only a server-resolved row counts — an unknown id is an honest "no longer available" screen, never
 * a fixture lookalike. For an offline fallback (or an unlabelled deep link) the fixture directory is
 * also consulted.
 */
export function getDonorById(donorId: string, source?: ReadSource): DonorProfile | undefined {
  if (source === 'live' || source === 'empty-authoritative') return resolved.get(donorId);
  return resolved.get(donorId) ?? BLOOD_DONORS.find((donor) => donor.id === donorId);
}
