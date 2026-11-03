// Reference-data lookup helpers. All inputs come from the gateway (/geo/states, /geo/districts,
// /ads/placements) — there are no client literals here. Kept pure so components can map the fetched
// rows without a hook.
import type { DistrictInfo, PlacementSummary } from "@/lib/api/index";
import type { AdTargetType, HeroPlacement, Sector } from "@/data/types";

/** Districts of one state from a DB-backed list (empty when the state has no production coverage). */
export function districtsForState(districts: DistrictInfo[], stateCode: string): DistrictInfo[] {
  const code = stateCode.trim().toUpperCase();
  return districts.filter((d) => d.stateCode === code);
}

/** Parent state code for a district from a DB-backed list, or ''. */
export function stateForDistrict(districts: DistrictInfo[], districtCode: string): string {
  return districts.find((d) => d.districtCode === districtCode.trim().toUpperCase())?.stateCode ?? "";
}

/** Display name for a district code from a DB-backed list, or ''. */
export function districtName(districts: DistrictInfo[], districtCode: string): string {
  return districts.find((d) => d.districtCode === districtCode.trim().toUpperCase())?.name ?? "";
}

/** Display label for an ad placement key from ads.placements, or the raw key. */
export function placementLabel(placements: PlacementSummary[], placement: string): string {
  return placements.find((p) => p.placement === placement)?.label ?? placement;
}

/** Short "who sees this" note for a placement from ads.placements, or ''. */
export function placementReach(placements: PlacementSummary[], placement: string): string {
  return placements.find((p) => p.placement === placement)?.reachNote ?? "";
}

/**
 * Placements the server accepts for a target: those whose app list includes the target's sub-app
 * and whose target_types include the target type. Drives the campaign wizard's placement choices
 * entirely from the ads.placements rows.
 */
export function eligiblePlacementsFor(
  placements: PlacementSummary[],
  app: Sector,
  targetType: AdTargetType,
): HeroPlacement[] {
  return placements
    .filter((p) => p.apps.includes(app) && p.targetTypes.includes(targetType))
    .map((p) => p.placement as HeroPlacement);
}