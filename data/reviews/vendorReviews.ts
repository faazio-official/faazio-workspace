/**
 * @mock Simulates a Go + PostgreSQL **vendor reviews** microservice. Vendor-
 * scoped reviews keyed by vendor id (`data/directory/vendors.ts`), distinct from
 * the product-scoped `reviews/reviews.ts`. These are the seeded public reviews;
 * the signed-in user's own live rating is owned by `state/vendorRatingStore.ts`
 * and merged in by `services/vendorRatings.ts`.
 *
 * Public display is **full name only** — no user id, phone, order id, or avatar.
 * `orderIds` is verified-purchase provenance and is never shown. See
 * docs/architecture/db-schema.md §7.7.
 */
import type { AppBrand } from '../types';

export interface VendorReviewRow {
  id: string;
  vendorId: string;
  app: AppBrand;
  /** Reviewer full name — safe to display publicly. */
  userName: string;
  rating: number;
  comment: string;
  date: string;
  /** Verified-purchase provenance (order ids). Never rendered publicly. */
  orderIds: string[];
}

const seed = (
  id: string,
  vendorId: string,
  app: AppBrand,
  userName: string,
  rating: number,
  comment: string,
  date: string,
): VendorReviewRow => ({ id, vendorId, app, userName, rating, comment, date, orderIds: [] });

export const vendorReviewsTable: VendorReviewRow[] = [
  // ---- Mart vendors ----
  seed('vr-g1-1', 'store-g1', 'MART', 'Pooja Nair', 5, 'Fresh produce every single time. The apples and milk are my weekly staples now.', '2 days ago'),
  seed('vr-g1-2', 'store-g1', 'MART', 'Suresh Iyer', 4, 'Great quality, delivery is quick. Packaging could be a little more eco-friendly.', '1 week ago'),
  seed('vr-m3-1', 'store-m3', 'MART', 'Aditya Rao', 5, 'The hoodie fits perfectly and the fabric feels premium. Will order again.', '5 days ago'),
  seed('vr-m3-2', 'store-m3', 'MART', 'Kavya Menon', 4, 'Trendy collection and genuine products. Sizes run slightly small.', '2 weeks ago'),

  // ---- Pharma vendors ----
  seed('vr-p1-1', 'store-p1', 'PHARMA', 'Dr. Sarah Alvi', 5, 'Genuine medicines with clear expiry dates. Reliable for the whole family.', '4 days ago'),
  seed('vr-p2-1', 'store-p2', 'PHARMA', 'Rahul Verma', 5, 'Well stocked and the pharmacist was helpful with dosage advice.', '1 week ago'),

  // ---- Food restaurants ----
  seed('vr-f3-1', 'store-f3', 'FOOD', 'Aarav Sharma', 5, 'Smash burgers were juicy and the loaded fries arrived hot. Loved it.', '3 days ago'),
  seed('vr-f3-2', 'store-f3', 'FOOD', 'Neha Kapoor', 4, 'Tasty food, generous portions. Delivery took a little longer than promised.', '1 week ago'),
  seed('vr-f8-1', 'store-f8', 'FOOD', 'Ravi Desai', 5, 'Rich, aromatic biryani — the dum flavour really comes through.', '2 days ago'),
  seed('vr-f7-1', 'store-f7', 'FOOD', 'Meera Nair', 5, 'Wood-fired pizza done right. Fresh bufala and a beautifully blistered crust.', '6 days ago'),
  seed('vr-dn12-1', 'dn-12', 'FOOD', 'Priya Patel', 5, 'Best Hyderabadi biryani in the city. The raita and salan were a lovely bonus.', '1 week ago'),
];

export function getReviewsByVendorId(vendorId: string): VendorReviewRow[] {
  return vendorReviewsTable.filter((review) => review.vendorId === vendorId);
}
