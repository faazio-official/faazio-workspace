/**
 * @mock Simulates a Go + PostgreSQL reviews/specs microservice. Consolidates
 * `productMeta/reviews.ts` into relational tables. Reviews are **product-scoped**,
 * keyed by real catalog product ids (`martProducts`, `foodProducts`,
 * `pharmaProducts`). Unkeyed products fall back to their app's representative
 * review set so `getReviewsByProductId` never returns empty. Legacy app-scoped
 * helpers are preserved (unchanged) for screens still on the old surface.
 * See data/DATA_CONTROL.md.
 */
import type { AppBrand, Review, SpecItem } from '../types';
import {
  getProductReviews,
  getProductSpecs,
  getProductHighlights,
  avatarMap as legacyAvatarMap,
} from '../productMeta/reviews';
import { martProducts } from '../mart/products';
import { foodProducts } from '../food/products';
import { pharmaProducts } from '../pharma/products';

/** Extended reviewer avatar pool (beyond the legacy 10) for richer per-product reviews. */
export const avatarMap: Record<string, string> = {
  ...legacyAvatarMap,
  'Ishita Roy': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?fm=jpg&fit=crop&q=80&w=56&h=56',
  'Karan Malhotra': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?fm=jpg&fit=crop&q=80&w=56&h=56',
  'Divya Krishnan': 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?fm=jpg&fit=crop&q=80&w=56&h=56',
  'Suresh Iyer': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?fm=jpg&fit=crop&q=80&w=56&h=56',
  'Tanvi Joshi': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?fm=jpg&fit=crop&q=80&w=56&h=56',
  'Aditya Rao': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?fm=jpg&fit=crop&q=80&w=56&h=56',
  'Pooja Nair': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?fm=jpg&fit=crop&q=80&w=56&h=56',
  'Rohan Khanna': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?fm=jpg&fit=crop&q=80&w=56&h=56',
  'Kavya Menon': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?fm=jpg&fit=crop&q=80&w=56&h=56',
  'Arnav Deshpande': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?fm=jpg&fit=crop&q=80&w=56&h=56',
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

/** Per-product review assignment keyed by real catalog product id. */
const PRODUCT_REVIEWS: Record<string, Array<Omit<ReviewRow, 'id' | 'productId' | 'app'>>> = {
  // ---- Mart bestsellers ----
  'fm-m1': [
    { user: 'Karan Malhotra', avatar: avatarMap['Karan Malhotra'], rating: 5, comment: 'Flagship speed and an incredible camera. Battery easily lasts a full day.', date: '1 week ago' },
    { user: 'Ishita Roy', avatar: avatarMap['Ishita Roy'], rating: 5, comment: 'Smooth display and premium build. Worth every rupee.', date: '2 weeks ago' },
    { user: 'Rohan Khanna', avatar: avatarMap['Rohan Khanna'], rating: 4, comment: 'Great phone, though a bit heavy. Charging is super fast.', date: '3 weeks ago' },
    { user: 'Divya Krishnan', avatar: avatarMap['Divya Krishnan'], rating: 5, comment: 'Camera clarity is outstanding, especially in low light.', date: '1 month ago' },
  ],
  'fm-e1': [
    { user: 'Suresh Iyer', avatar: avatarMap['Suresh Iyer'], rating: 5, comment: 'Noise cancellation is fantastic. Super comfortable for long calls.', date: '4 days ago' },
    { user: 'Pooja Nair', avatar: avatarMap['Pooja Nair'], rating: 4, comment: 'Great bass and build. Battery could be slightly better.', date: '1 week ago' },
    { user: 'Arnav Deshpande', avatar: avatarMap['Arnav Deshpande'], rating: 5, comment: 'Best value in this price range. Crisp, balanced sound.', date: '2 weeks ago' },
  ],
  'fm-b1': [
    { user: 'Tanvi Joshi', avatar: avatarMap['Tanvi Joshi'], rating: 5, comment: 'Skin felt hydrated from day one. Non-greasy and light.', date: '3 days ago' },
    { user: 'Kavya Menon', avatar: avatarMap['Kavya Menon'], rating: 4, comment: 'Works well, mild fragrance. Pump bottle is convenient.', date: '1 week ago' },
    { user: 'Ishita Roy', avatar: avatarMap['Ishita Roy'], rating: 5, comment: 'Visible glow in two weeks. Genuine product with good packaging.', date: '2 weeks ago' },
  ],
  'fm-f1': [
    { user: 'Aditya Rao', avatar: avatarMap['Aditya Rao'], rating: 5, comment: 'Perfect fit and heavy fabric. Exactly as shown.', date: '5 days ago' },
    { user: 'Rohan Khanna', avatar: avatarMap['Rohan Khanna'], rating: 4, comment: 'Great hoodie, runs a touch small. Order a size up.', date: '1 week ago' },
    { user: 'Suresh Iyer', avatar: avatarMap['Suresh Iyer'], rating: 4, comment: 'Comfortable and warm. Colour matches the listing.', date: '2 weeks ago' },
  ],
  'fm-fur1': [
    { user: 'Divya Krishnan', avatar: avatarMap['Divya Krishnan'], rating: 5, comment: 'Excellent lumbar support, great for 8-hour workdays.', date: '1 week ago' },
    { user: 'Arnav Deshpande', avatar: avatarMap['Arnav Deshpande'], rating: 5, comment: 'Premium mesh, smooth recline, sturdy base. Love it.', date: '2 weeks ago' },
    { user: 'Karan Malhotra', avatar: avatarMap['Karan Malhotra'], rating: 4, comment: 'Very comfortable. Assembly took a little effort.', date: '3 weeks ago' },
  ],
  'gr-p1': [
    { user: 'Pooja Nair', avatar: avatarMap['Pooja Nair'], rating: 5, comment: 'Crisp and sweet. Delivered fresh and well packed.', date: '2 days ago' },
    { user: 'Tanvi Joshi', avatar: avatarMap['Tanvi Joshi'], rating: 4, comment: 'Good quality apples, slight variation in size.', date: '1 week ago' },
    { user: 'Suresh Iyer', avatar: avatarMap['Suresh Iyer'], rating: 5, comment: 'Perfect for a healthy snack. Repeat order coming.', date: '2 weeks ago' },
  ],
  // ---- Food bestsellers ----
  'sp-1': [
    { user: 'Aarav Sharma', avatar: avatarMap['Aarav Sharma'], rating: 5, comment: 'Rich, aromatic and generously portioned. Best biryani in town.', date: '2 days ago' },
    { user: 'Rahul Verma', avatar: avatarMap['Rahul Verma'], rating: 5, comment: 'Authentic Hyderabadi taste. The raita and salan were a bonus.', date: '1 week ago' },
    { user: 'Priya Patel', avatar: avatarMap['Priya Patel'], rating: 4, comment: 'Delicious but a little oily. Great value though.', date: '2 weeks ago' },
  ],
  'm-italian-margherita': [
    { user: 'Meera Nair', avatar: avatarMap['Meera Nair'], rating: 5, comment: 'Wood-fired perfection with fresh bufala. Crust is superb.', date: '3 days ago' },
    { user: 'Vikram Singh', avatar: avatarMap['Vikram Singh'], rating: 5, comment: 'Authentic Neapolitan-style. Cheese quality is excellent.', date: '1 week ago' },
    { user: 'Ananya Gupta', avatar: avatarMap['Ananya Gupta'], rating: 4, comment: 'Great pizza, delivery was a touch slow.', date: '2 weeks ago' },
  ],
  'm-korean-fc': [
    { user: 'Ravi Desai', avatar: avatarMap['Ravi Desai'], rating: 5, comment: 'Crispy, sticky, saucy perfection. Better than many KFCs.', date: '4 days ago' },
    { user: 'Neha Kapoor', avatar: avatarMap['Neha Kapoor'], rating: 5, comment: 'Sweet-soy glaze is addictive. Portion is generous.', date: '1 week ago' },
    { user: 'Meera Nair', avatar: avatarMap['Meera Nair'], rating: 4, comment: 'Tasty, though arrived slightly less crispy.', date: '2 weeks ago' },
  ],
  // ---- Pharma bestsellers ----
  'ph-f1': [
    { user: 'Dr. Sarah Alvi', avatar: avatarMap['Dr. Sarah Alvi'], rating: 5, comment: 'Genuine batch, clear expiry. Reliable for fever and pain.', date: '3 days ago' },
    { user: 'Rahul Verma', avatar: avatarMap['Rahul Verma'], rating: 5, comment: 'Fast relief and well packaged. Delivery was prompt.', date: '1 week ago' },
    { user: 'Priya Patel', avatar: avatarMap['Priya Patel'], rating: 4, comment: 'Works well. Wish the strip pack had more tablets.', date: '2 weeks ago' },
  ],
  'ph-ayur1': [
    { user: 'Suresh Iyer', avatar: avatarMap['Suresh Iyer'], rating: 5, comment: 'Traditional taste, authentic amla. Good for daily immunity.', date: '1 week ago' },
    { user: 'Ishita Roy', avatar: avatarMap['Ishita Roy'], rating: 4, comment: 'Quality chyawanprash, slightly sweet for my liking.', date: '2 weeks ago' },
    { user: 'Kavya Menon', avatar: avatarMap['Kavya Menon'], rating: 5, comment: 'Family has used this brand for years. Genuine product.', date: '1 month ago' },
  ],
  'ph-t3': [
    { user: 'Arnav Deshpande', avatar: avatarMap['Arnav Deshpande'], rating: 5, comment: 'Good strength capsules, easy to swallow. Value pack.', date: '5 days ago' },
    { user: 'Pooja Nair', avatar: avatarMap['Pooja Nair'], rating: 4, comment: 'Helps with energy. Packaging is fine.', date: '1 week ago' },
    { user: 'Divya Krishnan', avatar: avatarMap['Divya Krishnan'], rating: 5, comment: 'Great price for the count. Genuine stock.', date: '2 weeks ago' },
  ],
};

/** Representative product id per app used to seed app-scoped fallback reviews. */
const REPRESENTATIVE_PRODUCT_IDS: Record<AppBrand, string> = {
  FOOD: 'sp-1',
  MART: 'fm-m1',
  PHARMA: 'ph-f1',
};

let _rowCounter = 0;
function toReviewRow(app: AppBrand, productId: string, r: Omit<ReviewRow, 'id' | 'productId' | 'app'>): ReviewRow {
  _rowCounter += 1;
  return { id: `prv-${_rowCounter}`, productId, app, ...r };
}

/** Map a product id to its AppBrand by checking the real product arrays. */
function appForProductId(productId: string): AppBrand | undefined {
  if (martProducts.some((p) => p.id === productId)) return 'MART';
  if (foodProducts.some((p) => p.id === productId)) return 'FOOD';
  if (pharmaProducts.some((p) => p.id === productId)) return 'PHARMA';
  return undefined;
}

/** Product-keyed reviews (each row tagged with its product's app). */
export const reviewsTable: ReviewRow[] = Object.entries(PRODUCT_REVIEWS).flatMap(([productId, rows]) =>
  rows.map((r) => toReviewRow(appForProductId(productId) ?? 'MART', productId, r)),
);

/** App-scoped review pool (legacy) used as a fallback for products without keyed reviews. */
const LEGACY_APP_POOL: Record<AppBrand, ReviewRow[]> = (
  ['FOOD', 'MART', 'PHARMA'] as AppBrand[]
).reduce((acc, app) => {
  acc[app] = getProductReviews(app).map((r) =>
    toReviewRow(app, REPRESENTATIVE_PRODUCT_IDS[app], r),
  );
  return acc;
}, {} as Record<AppBrand, ReviewRow[]>);

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

/**
 * Return reviews for a product id. Products with keyed reviews return their own
 * rows; any other product falls back to its app's representative review set so
 * the detail surface is never empty.
 */
export function getReviewsByProductId(productId: string): ReviewRow[] {
  const keyed = reviewsTable.filter((r) => r.productId === productId);
  if (keyed.length > 0) return keyed;
  const app = appForProductId(productId);
  if (app) return LEGACY_APP_POOL[app];
  return LEGACY_APP_POOL.MART;
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
