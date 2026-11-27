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

/** The origin point the coverage decision is for (the chosen delivery location). */
export type ServiceabilityOrigin = { latitude: number; longitude: number };

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
    .replace(/[āáàâãäå]/g, 'a')
    .replace(/[ēéèêë]/g, 'e')
    .replace(/[īíìîï]/g, 'i')
    .replace(/[ōóòôõö]/g, 'o')
    .replace(/[ūúùûü]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/[ṭ]/g, 't')
    .replace(/[ḍ]/g, 'd')
    .replace(/[ṇ]/g, 'n')
    .replace(/[ḷ]/g, 'l')
    .replace(/[śṣ]/g, 's')
    .replace(/[ṛ]/g, 'r')
    .replace(/ç/g, 'c')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]/g, '')
    .replace(/pondicherry/g, 'puducherry');

/**
 * A looser fold for transliteration drift: collapsing repeated letters makes `Tiruchirappalli`
 * match `Tiruchirapalli`, `Thoothukudi` match `Thoothukkudi`, etc. Used only as a secondary
 * comparison after the exact fold, so it cannot override a real match.
 */
const foldLoose = (value: string): string => foldGeo(value).replace(/(.)\1+/g, '$1');

type Haystack = { folded: string; loose: string };

function haystackFor(address: string, place: ReverseGeocodeResult | null): Haystack {
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
  const raw = parts.join(' ');
  return { folded: foldGeo(raw), loose: foldLoose(raw) };
}

function matchState(
  haystack: Haystack,
  states: GeoState[],
  place: ReverseGeocodeResult | null,
): GeoState | null {
  const district = foldGeo(place?.district ?? '');
  const districtLoose = foldLoose(place?.district ?? '');
  const region = foldGeo(place?.region ?? '');
  const regionLoose = foldLoose(place?.region ?? '');
  const exact = states.find(
    (state) => region.length > 0 && foldGeo(state.name) === region,
  );
  if (exact) return exact;
  const loose = states.find(
    (state) => regionLoose.length > 0 && foldLoose(state.name) === regionLoose,
  );
  if (loose) return loose;
  return (
    states.find((state) => {
      const name = foldGeo(state.name);
      const looseName = foldLoose(state.name);
      return (
        (name.length > 0 && (haystack.folded.includes(name) || district.includes(name))) ||
        (looseName.length > 0 &&
          (haystack.loose.includes(looseName) || districtLoose.includes(looseName)))
      );
    }) ?? null
  );
}

function matchDistrict(
  haystack: Haystack,
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
    .map((value) => ({ folded: foldGeo(value), loose: foldLoose(value) }));
  for (const candidate of direct) {
    const exact = scoped.find((district) => foldGeo(district.name) === candidate.folded);
    if (exact) return exact;
  }
  for (const candidate of direct) {
    const loose = scoped.find((district) => foldLoose(district.name) === candidate.loose);
    if (loose) return loose;
  }
  return (
    [...scoped]
      .sort((a, b) => foldGeo(b.name).length - foldGeo(a.name).length)
      .find((district) => {
        const name = foldGeo(district.name);
        const looseName = foldLoose(district.name);
        return (
          (name.length > 0 && haystack.folded.includes(name)) ||
          (looseName.length > 0 && haystack.loose.includes(looseName))
        );
      }) ?? null
  );
}

/**
 * Coverage is a district allowlist, so a point is serviceable anywhere inside an active district.
 * The centroid fallback is bounded: beyond this radius from every active district in the matched
 * state, coordinates are not treated as evidence of coverage. Indian districts are at most ~70 km
 * from their centroid to a far corner, so 100 km keeps a real district member inside while refusing
 * a point that is nowhere near an enabled district.
 */
export const MAX_CENTROID_KM = 100;

function haversineKm(a: ServiceabilityOrigin, b: ServiceabilityOrigin): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The active district whose centroid is nearest the origin, within `maxKm` (default
 * `MAX_CENTROID_KM`). This is the fallback for a geocode that omits the revenue district (a platform
 * geocoder can return `adminDistrict: null` with only a taluk/city name, e.g. Lalgudi for
 * Tiruchirappalli). It is only consulted after the name match fails and only among the matched
 * state's active districts.
 */
export function nearestCentroidDistrict(
  districts: DistrictInfo[],
  origin: ServiceabilityOrigin,
  maxKm: number = MAX_CENTROID_KM,
): DistrictInfo | null {
  let best: DistrictInfo | null = null;
  let bestKm = maxKm;
  for (const district of districts) {
    if (typeof district.latitude !== 'number' || typeof district.longitude !== 'number') continue;
    const km = haversineKm(origin, {
      latitude: district.latitude,
      longitude: district.longitude,
    });
    if (km < bestKm) {
      bestKm = km;
      best = district;
    }
  }
  return best;
}

/**
 * Resolve the address against the active coverage master. The place fields are preferred over the
 * formatted address because a reverse-geocoded `district`/`region` is the most reliable signal; the
 * address is the fallback for Google Places selections that only return a formatted string.
 *
 * `origin` is the chosen point's coordinates. When the name match cannot identify a district (the
 * platform geocoder omitted the revenue district), the nearest active district in the matched state
 * is used instead, so a covered address is not hard-blocked for a missing label.
 */
export function matchServiceability(
  address: string,
  place: ReverseGeocodeResult | null,
  coverage: Coverage,
  origin?: ServiceabilityOrigin | null,
): ServiceabilityOutcome {
  const haystack = haystackFor(address, place);
  // A missing native reverse-geocoder can leave only a "lat, lng" label. That is not evidence of
  // being outside coverage — report unknown so a device limitation cannot hard-block a covered user.
  if (!haystack.folded || !/[a-z]/.test(haystack.folded)) {
    return { status: 'unknown', reason: 'no_address' };
  }

  const state = matchState(haystack, coverage.states, place);
  if (!state) return { status: 'unserviceable', reason: 'outside_coverage' };

  const scoped = coverage.districts.filter((d) => d.stateCode === state.stateCode);
  const district =
    matchDistrict(haystack, state.stateCode, coverage.districts, place) ??
    (origin ? nearestCentroidDistrict(scoped, origin) : null);
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

/** Fetch the active coverage and match one address/origin. Throws when coverage cannot be read. */
export async function resolveServiceability(input: {
  address: string;
  place: ReverseGeocodeResult | null;
  /** The chosen origin's point, enabling the nearest-centroid fallback when names do not resolve. */
  origin?: ServiceabilityOrigin | null;
  /** Bypass the short coverage cache (foreground re-check after a portal toggle). */
  refreshCoverage?: boolean;
}): Promise<ServiceabilityOutcome> {
  const coverage = await loadCoverage(input.refreshCoverage === true);
  return matchServiceability(input.address, input.place, coverage, input.origin ?? null);
}
