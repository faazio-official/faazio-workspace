/**
 * @mock Simulates a Go + PostgreSQL reviews/specs microservice. Consolidates
 * `productMeta/reviews.ts` into relational tables. Reviews are product-scoped;
 * because the legacy fixture was app-scoped, each app's reviews are attached to
 * representative catalog product IDs from that app. Legacy helpers are preserved
 * (unchanged) for screens still on the old surface. See data/DATA_CONTROL.md.
 */
import type { AppBrand, Review, SpecItem } from '../types';
import { getProductReviews, getProductSpecs, getProductHighlights, avatarMap } from '../productMeta/reviews';

export { avatarMap };

/** Representative product id per app used to seed product-scoped reviews. */
const REPRESENTATIVE_PRODUCT_IDS: Record<AppBrand, string> = {
  FOOD: 'rvf-1',
  MART: 'rvm-1',
  PHARMA: 'rvp-1',
};

export interface ReviewRow {
  id: string;
  productId: string;
  app: AppBrand;
  user: string;
  avatar?: string;
  rating: number;
  comment: string;
  date: string;
}

function toReviewRow(app: AppBrand, review: Review): ReviewRow {
  return { ...review, productId: REPRESENTATIVE_PRODUCT_IDS[app], app };
}

export const reviewsTable: ReviewRow[] = (
  ['FOOD', 'MART', 'PHARMA'] as AppBrand[]
).flatMap((app) => getProductReviews(app).map((r) => toReviewRow(app, r)));

export interface SpecRow {
  id: string;
  app: AppBrand;
  label: string;
  value: string;
}

export const specsTable: SpecRow[] = (
  ['FOOD', 'MART', 'PHARMA'] as AppBrand[]
).flatMap((app) =>
  getProductSpecs(app).map((s, i) => ({ id: `${app.toLowerCase()}-spec-${i}`, app, label: s.label, value: s.value })),
);

export interface HighlightRow {
  id: string;
  app: AppBrand;
  text: string;
}

export const highlightsTable: HighlightRow[] = (
  ['FOOD', 'MART', 'PHARMA'] as AppBrand[]
).flatMap((app) =>
  getProductHighlights(app).map((h, i) => ({ id: `${app.toLowerCase()}-hl-${i}`, app, text: h })),
);

export function getReviewsByProductId(productId: string): ReviewRow[] {
  return reviewsTable.filter((r) => r.productId === productId);
}

/** Legacy app-scoped helpers, unchanged for the old surface. */
export function getProductReviewsByApp(app: AppBrand): Review[] {
  return getProductReviews(app);
}

export function getProductSpecsByApp(app: AppBrand): SpecItem[] {
  return getProductSpecs(app);
}

export function getProductHighlightsByApp(app: AppBrand): string[] {
  return getProductHighlights(app);
}
