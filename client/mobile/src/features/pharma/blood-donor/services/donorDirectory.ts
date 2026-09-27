import { BLOOD_DONORS } from '@data/index';
import type { BloodGroup, DonorProfile } from '@data/index';

/**
 * Repository seam for donor discovery. The current implementation is static,
 * but the async contract is ready for the Go Chi donor registry.
 */
export async function findMatchingDonors(
  city: string,
  bloodGroup: BloodGroup,
  requesterUserId?: string,
): Promise<DonorProfile[]> {
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

export function getDonorById(donorId: string): DonorProfile | undefined {
  return BLOOD_DONORS.find((donor) => donor.id === donorId);
}
