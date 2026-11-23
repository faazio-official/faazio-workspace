import type { DistrictInfo } from '@data/districts';
import {
  gateway,
  type GeoState,
} from '@/services/api/GatewayClient';
import type { ReverseGeocodeResult } from '@/services/location';

/**
 * District-level serviceability. The gateway's active district master (`GET /geo/districts`,
 * filtered by `admins.district_master.is_active`) is the coverage authority: the super admin
 * toggles a district in the partner portal and that district immediately leaves or joins this
 * list. The app matches its on-device reverse-geocoded address against that list — no coordinates
 * are sent to the gateway for this check.
 *
 * This is deliberately district-level, not a polygon/hex fence. The server has no service-area
 * geometry to consult; the enabled district rows are the production coverage contract.
 */

export type ServiceabilityMatch = {
  stateCode: string;
  stateName: string;
  districtCode: string;
  districtName: string;
};

export type ServiceabilityOutcome =
  | { status: 'serviceable'; match: ServiceabilityMatch }
  | { status: 'unserviceable'; reason: 'outside_coverage' | 'district_unavailable'; stateName?: string }
  | { status: 'unknown'; reason: 'no_address' };

const COVERAGE_TTL_MS = 60_000;

type Coverage = { states: GeoState[]; districts: DistrictInfo[] };

let coverageCache: { at: number; value: Coverage } | null = null;
let coverageInflight: Promise<Coverage> | null = null;

async function loadCoverage(refresh: boolean): Promise<Coverage> {
  const fresh = coverageCache && Date.now() - coverageCache.at < COVERAGE_TTL_MS;
  if (!refresh && fresh) return coverageCache!.value;
  if (coverageInflight) return coverageInflight;
  coverageInflight = (async () => {
    const [states, districts] = await Promise.all([
      gateway.getStates(),
      gateway.fetchDistricts(),
    ]);
    const value = { states, districts };
    coverageCache = { at: Date.now(), value };
    return value;
  })().finally(() => {
    coverageInflight = null;
  });
  return coverageInflight;
}

/** Test seam — keep the 60 s cache from leaking between calls. */
export function clearServiceabilityCoverageCache(): void {
  coverageCache = null;
  coverageInflight = null;
}

const foldGeo = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]/g, '')
    .replace(/pondicherry/g, 'puducherry');

function haystackFor(address: string, place: ReverseGeocodeResult | null): string {
  const parts = [
    address,
    place?.name,
    place?.street,
    place?.district,
    place?.adminDistrict,
    place?.city,
    place?.region,
    place?.postalCode,
  ].filter((part): part is string => typeof part === 'string' && part.trim().length > 0);
  return foldGeo(parts.join(' '));
}

function matchState(
  haystack: string,
  states: GeoState[],
  place: ReverseGeocodeResult | null,
): GeoState | null {
  const district = foldGeo(place?.district ?? '');
  const region = foldGeo(place?.region ?? '');
  const exact = states.find(
    (state) => region.length > 0 && foldGeo(state.name) === region,
  );
  if (exact) return exact;
  return (
    states.find((state) => {
      const name = foldGeo(state.name);
      return name.length > 0 && (haystack.includes(name) || district.includes(name));
    }) ?? null
  );
}

function matchDistrict(
  haystack: string,
  stateCode: string,
  districts: DistrictInfo[],
  place: ReverseGeocodeResult | null,
): DistrictInfo | null {
  const scoped = districts.filter((district) => district.stateCode === stateCode);
  // Strongest signal first: `adminDistrict` is the revenue district the master is keyed on
  // (`subAdminArea` / `subAdministrativeArea`). `city` and the sub-locality `district` are kept as
  // fallbacks because a platform geocoder can leave `subAdminArea` empty.
  const direct = [place?.adminDistrict, place?.city, place?.district]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map(foldGeo);
  for (const candidate of direct) {
    const exact = scoped.find((district) => foldGeo(district.name) === candidate);
    if (exact) return exact;
  }
  return (
    [...scoped]
      .sort((a, b) => foldGeo(b.name).length - foldGeo(a.name).length)
      .find((district) => {
        const name = foldGeo(district.name);
        return name.length > 0 && haystack.includes(name);
      }) ?? null
  );
}

/**
 * Resolve the address against the active coverage master. The place fields are preferred over the
 * formatted address because a reverse-geocoded `district`/`region` is the most reliable signal; the
 * address is the fallback for Google Places selections that only return a formatted string.
 */
export function matchServiceability(
  address: string,
  place: ReverseGeocodeResult | null,
  coverage: Coverage,
): ServiceabilityOutcome {
  const haystack = haystackFor(address, place);
  // A missing native reverse-geocoder can leave only a "lat, lng" label. That is not evidence of
  // being outside coverage — report unknown so a device limitation cannot hard-block a covered user.
  if (!haystack || !/[a-z]/.test(haystack)) {
    return { status: 'unknown', reason: 'no_address' };
  }

  const state = matchState(haystack, coverage.states, place);
  if (!state) return { status: 'unserviceable', reason: 'outside_coverage' };

  const district = matchDistrict(haystack, state.stateCode, coverage.districts, place);
  if (!district) {
    return {
      status: 'unserviceable',
      reason: 'district_unavailable',
      stateName: state.name,
    };
  }

  return {
    status: 'serviceable',
    match: {
      stateCode: state.stateCode,
      stateName: state.name,
      districtCode: district.districtCode,
      districtName: district.name,
    },
  };
}

/** Fetch the active coverage and match one address. Throws when coverage cannot be read. */
export async function resolveServiceability(input: {
  address: string;
  place: ReverseGeocodeResult | null;
  /** Bypass the short coverage cache (foreground re-check after a portal toggle). */
  refreshCoverage?: boolean;
}): Promise<ServiceabilityOutcome> {
  const coverage = await loadCoverage(input.refreshCoverage === true);
  return matchServiceability(input.address, input.place, coverage);
}
