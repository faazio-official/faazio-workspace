import type { DistrictInfo } from '@data/districts';
import type { GeoState } from '@/services/api/GatewayClient';
import { matchServiceability, nearestCentroidDistrict } from '@/services/serviceability';

/**
 * Account-level state/district for a seller application, resolved from the pinned shops.
 *
 * The server requires both (`sellers.sellers.district_code`, `POST /sellers` → "district is
 * required"), so the shop pin has to resolve through the same coverage master the delivery flow
 * uses: name match on the reverse-geocoded address first (`adminDistrict` is the revenue district the
 * master is keyed on), then the nearest active district centroid within 100 km. A taluk-only label
 * (Lalgudi for Tiruchirappalli) or a map tap whose geocode returned nothing but coordinates still
 * resolves, and a point that is nowhere near an active district is reported as no match so the form
 * can say why instead of letting the server reject it.
 */

export interface ShopPin {
  latitude?: number | null;
  longitude?: number | null;
  pinnedAddress: string;
}

export interface AccountGeo {
  stateCode: string;
  districtCode: string;
  latitude: number;
  longitude: number;
}

export interface Coverage {
  states: GeoState[];
  districts: DistrictInfo[];
}

/** Resolve one pinned shop, or null when the pin is missing or outside every active district. */
export function resolveShopGeo(shop: ShopPin, coverage: Coverage): AccountGeo | null {
  if (shop.latitude == null || shop.longitude == null) return null;
  const point = { latitude: shop.latitude, longitude: shop.longitude };
  const outcome = matchServiceability(shop.pinnedAddress, null, coverage, point);
  if (outcome.status === 'serviceable') {
    return {
      stateCode: outcome.match.stateCode,
      districtCode: outcome.match.districtCode,
      ...point,
    };
  }
  // The address carried no recognisable state (a geocode that failed, or a place string without
  // one). The pin itself is still evidence: take the nearest active district centroid's state.
  const district = nearestCentroidDistrict(coverage.districts, point);
  if (!district) return null;
  return { stateCode: district.stateCode, districtCode: district.districtCode, ...point };
}

/**
 * The first shop that resolves to a covered district wins, so a covered shop always beats a pin that
 * fell outside coverage. The same shop supplies the account coordinates, keeping `sellers.sellers`'
 * pin and `state_code`/`district_code` consistent.
 */
export function deriveAccountGeo(vendors: ShopPin[], coverage: Coverage): AccountGeo | null {
  if (coverage.districts.length === 0) return null;
  const known = new Set(coverage.states.map((state) => state.stateCode));
  for (const shop of vendors) {
    const geo = resolveShopGeo(shop, coverage);
    if (geo && (known.size === 0 || known.has(geo.stateCode))) return geo;
  }
  return null;
}
