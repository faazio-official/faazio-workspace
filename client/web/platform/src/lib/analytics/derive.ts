import type { DailyPoint, ProductRecord } from "@/data/types";

export function sumGmv(points: DailyPoint[]): number {
  return points.reduce((total, p) => total + p.gmvPaisa, 0);
}

export function sumOrders(points: DailyPoint[]): number {
  return points.reduce((total, p) => total + p.orders, 0);
}

/** % change of the latest half of the window vs the previous half. */
export function periodDelta(points: DailyPoint[], pick: (p: DailyPoint) => number): number {
  if (points.length < 4) return 0;
  const mid = Math.floor(points.length / 2);
  const prev = points.slice(0, mid).reduce((t, p) => t + pick(p), 0);
  const curr = points.slice(mid).reduce((t, p) => t + pick(p), 0);
  if (prev === 0) return 0;
  return ((curr - prev) / prev) * 100;
}

export function sparkline(points: DailyPoint[], pick: (p: DailyPoint) => number) {
  return points.slice(-14).map((p) => ({ value: pick(p) }));
}

export interface HealthScore {
  score: number;
  band: "Excellent" | "Good" | "At-risk" | "Poor";
  parts: { label: string; value: string; weight: number; pass: boolean }[];
}

export function sellerHealth(input: {
  slaPercent: number;
  cancellationPercent: number;
  rating: number;
  listingQuality: number;
}): HealthScore {
  const slaPart = Math.min(1, input.slaPercent / 95) * 40;
  const cancelPart = Math.max(0, 1 - input.cancellationPercent / 5) * 20;
  const ratingPart = Math.min(1, input.rating / 4.5) * 25;
  const qualityPart = Math.min(1, input.listingQuality / 85) * 15;
  const score = Math.round(slaPart + cancelPart + ratingPart + qualityPart);
  const band: HealthScore["band"] =
    score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 55 ? "At-risk" : "Poor";
  return {
    score,
    band,
    parts: [
      {
        label: "On-time dispatch (SLA)",
        value: `${input.slaPercent.toFixed(1)}%`,
        weight: 40,
        pass: input.slaPercent >= 95,
      },
      {
        label: "Cancellations",
        value: `${input.cancellationPercent.toFixed(1)}%`,
        weight: 20,
        pass: input.cancellationPercent <= 2,
      },
      { label: "Rating", value: input.rating.toFixed(1), weight: 25, pass: input.rating >= 4.2 },
      {
        label: "Listing quality",
        value: `${Math.round(input.listingQuality)}/100`,
        weight: 15,
        pass: input.listingQuality >= 75,
      },
    ],
  };
}

/**
 * Listing quality is derived, never stored (D3/D4): completeness of the listing
 * (description, photo, live status) replaces the removed `qualityScore` column.
 */
export function productListingQuality(p: ProductRecord): number {
  let score = 40;
  if (p.description.trim().length >= 40) score += 20;
  if (p.imageUrl) score += 20;
  if (p.status === "ACTIVE") score += 20;
  return Math.min(100, score);
}

export function listingQuality(products: ProductRecord[]): number {
  if (products.length === 0) return 0;
  const total = products.reduce((t, p) => t + productListingQuality(p), 0);
  return Math.round(total / products.length);
}
