import { BLOOD_DONORS } from '@data/index';
import type { BloodGroup, DonorProfile, DonationTypeId, YesNo } from '@data/index';
import { gateway, type BloodDonorProfile } from '@/services/api/GatewayClient';

/**
 * Repository seam for donor discovery. Remote-first: the consented, auth-scoped server directory
 * (`GET /donors` → `blood.donor_directory`, `consent AND available` only) is the source of truth,
 * with the `@data` fixtures as the offline/mock fallback so the sheet never blanks during the
 * fixture→server migration.
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

/**
 * Find consented, available donors for a city + blood group. Reads the server directory first (the
 * health-PII gate) and falls back to the local fixtures only when the server yields nothing (offline
 * / mock auth). Results are cached so `getDonorById` can resolve a donor selected from the sheet.
 */
export async function findMatchingDonors(
  city: string,
  bloodGroup: BloodGroup,
  requesterUserId?: string,
): Promise<DonorProfile[]> {
  try {
    const remote = await gateway.getBloodDonors({ bloodGroup, city: city.trim() });
    if (remote.length > 0) {
      const mapped = remote
        .map(fromServer)
        .filter((donor) => donor.available && donor.userId !== requesterUserId)
        .sort((a, b) => a.name.localeCompare(b.name));
      if (mapped.length > 0) {
        for (const donor of mapped) resolved.set(donor.id, donor);
        return mapped;
      }
    }
  } catch {
    // getBloodDonors already falls back internally; any residual error uses the local fixtures.
  }
  return localMatches(city, bloodGroup, requesterUserId);
}

/** Resolve a donor by id — server-resolved rows first, then the local fixture directory. */
export function getDonorById(donorId: string): DonorProfile | undefined {
  return resolved.get(donorId) ?? BLOOD_DONORS.find((donor) => donor.id === donorId);
}
