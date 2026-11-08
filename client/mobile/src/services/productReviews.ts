import { useOrdersStore } from '@/state/ordersStore';

/**
 * Durable orders that were delivered and contained the product. This is the
 * client-side mirror of the server gate (`GET`-time eligibility); the server
 * re-checks it on write, so the screen is safe to deep-link into.
 */
export function deliveredOrderIdsForProduct(productId: string): string[] {
  if (!productId) return [];
  const { orders, serverOrders } = useOrdersStore.getState();
  return [...orders, ...serverOrders]
    .filter(
      (order) =>
        order.status === 'Delivered' &&
        (order.items ?? []).some((item) => item.id === productId),
    )
    .map((order) => order.orderId);
}

/** Verified buyers only: a delivered order must contain the product. */
export function canReviewProduct(productId: string): boolean {
  return deliveredOrderIdsForProduct(productId).length > 0;
}

const MAX_COMMENT = 280;

export function clampReviewComment(comment: string): string {
  return comment.slice(0, MAX_COMMENT);
}

export const MAX_PRODUCT_REVIEW_COMMENT = MAX_COMMENT;
