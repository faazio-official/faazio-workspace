#!/usr/bin/env node
/**
 * Seed generator — compiles the root `@data/*` fixtures (the mock twins) and emits:
 *   server/supabase/seed/0001_seed.sql        (Postgres seed, IDs identical to @data)
 *   server/supabase/seed/mongo/sdui_layouts.json
 *
 * IDs are copied verbatim from @data so cache keys/CDN URLs stay stable (contract freeze,
 * docs/architecture/monolith-breakdown.md §4). Re-run after any @data fixture change:
 *   node server/supabase/seed/generate.mjs
 *
 * Money in @data is rupees; the DB contract is INT8 paisa (₹1 = 100) — multiplied here.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const tsc = join(repoRoot, 'client/mobile/node_modules/.bin/tsc');
const buildDir = join(here, '.build');

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------- compile @data
rmSync(buildDir, { recursive: true, force: true });
mkdirSync(buildDir, { recursive: true });
const res = spawnSync(
  tsc,
  [
    join(repoRoot, 'data/index.ts'),
    '--outDir', buildDir,
    '--module', 'commonjs',
    '--target', 'es2020',
    '--moduleResolution', 'node10',
    '--ignoreDeprecations', '6.0',
    '--esModuleInterop',
    '--skipLibCheck',
    '--noEmitOnError', 'false',
  ],
  { stdio: 'inherit' },
);
// tsc exits non-zero on the known `__DEV__` ambient-error, but still emits. Verify output.
globalThis.__DEV__ = false;
let d;
try {
  d = require(join(buildDir, 'index.js'));
} catch (err) {
  console.error('tsc produced no usable output', res.status, err);
  process.exit(1);
}

// ---------------------------------------------------------------- helpers
const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v === null || v === undefined || v === '' ? 'null' : Number(v));
const b = (v) => (v === null || v === undefined ? 'null' : v ? 'true' : 'false');
const paisa = (v) => (v === null || v === undefined ? 'null' : Math.round(Number(v) * 100));
const arr = (a) => (Array.isArray(a) && a.length ? `ARRAY[${a.map(q).join(', ')}]::text[]` : `ARRAY[]::text[]`);
const jsonb = (o) => (o === undefined || o === null ? 'null' : `${q(JSON.stringify(o))}::jsonb`);
const ts = (s) => `${q(s)}::timestamptz`;

function parseDate(input, fallbackIndex = 0) {
  if (input) {
    const cleaned = String(input).replace(/•/g, ' ').replace(/\s+/g, ' ').trim();
    const t = Date.parse(cleaned);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }
  return new Date(Date.UTC(2026, 0, 1) - fallbackIndex * 86400000).toISOString();
}

const APP = (v) => `'${v}'::app_brand`;
const STATUS = { Processing: 'Processing', Shipped: 'Shipped', Delivered: 'Delivered', Cancelled: 'Cancelled' };
const FULFIL = (v) => (v === 'PICKUP' ? "'PICKUP'::fulfillment_mode" : v === 'DELIVERY' ? "'DELIVERY'::fulfillment_mode" : 'null');
const slug = (s) => 'seed-' + String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function inserts(table, columns, rows, batch = 100) {
  const out = [];
  for (let i = 0; i < rows.length; i += batch) {
    const slice = rows.slice(i, i + batch);
    out.push(`insert into ${table} (${columns.join(', ')}) values`);
    out.push(slice.map((r) => `  (${r.join(', ')})`).join(',\n') + ';');
    out.push('');
  }
  return out.join('\n');
}

// ---------------------------------------------------------------- source product extras
// CatalogEntry drops storeId/isVeg; recover them from the domain product arrays by id.
const productMeta = new Map();
const addProduct = (p) => { if (p && p.id && !productMeta.has(p.id)) productMeta.set(p.id, p); };
for (const p of d.martProducts) addProduct(p);
for (const p of d.foodProducts) addProduct(p);
for (const p of d.pharmaProducts) addProduct(p);
for (const deal of d.MART_DEALS ?? []) addProduct(d.dealToProduct(deal));
for (const dish of d.TODAYS_SPECIALS ?? []) addProduct(d.dishToProduct(dish));

const PRESCRIPTION_CATEGORIES = new Set(['hypertension', 'asthma', 'fever']);
const isPrescription = (e) => e.app === 'PHARMA' && PRESCRIPTION_CATEGORIES.has(e.category);

// ---------------------------------------------------------------- demo seller + sponsored ads
// `sellers.sellers` has NO seeded row (there is no seller fixture in @data), yet
// `ads.sponsored_slots.seller_id` FKs to it — so a fresh deploy served an empty `GET /ads/live`.
// Seed one ACTIVE demo seller (the store-m1 owner), then the LIVE slots each placement reads
// (HOME_TOP rail, SPONSORED_SHOWCASE Mart hero, SECTOR_RAIL category drill-in). It also satisfies
// the pre-existing `sel-3` reference in `bookings.venue_configs`. Product ids must be catalog rows
// (asserted by `assertLeanContract`), so the app's `getProductsByIds` join never drops a placement.
const DEMO_SELLERS = [
  { id: 'sel-3', businessName: 'Faazio Mart Flagship', ownerName: 'Faazio Retail', app: 'MART', state: 'KA' },
];
const SPONSORED_SLOTS = [
  { slotId: 'ad-demo-home-1', sellerId: 'sel-3', productId: 'fm-m1', placement: 'HOME_TOP' },
  { slotId: 'ad-demo-home-2', sellerId: 'sel-3', productId: 'fm-m2', placement: 'HOME_TOP' },
  { slotId: 'ad-demo-home-3', sellerId: 'sel-3', productId: 'fm-gad10', placement: 'HOME_TOP' },
  { slotId: 'ad-demo-showcase-1', sellerId: 'sel-3', productId: 'fm-b1', placement: 'SPONSORED_SHOWCASE' },
  { slotId: 'ad-demo-sector-1', sellerId: 'sel-3', productId: 'fm-s1', placement: 'SECTOR_RAIL' },
];

// Seed donor directory users into checkout.users so blood.donors FKs hold (they are demo accounts).
const donorUsers = (d.BLOOD_DONORS ?? []).map((donor) => [
  q(donor.userId), q(donor.name), q(`${String(donor.name).toLowerCase().replace(/[^a-z0-9]+/g, '.')}@example.com`), q(''), 'null',
]);

const sql = [];
sql.push('-- Faazio MVP seed — generated from @data/* by server/supabase/seed/generate.mjs.');
sql.push('-- Do not edit by hand; re-run the generator after any @data fixture change.');
sql.push('begin;');
sql.push('');

// ---------------------------------------------------------------- directory
sql.push(inserts(
  'directory.stores',
  ['id', 'app', 'name', 'categories', 'rating', 'reviews_count', 'delivery_time', 'distance', 'cover_image', 'emoji', 'desc_text', 'offer_tag', 'is_veg', 'address', 'phone', 'hours'],
  d.storeDirectory.map((s) => [
    q(s.id), APP(s.app), q(s.name), arr(s.categories), n(s.rating), n(s.reviewsCount ?? 0),
    q(s.deliveryTime), q(s.distance), q(s.coverImage), q(s.emoji), q(s.desc), q(s.offerTag),
    b(s.isVeg), q(s.address), q(s.phone), q(s.hours),
  ]),
));

const storeIds = new Set(d.storeDirectory.map((s) => s.id));
sql.push(inserts(
  'directory.dining_venues',
  ['id', 'name', 'app', 'rating', 'cover_image', 'address', 'phone', 'hours', 'categories'],
  d.diningVenues.filter((v) => !storeIds.has(v.id)).map((v) => [
    q(v.id), q(v.name), APP('FOOD'), 'null', q(''), 'null', 'null', 'null', `ARRAY[]::text[]`,
  ]),
));

// ---------------------------------------------------------------- menus
// Per-venue dishes (data/food/menus.ts `restaurantMenus`, keyed by restaurant name); venue_id is the
// resolved vendor id (store or dining venue) — no FK, matching directory.vendors.
const menuRows = [];
for (const [name, dishes] of Object.entries(d.restaurantMenus ?? {})) {
  const venue = d.findDiningVenueByName(name);
  const venueId = venue ? venue.id : slug(name);
  for (const dish of dishes) {
    menuRows.push([
      q(venueId), q(dish.id), q(dish.dishName), paisa(dish.price), paisa(dish.mrp), b(dish.isVeg),
      q(dish.cuisine), n(dish.rating), q(dish.image),
      q(dish.description ?? ''), q(dish.emoji ?? ''), q(dish.deliveryTime ?? ''),
    ]);
  }
}
sql.push(inserts(
  'directory.menus',
  ['venue_id', 'dish_id', 'name', 'price_paisa', 'mrp_paisa', 'is_veg', 'cuisine', 'rating', 'image', 'description', 'emoji', 'delivery_time'],
  menuRows,
));

// ---------------------------------------------------------------- pickup points
// Durable self-pickup locations: one per store that has a full address/phone/hours, plus the
// neutral fallback hub (replaces the runtime-only NEUTRAL_PICKUP derivation).
sql.push(inserts(
  'inventory.pickup_points',
  ['id', 'store_id', 'name', 'address', 'phone', 'hours', 'is_active'],
  [
    ...d.storeDirectory
      .filter((s) => s.address && s.phone && s.hours)
      .map((s) => [q(s.id), q(s.id), q(s.name), q(s.address), q(s.phone), q(s.hours), 'true']),
    [q(d.NEUTRAL_PICKUP.id), 'null', q(d.NEUTRAL_PICKUP.name), q(d.NEUTRAL_PICKUP.address), q(d.NEUTRAL_PICKUP.phone), q(d.NEUTRAL_PICKUP.hours), 'true'],
  ],
));

// ---------------------------------------------------------------- catalog + inventory
sql.push(inserts(
  'catalog.products',
  ['id', 'app', 'category', 'name', 'search_tokens', 'price_paisa', 'mrp_paisa', 'rating', 'reviews_count', 'emoji', 'image_url', 'desc_text', 'badge', 'shop', 'unit', 'attributes', 'store_id', 'is_prescription', 'is_veg'],
  d.catalogIndex.map((e) => {
    const meta = productMeta.get(e.id);
    const storeId = meta?.storeId && storeIds.has(meta.storeId) ? meta.storeId : null;
    return [
      q(e.id), APP(e.app), q(e.category), q(e.name), arr(e.searchTokens),
      paisa(e.price), paisa(e.originalPrice), n(e.rating), n(e.reviewsCount ?? 0),
      q(e.emoji), q(e.image), q(e.desc), q(e.badge), q(e.shop), q(e.unit), jsonb(e.attributes),
      q(storeId), b(isPrescription(e)), b(meta?.isVeg),
    ];
  }),
));

sql.push(inserts(
  'inventory.stock',
  ['product_id', 'available', 'in_stock_qty', 'price_paisa', 'mrp_paisa', 'eta', 'is_prescription'],
  d.stockTable.map((s) => [
    q(s.productId), b(s.available), n(s.inStockQty), paisa(s.price), paisa(s.mrp), q(s.eta), b(s.isPrescription),
  ]),
));

// ---------------------------------------------------------------- reviews
sql.push(inserts(
  'reviews.reviews',
  ['id', 'product_id', 'app', 'user_name', 'avatar', 'rating', 'comment', 'date_label'],
  d.reviewsTable.map((r) => [q(r.id), q(r.productId), APP(r.app), q(r.user), q(r.avatar), n(r.rating), q(r.comment), q(r.date)]),
));
sql.push(inserts(
  'reviews.specs',
  ['id', 'app', 'label', 'value'],
  d.specsTable.map((s) => [q(s.id), APP(s.app), q(s.label), q(s.value)]),
));
sql.push(inserts(
  'reviews.highlights',
  ['id', 'app', 'text'],
  d.highlightsTable.map((h) => [q(h.id), APP(h.app), q(h.text)]),
));
sql.push(inserts(
  'reviews.vendor_reviews',
  ['id', 'vendor_id', 'app', 'user_id', 'user_name', 'rating', 'comment', 'order_ids', 'date_label'],
  d.vendorReviewsTable.map((r) => [q(r.id), q(r.vendorId), APP(r.app), q(slug(r.userName)), q(r.userName), n(r.rating), q(r.comment), arr(r.orderIds), q(r.date)]),
));

// ---------------------------------------------------------------- checkout
sql.push(inserts(
  'checkout.users',
  ['user_id', 'name', 'email', 'phone', 'default_address_id'],
  [
    ...d.usersTable.map((u) => [q(u.id), q(u.name), q(u.email), q(u.phone), q(u.defaultAddressId)]),
    ...donorUsers,
  ],
));
sql.push(inserts(
  'checkout.addresses',
  ['address_id', 'user_id', 'label', 'name', 'phone', 'address', 'is_default'],
  d.addressesTable.map((a) => [q(a.id), q(a.userId), q(a.label ?? a.tag ?? ''), q(a.name), q(a.phone), q(a.address), a.isDefault ? 'true' : 'false']),
));
// Coupons live in `promo.coupons` (0015, extended by 0021) — the anon `GET /coupons` projection the
// app reads. `checkout.coupons` (0001) is legacy and no longer seeded: no repo reads it. `sector` /
// `state_code` stay null so every app sees them; `valid_till` is a fixed future stamp so the
// `valid_till > now()` public filter keeps them live. `max_discount_paisa` = 0 (no cap in @data).
sql.push(inserts(
  'promo.coupons',
  ['coupon_id', 'code', 'title', 'scope', 'state_code', 'sector', 'value_percent',
    'max_discount_paisa', 'min_order_paisa', 'free_delivery', 'valid_till', 'active'],
  d.couponsTable.map((c) => [
    q(`cpn-${String(c.code).toLowerCase()}`), q(c.code), q(c.label), `'GLOBAL'::campaign_scope`,
    'null', 'null', n(c.discountPercent ?? 0), n(0), paisa(c.minOrder ?? 0),
    c.isFreeDelivery ? 'true' : 'false', ts('2027-12-31T23:59:59Z'), 'true',
  ]),
));

const orders = d.ordersTable.map((o, i) => ({
  ...o,
  totalPaisa: o.lineItems.reduce((sum, li) => sum + li.qty * li.unitPrice, 0) * 100,
  placedAt: parseDate(o.placedAt, i),
  statusDate: o.statusDate ? parseDate(o.statusDate, i) : null,
  status: STATUS[o.status] ?? 'Delivered',
  addressId: o.addressId && d.addressesTable.some((a) => a.id === o.addressId) ? o.addressId : null,
}));
sql.push(inserts(
  'checkout.orders',
  ['order_id', 'order_number', 'user_id', 'address_id', 'placed_at', 'status', 'status_date', 'fulfillment', 'total_paisa', 'vendor_store_ids'],
  orders.map((o) => [
    q(o.id), q(o.orderNumber), q(o.userId), q(o.addressId), ts(o.placedAt),
    `'${o.status}'::order_status`, o.statusDate ? ts(o.statusDate) : 'null',
    FULFIL(o.fulfillment), n(o.totalPaisa), arr(o.vendorStoreIds),
  ]),
));
sql.push(inserts(
  'checkout.order_items',
  ['line_id', 'order_id', 'product_id', 'name', 'variant', 'qty', 'unit_price_paisa'],
  orders.flatMap((o) => o.lineItems.map((li) => [q(li.lineId), q(o.id), q(li.productId), q(li.name), q(li.variant), n(li.qty), paisa(li.unitPrice)])),
));

// ---------------------------------------------------------------- accounts
sql.push(inserts(
  'accounts.profile',
  ['id', 'account_id', 'name', 'email', 'phone'],
  d.profileTable.map((p) => [q(p.id), q(p.accountId), q(p.name), q(p.email), q(p.phone)]),
));
sql.push(inserts(
  'accounts.membership',
  ['id', 'user_id', 'title', 'saved_label', 'saved_amount'],
  d.membershipTable.map((m) => [q(m.id), q(m.userId), q(m.title), q(m.savedLabel), paisa(m.savedAmount)]),
));
sql.push(inserts(
  'accounts.order_status',
  ['id', 'user_id', 'key', 'label', 'count'],
  d.orderStatusTable.map((s) => [q(s.id), q(s.userId), q(s.key), q(s.label), n(s.count)]),
));
sql.push(inserts(
  'accounts.nav',
  ['user_id', 'key', 'rows'],
  d.navTable.map((g) => [q(g.userId), q(g.key), jsonb(g.rows)]),
));
sql.push(inserts(
  'accounts.details',
  ['user_id', 'account_id', 'data'],
  d.detailsTable.map((t) => [q(t.userId), q(t.accountId), jsonb(t)]),
));

// ---------------------------------------------------------------- favourites
// The demo user's shelf (seedFavorites) — durable hearts, previously in-memory only.
sql.push(inserts(
  'favourites.items',
  ['user_id', 'product_id'],
  (d.seedFavorites ?? []).map((productId) => [q('user-1'), q(productId)]),
));

// ---------------------------------------------------------------- rewards
// Demo balance mirrors the client seed (SEED_COIN_BALANCE / SEED_STREAK_COUNT).
sql.push(inserts(
  'rewards.balances',
  ['user_id', 'coins', 'streak', 'last_order_day', 'card'],
  [[q('user-1'), n(245), n(5), 'null', 'null']],
));

// ---------------------------------------------------------------- prescriptions
// Two demo Rx rows; image_paths stay empty (no binary in seed — images live in Supabase Storage).
sql.push(inserts(
  'pharma.prescriptions',
  ['id', 'user_id', 'vendor_id', 'fulfillment', 'pages', 'note', 'image_paths', 'status'],
  [
    [q('RX-000001'), q('user-1'), q('store-p1'), FULFIL('DELIVERY'), n(1), q('Blood pressure medication refill'), arr([]), `'RECEIVED'::prescription_status`],
    [q('RX-000002'), q('user-1'), q('store-p2'), FULFIL('PICKUP'), n(2), q('Post-surgery antibiotics'), arr([]), `'PROCESSING'::prescription_status`],
  ],
));

// ---------------------------------------------------------------- blood donor registry
// Consented donor directory + the request board + sample interests/matches. Donor user_ids were
// seeded into checkout.users above so the FKs hold. consent=true puts them in blood.donor_directory.
sql.push(inserts(
  'blood.donors',
  ['user_id', 'name', 'blood_group', 'city', 'donation_type', 'willing_to_travel', 'available', 'consent', 'consent_at'],
  (d.BLOOD_DONORS ?? []).map((donor) => [
    q(donor.userId), q(donor.name), q(donor.bloodGroup), q(donor.city), q(donor.donationType),
    b(donor.willingToTravel === 'yes'), b(donor.available), 'true', 'now()',
  ]),
));
sql.push(inserts(
  'blood.requests',
  ['id', 'hospital', 'city', 'state', 'blood_group', 'units', 'patient_context', 'needed_within', 'verified', 'urgency', 'contact', 'address', 'remarks', 'posted_at', 'expires_at'],
  (d.BLOOD_REQUESTS ?? []).map((r) => [
    q(r.id), q(r.hospital), q(r.city), q(r.state), q(r.bloodGroup), n(r.unitsRequired),
    q(r.patientContext), q(r.neededWithin), b(r.verified), q(r.urgency), q(r.hospitalContact),
    q(r.hospitalAddress), q(r.remarks), `(now() - interval '${n(r.postedHoursAgo) || 0} hours')`, `(now() + interval '14 days')`,
  ]),
));
sql.push(inserts(
  'blood.interests',
  ['request_id', 'donor_user_id', 'kind'],
  [
    [q('br-1'), q('user-1'), q('interested')],
    [q('br-4'), q('user-1'), q('accepted')],
  ],
));
sql.push(inserts(
  'blood.match_requests',
  ['id', 'requester_user_id', 'donor_user_id', 'blood_group', 'city', 'status'],
  [[q('dmr-000001'), q('user-1'), q((d.BLOOD_DONORS ?? [])[0]?.userId ?? 'user-2'), q('O+'), q('Chennai'), `'pending'::match_status`]],
));

// ---------------------------------------------------------------- bookings (tables + food orders)
const seedVenue = (d.diningVenues ?? [])[0];
const seedVenueId = seedVenue ? seedVenue.id : slug('The Green Garden Bistro');
const seedVenueName = seedVenue ? seedVenue.name : 'The Green Garden Bistro';
// Seat bookings (0020): server-derived ₹50/seat platform fee; `slot` is deprecated ('').
const BOOKING_FEE_PAISA = 5000;
sql.push(inserts(
  'bookings.tables',
  ['id', 'user_id', 'vendor_id', 'restaurant_name', 'booking_date', 'slot', 'guests', 'seats', 'fee_paisa', 'status'],
  [
    [q('BKG-000001'), q('user-1'), q(seedVenueId), q(seedVenueName), q('2026-02-01'), q(''), n(2), n(2), n(2 * BOOKING_FEE_PAISA), `'confirmed'::booking_status`],
    [q('BKG-000002'), q('user-1'), q(seedVenueId), q(seedVenueName), q('2026-02-05'), q(''), n(4), n(4), n(4 * BOOKING_FEE_PAISA), `'pending'::booking_status`],
  ],
));
sql.push(inserts(
  'bookings.payments',
  ['id', 'booking_id', 'user_id', 'amount_paisa', 'razorpay_order_id', 'razorpay_payment_id', 'status'],
  [
    [q('bpay-seed-1'), q('BKG-000001'), q('user-1'), n(2 * BOOKING_FEE_PAISA), q('order_seed_1'), q('pay_seed_1'), q('CAPTURED')],
    [q('bpay-seed-2'), q('BKG-000002'), q('user-1'), n(4 * BOOKING_FEE_PAISA), q('order_seed_2'), q('pay_seed_2'), q('AUTHORIZED')],
  ],
));
// Demo bookable venue: one config row makes the seed venue show "Reserve seats • ₹50/seat" in the
// app and appear as the default venue in the web seller settings page. Rollback = flip enabled off.
sql.push(inserts(
  'bookings.venue_configs',
  ['vendor_id', 'seller_id', 'booking_enabled', 'total_seats', 'track_occupancy', 'open_time', 'close_time', 'paused'],
  [[q(seedVenueId), q('sel-3'), b(true), n(40), b(true), q('09:00'), q('21:00'), b(false)]],
));

// ---------------------------------------------------------------- demo seller + sponsored ads
// Must follow the seller insert (FK) — the ads rail is the anon `GET /ads/live` projection.
sql.push(inserts(
  'sellers.sellers',
  ['seller_id', 'business_name', 'owner_name', 'category', 'state_code', 'status'],
  DEMO_SELLERS.map((s) => [q(s.id), q(s.businessName), q(s.ownerName), APP(s.app), q(s.state), `'ACTIVE'::seller_status`]),
));
sql.push(inserts(
  'ads.sponsored_slots',
  ['slot_id', 'seller_id', 'product_id', 'placement', 'status', 'impressions', 'clicks', 'orders_attributed'],
  SPONSORED_SLOTS.map((a) => [
    q(a.slotId), q(a.sellerId), q(a.productId), `'${a.placement}'::ad_placement`, `'LIVE'::ad_status`, n(0), n(0), n(0),
  ]),
));
sql.push('commit;');
sql.push('');

// ---------------------------------------------------------------- lean-contract checks
// Fail loudly if a fixture ever violates the dtype freeze (WORKFLOW_SCRATCHPAD.md §0):
// money is integer paisa, ratings are 0–5 at 1 decimal, search tokens must fit the 64-char
// JSONB key bound, and the dropped `slug_uid` / `quality_score` columns must never reappear.
function assertLeanContract() {
  const violations = [];
  const isRupees = (v) => v === null || v === undefined || Number.isInteger(v);
  const isRating = (v) =>
    v === null || v === undefined ||
    (typeof v === 'number' && v >= 0 && v <= 5 && Math.abs(v * 10 - Math.round(v * 10)) < 1e-9);

  for (const e of d.catalogIndex) {
    if (!isRupees(e.price) || !isRupees(e.originalPrice)) violations.push(`product ${e.id}: non-integer rupees price`);
    if (!isRating(e.rating)) violations.push(`product ${e.id}: rating ${e.rating} out of 0–5/1dp`);
    for (const t of e.searchTokens ?? []) {
      if (String(t).length > 64) violations.push(`product ${e.id}: search token >64 chars`);
    }
  }
  for (const s of d.storeDirectory) {
    if (!isRating(s.rating)) violations.push(`store ${s.id}: rating ${s.rating} out of 0–5/1dp`);
  }
  for (const s of d.stockTable) {
    if (!isRupees(s.price) || !isRupees(s.mrp)) violations.push(`stock ${s.productId}: non-integer rupees price`);
  }
  // Menu MRP is the Food discount authority (`mrp_paisa >= price_paisa`); a bad fixture must not
  // produce a DB row the `0022` CHECK rejects.
  for (const dishes of Object.values(d.restaurantMenus ?? {})) {
    for (const dish of dishes) {
      if (dish.mrp !== undefined && (!isRupees(dish.mrp) || dish.mrp < dish.price)) {
        violations.push(`menu ${dish.id}: MRP ${dish.mrp} must be an integer >= price ${dish.price}`);
      }
    }
  }
  // Rewards rates mirror `0017` rewards.rates defaults; keep them positive integers so the DB
  // default row and @data never drift (admin console tunes a copy, not the source constant).
  for (const [name, v] of [
    ['COIN_EARN_RATE', d.COIN_EARN_RATE], ['COIN_REDEEM_RATE', d.COIN_REDEEM_RATE],
    ['STREAK_TARGET_DAYS', d.STREAK_TARGET_DAYS], ['DISCOUNT_CARD_PERCENT', d.DISCOUNT_CARD_PERCENT],
    ['DISCOUNT_CARD_VALIDITY_DAYS', d.DISCOUNT_CARD_VALIDITY_DAYS],
  ]) {
    if (!Number.isInteger(v) || v <= 0) violations.push(`rewards ${name}: ${v} must be a positive integer`);
  }
  const sqlText = sql.join('\n');
  if (sqlText.includes('slug_uid')) violations.push('dropped column `slug_uid` leaked into seed');
  if (sqlText.includes('quality_score')) violations.push('dropped column `quality_score` leaked into seed');

  // Sponsored slots must reference a real catalog row + a seeded seller, or the app's
  // `getProductsByIds` join silently drops a paid placement (and `ads.sponsored_slots.seller_id` FK).
  const catalogIds = new Set(d.catalogIndex.map((e) => e.id));
  const sellerIds = new Set(DEMO_SELLERS.map((s) => s.id));
  for (const a of SPONSORED_SLOTS) {
    if (!catalogIds.has(a.productId)) violations.push(`sponsored slot ${a.slotId}: product ${a.productId} not in catalogIndex`);
    if (!sellerIds.has(a.sellerId)) violations.push(`sponsored slot ${a.slotId}: seller ${a.sellerId} not seeded`);
  }

  if (violations.length) {
    console.error(`seed lean-contract violations (${violations.length}):\n - ${violations.join('\n - ')}`);
    process.exit(1);
  }
}
assertLeanContract();

writeFileSync(join(here, '0001_seed.sql'), sql.join('\n'));

// ---------------------------------------------------------------- Mongo seed
const sduiDoc = {
  _id: 'home',
  version: 1,
  locale: 'en',
  // Deterministic publish stamp: version drives the gateway ETag, this is informational only.
  updatedAt: '2026-01-01T00:00:00.000Z',
  sections: d.homeSdui.map((s) => ({
    id: s.id,
    title: s.title,
    subtitle: s.subtitle ?? null,
    accent: s.accent,
    productIds: s.productIds,
    storeIds: s.storeIds ?? [],
    chips: s.chips ?? [],
  })),
};
const mongoDir = join(here, 'mongo');
mkdirSync(mongoDir, { recursive: true });
writeFileSync(join(mongoDir, 'sdui_layouts.json'), JSON.stringify(sduiDoc, null, 2) + '\n');
writeFileSync(
  join(mongoDir, 'user_events.example.json'),
  JSON.stringify({ _id: '65f000000000000000000000', userIdHash: 'sha256:<hex>', productId: 'fm-f1', event: 'view', at: '2026-01-01T00:00:00Z', ttlDays: 90 }, null, 2) + '\n',
);

// mongosh init script (docker-compose / Atlas): upsert the layout, indexes, and the four MVP
// collection validators (sdui_layouts, user_events, recommendations, product_stats).
writeFileSync(join(mongoDir, 'seed.js'), [
  '// Faazio Mongo seed — generated. Upserts the ID-only Home layout, the user_events TTL index,',
  '// and the defence-in-depth validators for the four MVP collections. `segments` stays Future Prod.',
  'db = db.getSiblingDB(process.env.MONGO_DATABASE || "faazio");',
  'db.sdui_layouts.replaceOne({ _id: "home" }, ' + JSON.stringify(sduiDoc) + ', { upsert: true });',
  'db.user_events.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "user_events_ttl" });',
  '// Reject junk at write time (the gateway handler already allowlists); keeps Atlas M0 bounded.',
  'db.runCommand({',
  '  collMod: "user_events",',
  '  validator: { $jsonSchema: {',
  '    bsonType: "object",',
  '    required: ["userIdHash", "productId", "event", "at", "expiresAt"],',
  '    properties: {',
  '      userIdHash: { bsonType: "string" },',
  '      productId: { bsonType: "string", maxLength: 64 },',
  '      event: { enum: ["view", "cart_add", "order", "search"] },',
  '      at: { bsonType: "date" },',
  '      expiresAt: { bsonType: "date" }',
  '    }',
  '  } },',
  '  validationLevel: "moderate",',
  '  validationAction: "error"',
  '});',
  '// recommendations + product_stats are written by the Future Prod batch job; empty on the MVP.',
  '// Validators are created lazily via collMod so the read path never has to create the collection.',
  'for (const def of [',
  '  { name: "recommendations", schema: {',
  '    bsonType: "object",',
  '    required: ["userIdHash", "productIds", "generatedAt"],',
  '    properties: {',
  '      userIdHash: { bsonType: "string" },',
  '      productIds: { bsonType: "array", maxItems: 100, items: { bsonType: "string", maxLength: 64 } },',
  '      generatedAt: { bsonType: "date" }',
  '    } } },',
  '  { name: "product_stats", schema: {',
  '    bsonType: "object",',
  '    required: ["productId", "score", "updatedAt"],',
  '    properties: {',
  '      productId: { bsonType: "string", maxLength: 64 },',
  '      score: { bsonType: "double" },',
  '      views: { bsonType: "long" },',
  '      cartAdds: { bsonType: "long" },',
  '      orders: { bsonType: "long" },',
  '      updatedAt: { bsonType: "date" }',
  '    } } },',
  ']) {',
  '  if (!db.getCollectionNames().includes(def.name)) db.createCollection(def.name);',
  '  db.runCommand({ collMod: def.name, validator: { $jsonSchema: def.schema },',
  '    validationLevel: "moderate", validationAction: "error" });',
  '}',
  'print("mongo seed: sdui_layouts=home version=" + ' + JSON.stringify(sduiDoc.version) + ' + " + 4 collections");',
  '',
].join('\n'));

rmSync(buildDir, { recursive: true, force: true });
console.log(`seed written: ${d.catalogIndex.length} products, ${d.storeDirectory.length} stores, ${orders.length} orders, ${d.vendorReviewsTable.length} vendor reviews, ${(d.seedFavorites ?? []).length} favourites, ${menuRows.length} menu dishes, ${(d.BLOOD_DONORS ?? []).length} blood donors, ${(d.BLOOD_REQUESTS ?? []).length} blood requests`);