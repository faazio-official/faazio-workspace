import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/state/authStore';
import { useOrdersStore } from '@/state/ordersStore';
import { useVendorRatingStore, type UserVendorRating } from '@/state/vendorRatingStore';
import { gateway } from '@/services/api/GatewayClient';
import {
  canRateVendor,
  getUserVendorRating,
  getVendorReviews,
  getVendorReviewSummary,
  type VendorReview,
  type VendorReviewSummary,
} from '@/services/vendorRatings';

/** Whether the signed-in user may rate this vendor (re-derives on order/rating change). */
export function useCanRateVendor(vendorId?: string): boolean {
  const orders = useOrdersStore((s) => s.orders);
  const ratings = useVendorRatingStore((s) => s.ratings);
  return useMemo(
    () => (vendorId ? canRateVendor(vendorId) : false),
    [vendorId, orders, ratings],
  );
}

/** The signed-in user's own rating for a vendor, if any. */
export function useUserVendorRating(vendorId?: string): UserVendorRating | undefined {
  const ratings = useVendorRatingStore((s) => s.ratings);
  const user = useAuthStore((s) => s.user);
  return useMemo(
    () => (vendorId ? getUserVendorRating(vendorId) : undefined),
    [vendorId, ratings, user],
  );
}

/**
 * Combined public reviews + aggregate summary for a vendor.
 *
 * Remote mode upgrades to the durable list + server aggregate (`reviews.vendor_reviews` /
 * `reviews.vendor_summary`); the user's own live rating is kept first. Mock mode (and any
 * fetch failure) falls back to the fully local derivation, so the surface never regresses.
 */
export function useVendorReviews(vendorId?: string): {
  reviews: VendorReview[];
  summary: VendorReviewSummary;
} {
  const ratings = useVendorRatingStore((s) => s.ratings);
  const [remote, setRemote] = useState<{
    reviews: VendorReview[];
    summary: VendorReviewSummary;
  } | null>(null);

  useEffect(() => {
    setRemote(null);
    if (!vendorId || !gateway.remoteEnabled) return;
    let alive = true;
    Promise.all([gateway.getVendorReviews(vendorId), gateway.getVendorReviewSummary(vendorId)])
      .then(([rows, summary]) => {
        if (!alive) return;
        setRemote({
          reviews: rows.map((r) => ({
            id: r.id,
            userName: r.userName,
            rating: r.rating,
            comment: r.comment,
            date: r.date,
          })),
          summary,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [vendorId]);

  return useMemo(() => {
    if (!vendorId) {
      return {
        reviews: [],
        summary: { average: 0, count: 0, distribution: [0, 0, 0, 0, 0] },
      };
    }
    if (remote) {
      const mine = getUserVendorRating(vendorId);
      // Only prepend the "You" row when the server list doesn't already carry the same
      // rating (the durable row wins once the rating has propagated).
      const alreadyOnServer =
        !!mine &&
        remote.reviews.some(
          (r) => Math.round(r.rating) === mine.rating && (r.comment ?? '') === (mine.comment ?? ''),
        );
      const reviews: VendorReview[] = mine && !alreadyOnServer
        ? [
            {
              id: `mine-${vendorId}`,
              userName: 'You',
              rating: mine.rating,
              comment: mine.comment ?? '',
              date: 'Just now',
              isMine: true,
            },
            ...remote.reviews,
          ]
        : remote.reviews;
      return { reviews, summary: remote.summary };
    }
    return { reviews: getVendorReviews(vendorId), summary: getVendorReviewSummary(vendorId) };
  }, [vendorId, ratings, remote]);
}
