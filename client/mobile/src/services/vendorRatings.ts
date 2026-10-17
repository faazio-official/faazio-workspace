import {
  MOCK_USER_ID,
  hasPurchasedFromVendor,
  getVendorOrderIds,
  getReviewsByVendorId,
} from '@data/index';
import { useAuthStore } from '@/state/authStore';
import { useOrdersStore } from '@/state/ordersStore';
import { gateway, type VendorRatingOutcome } from '@/services/api/GatewayClient';
import {
  useVendorRatingStore,
  MAX_VENDOR_RATING_COMMENT,
  type UserVendorRating,
} from '@/state/vendorRatingStore';

/** A review as publicly displayed — full name + rating + comment only. */
export interface VendorReview {
  id: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
  /** True for the signed-in user's own live rating (rendered as "You"). */
  isMine?: boolean;
}

export interface VendorReviewSummary {
  average: number;
  count: number;
  /** Counts for 1..5 stars, index 0 = 1 star. */
  distribution: number[];
}

const EMPTY_SUMMARY: VendorReviewSummary = { average: 0, count: 0, distribution: [0, 0, 0, 0, 0] };

function currentUserId(): string {
  return useAuthStore.getState().user?.id ?? MOCK_USER_ID;
}

/**
 * In-session placed orders (ordersStore) that resolve to this vendor. Placed
 * orders are always `Processing` (there is no cancel flow yet), so they are
 * inherently non-cancelled — only the vendor snapshot needs checking.
 */
function sessionOrderIdsForVendor(vendorId: string): string[] {
  const { orders, serverOrders } = useOrdersStore.getState();
  return [...orders, ...serverOrders]
    .filter((order) => (order.storeIds ?? []).includes(vendorId))
    .map((order) => order.orderId);
}

/**
 * The single owner of the rating gate, reused by every entry point and
 * re-checked inside the rating screen. Derived (fixture orders + in-session
 * orders), never a stored flag; permanently true once a purchase exists.
 */
export function canRateVendor(vendorId: string): boolean {
  if (!vendorId) return false;
  return (
    hasPurchasedFromVendor(MOCK_USER_ID, vendorId) ||
    sessionOrderIdsForVendor(vendorId).length > 0
  );
}

/** The signed-in user's current rating for a vendor, if any. */
export function getUserVendorRating(vendorId: string): UserVendorRating | undefined {
  return useVendorRatingStore.getState().getRating(currentUserId(), vendorId);
}

/** Outcome of a submit: `invalid` = failed the local gate, otherwise the gateway outcome. */
export type VendorRatingStatus = VendorRatingOutcome | 'invalid';

export interface VendorRatingResult {
  /** True when the rating is durably saved or safely device-local (offline / mock). */
  ok: boolean;
  status: VendorRatingStatus;
}

/**
 * Upsert the user's live rating (latest wins) after re-checking eligibility. Always writes the
 * device-local store first (offline-first, and the offline source of display), then mirrors to the
 * durable server row. Resolves with an outcome so the screen can explain a non-durable result
 * (`signed-out` / `not-verified`) instead of silently pretending success.
 */
export async function submitVendorRating(
  vendorId: string,
  rating: number,
  comment?: string,
): Promise<VendorRatingResult> {
  if (!canRateVendor(vendorId)) return { ok: false, status: 'invalid' };
  const value = Math.round(rating);
  if (value < 1 || value > 5) return { ok: false, status: 'invalid' };

  const orderIds = [
    ...getVendorOrderIds(MOCK_USER_ID, vendorId),
    ...sessionOrderIdsForVendor(vendorId),
  ];
  useVendorRatingStore.getState().submitRating({
    vendorId,
    userId: currentUserId(),
    rating: value,
    comment: comment?.trim().slice(0, MAX_VENDOR_RATING_COMMENT) || undefined,
    orderIds,
  });

  // Mirror the rating to the durable source of truth (server re-checks the purchase gate).
  // `offline` keeps today's device-local success; `signed-out` / `not-verified` are surfaced.
  const status = await gateway.rateVendor(
    vendorId,
    value,
    comment?.trim().slice(0, MAX_VENDOR_RATING_COMMENT),
  );
  return { ok: status === 'synced' || status === 'offline', status };
}

/** Public review list for a vendor: the user's live rating first, then seeded rows. */
export function getVendorReviews(vendorId: string): VendorReview[] {
  const seeded: VendorReview[] = getReviewsByVendorId(vendorId).map((row) => ({
    id: row.id,
    userName: row.userName,
    rating: row.rating,
    comment: row.comment,
    date: row.date,
  }));

  const mine = getUserVendorRating(vendorId);
  if (!mine) return seeded;

  return [
    {
      id: `mine-${vendorId}`,
      userName: 'You',
      rating: mine.rating,
      comment: mine.comment ?? '',
      date: 'Just now',
      isMine: true,
    },
    ...seeded,
  ];
}

/** Aggregate rating derived from the combined public review list. */
export function getVendorReviewSummary(vendorId: string): VendorReviewSummary {
  const reviews = getVendorReviews(vendorId);
  if (reviews.length === 0) return EMPTY_SUMMARY;

  const distribution = [0, 0, 0, 0, 0];
  let sum = 0;
  for (const review of reviews) {
    const value = Math.max(1, Math.min(5, Math.round(review.rating)));
    distribution[value - 1] += 1;
    sum += value;
  }
  return { average: sum / reviews.length, count: reviews.length, distribution };
}
