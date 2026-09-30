import { useMemo } from 'react';
import { useAuthStore } from '@/state/authStore';
import { useOrdersStore } from '@/state/ordersStore';
import { useVendorRatingStore, type UserVendorRating } from '@/state/vendorRatingStore';
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

/** Combined public reviews + aggregate summary for a vendor. */
export function useVendorReviews(vendorId?: string): {
  reviews: VendorReview[];
  summary: VendorReviewSummary;
} {
  const ratings = useVendorRatingStore((s) => s.ratings);
  return useMemo(() => {
    if (!vendorId) {
      return {
        reviews: [],
        summary: { average: 0, count: 0, distribution: [0, 0, 0, 0, 0] },
      };
    }
    return { reviews: getVendorReviews(vendorId), summary: getVendorReviewSummary(vendorId) };
  }, [vendorId, ratings]);
}
