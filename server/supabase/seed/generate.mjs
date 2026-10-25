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
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildData, cleanData } from './lib/databuild.mjs';
import { assetsInsertSql, assetRowsFromManifest, entryFor, loadManifest } from './lib/mediaplan.mjs';

const here = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- compile @data (shared lib)
const d = buildData();

// Phase 7 media manifest (written by backfill_r2.mjs). Absent → no media.assets rows and every
// image_key stays null, so the unsplash URLs remain the offline/legacy fallback.
const manifest = loadManifest(join(here, 'media_manifest.json'));

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
// (HOME_TOP rail, SPONSORED_SHOWCASE Mart hero, SECTOR_RAIL category drill-in). Product ids must be
// catalog rows (asserted by `assertLeanContract`), so the app's `getProductsByIds` join never drops
// a placement.
const DEMO_SELLERS = [
  { id: 'sel-3', businessName: 'Faazio Mart Flagship', ownerName: 'Faazio Retail', app: 'MART', state: 'KA' },
];
const SPONSORED_SLOTS = [
  { slotId: 'ad-demo-home-1', sellerId: 'sel-3', productId: 'fm-m1', placement: 'HOME_TOP' },
  { slotId: 'ad-demo-home-2', sellerId: 'sel-3', productId: 'fm-m2', placement: 'HOME_TOP' },
  { slotId: 'ad-demo-home-3', sellerId: 'sel-3', productId: 'fm-gad10', placement: 'HOME_TOP' },
  // Three LIVE SPONSORED_SHOWCASE rows so the Mart paid shelf demonstrates a real multi-card fill
  // instead of collapsing to null (a single row looked like a bug in QA).
  { slotId: 'ad-demo-showcase-1', sellerId: 'sel-3', productId: 'fm-b1', placement: 'SPONSORED_SHOWCASE' },
  { slotId: 'ad-demo-showcase-2', sellerId: 'sel-3', productId: 'fm-b2', placement: 'SPONSORED_SHOWCASE' },
  { slotId: 'ad-demo-showcase-3', sellerId: 'sel-3', productId: 'fm-gad10', placement: 'SPONSORED_SHOWCASE' },
  { slotId: 'ad-demo-sector-1', sellerId: 'sel-3', productId: 'fm-s1', placement: 'SECTOR_RAIL' },
];

// Seller hero campaigns (0027): one LIVE poster creative per new placement so Mart hero, the category
// drill-in top banner and a store header are never empty on a fresh deploy. Targets are real catalog
// rows / stores (asserted below) and `category` is a real `MASTER_CATEGORIES` tab id (cat_smart_gadgets).
const DEMO_HEROES = [
  {
    placementId: 'ad-cmp-demo-mart-1', campaignId: 'cmp-demo-mart', sellerId: 'sel-3',
    placement: 'MART_HERO', targetType: 'PRODUCT', targetId: 'fm-m1', targetApp: 'MART',
    category: null, storeId: null, title: 'Big Savings Everyday', subtitle: 'UP TO 50% OFF',
    cta: 'Shop Now', state: 'KA',
    imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?fm=jpg&fit=crop&q=80&w=800&h=450',
  },
  {
    placementId: 'ad-cmp-demo-cat-1', campaignId: 'cmp-demo-cat', sellerId: 'sel-3',
    placement: 'CATEGORY_TOP', targetType: 'PRODUCT', targetId: 'fm-gad10', targetApp: 'MART',
    category: 'cat_smart_gadgets', storeId: null, title: 'Gadget Fest', subtitle: 'FLAT 40% OFF',
    cta: 'Shop Now', state: 'KA',
    imageUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?fm=jpg&fit=crop&q=80&w=800&h=450',
  },
  {
    placementId: 'ad-cmp-demo-store-1', campaignId: 'cmp-demo-store', sellerId: 'sel-3',
    placement: 'STORE_TOP', targetType: 'STORE', targetId: 'store-m1', targetApp: 'MART',
    category: null, storeId: 'store-m1', title: 'Fresh Groceries Doorstep', subtitle: 'FREE DELIVERY',
    cta: 'View Store', state: 'KA',
    imageUrl: 'https://images.unsplash.com/photo-1579113800032-c38bd1625818?fm=jpg&fit=crop&q=80&w=800&h=450',
  },
  // Food sub-app hero (FOOD_HERO) — two LIVE poster creatives targeting real FOOD stores so the
  // placement is locally testable (was unseeded). The house fallback is `foodHero.banners`.
  {
    placementId: 'ad-cmp-demo-foodhero-1', campaignId: 'cmp-demo-foodhero', sellerId: 'sel-3',
    placement: 'FOOD_HERO', targetType: 'STORE', targetId: 'store-f1', targetApp: 'FOOD',
    category: null, storeId: null, title: 'Biryani Festival', subtitle: 'FLAT ₹150 OFF',
    cta: 'Order Now', state: 'KA',
    imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?fm=jpg&fit=crop&q=80&w=800&h=450',
  },
  {
    placementId: 'ad-cmp-demo-foodhero-2', campaignId: 'cmp-demo-foodhero', sellerId: 'sel-3',
    placement: 'FOOD_HERO', targetType: 'STORE', targetId: 'store-f8', targetApp: 'FOOD',
    category: null, storeId: null, title: 'Royal Mughlai Feast', subtitle: 'FESTIVE40 — 40% OFF',
    cta: 'Order Now', state: 'KA',
    imageUrl: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?fm=jpg&fit=crop&q=80&w=800&h=450',
  },
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

// ---------------------------------------------------------------- media registry
// Phase 7: the backfill (media_manifest.json) owns the R2 key/hash; the seed links those assets to
// their owners below. No manifest → media.assets is empty and `image_key` stays null.
if (manifest) {
  const assetRows = assetRowsFromManifest(manifest);
  if (assetRows.length) {
    sql.push('-- media.assets (from media_manifest.json — Phase 7 R2 backfill)');
    sql.push(assetsInsertSql(assetRows));
  }
}

// ---------------------------------------------------------------- directory
sql.push(inserts(
  'directory.stores',
  ['id', 'app', 'name', 'categories', 'rating', 'reviews_count', 'delivery_time', 'distance', 'cover_image', 'cover_image_key', 'cover_image_asset_id', 'emoji', 'desc_text', 'offer_tag', 'is_veg', 'address', 'phone', 'hours', 'latitude', 'longitude'],
  d.storeDirectory.map((s) => {
    const cover = entryFor(manifest, s.coverImage);
    return [
      q(s.id), APP(s.app), q(s.name), arr(s.categories), n(s.rating), n(s.reviewsCount ?? 0),
      q(s.deliveryTime), q(s.distance), q(s.coverImage), q(cover?.key), q(cover?.id), q(s.emoji),
      q(s.desc), q(s.offerTag), b(s.isVeg), q(s.address), q(s.phone), q(s.hours), n(s.latitude), n(s.longitude),
    ];
  }),
));

const storeIds = new Set(d.storeDirectory.map((s) => s.id));
sql.push(inserts(
  'directory.dining_venues',
  ['id', 'name', 'app', 'rating', 'cover_image', 'address', 'phone', 'hours', 'categories', 'latitude', 'longitude'],
  d.diningVenues.filter((v) => !storeIds.has(v.id)).map((v) => [
    q(v.id), q(v.name), APP('FOOD'), 'null', q(''), 'null', 'null', 'null', `ARRAY[]::text[]`, n(v.latitude), n(v.longitude),
  ]),
));

// ---------------------------------------------------------------- menus
// Per-venue dishes (data/food/menus.ts): `restaurantMenus` (dining rooms, keyed by name) + the
// derived `storeMenus` (the 12 delivery kitchens, keyed by store name). venue_id is the resolved
// vendor id (store or dining venue) — no FK, matching directory.vendors.
const venueMenus = { ...(d.restaurantMenus ?? {}), ...(d.storeMenus ?? {}) };
const menuRows = [];
for (const [name, dishes] of Object.entries(venueMenus)) {
  const venue = d.findDiningVenueByName(name);
  const venueId = venue ? venue.id : slug(name);
  for (const dish of dishes) {
    const img = entryFor(manifest, dish.image);
    menuRows.push([
      q(venueId), q(dish.id), q(dish.dishName), paisa(dish.price), paisa(dish.mrp), b(dish.isVeg),
      q(dish.cuisine), n(dish.rating), q(dish.image), q(img?.key), q(img?.id),
      q(dish.description ?? ''), q(dish.emoji ?? ''), q(dish.deliveryTime ?? ''), `'ACTIVE'::product_status`,
    ]);
  }
}
sql.push(inserts(
  'directory.menus',
  ['venue_id', 'dish_id', 'name', 'price_paisa', 'mrp_paisa', 'is_veg', 'cuisine', 'rating', 'image', 'image_key', 'image_asset_id', 'description', 'emoji', 'delivery_time', 'status'],
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
  ['id', 'app', 'category', 'name', 'search_tokens', 'price_paisa', 'mrp_paisa', 'rating', 'reviews_count', 'emoji', 'image_url', 'image_key', 'image_asset_id', 'desc_text', 'badge', 'shop', 'unit', 'attributes', 'store_id', 'is_prescription', 'is_veg', 'status'],
  d.catalogIndex.map((e) => {
    const meta = productMeta.get(e.id);
    const storeId = meta?.storeId && storeIds.has(meta.storeId) ? meta.storeId : null;
    const img = entryFor(manifest, e.image);
    return [
      q(e.id), APP(e.app), q(e.category), q(e.name), arr(e.searchTokens),
      paisa(e.price), paisa(e.originalPrice), n(e.rating), n(e.reviewsCount ?? 0),
      q(e.emoji), q(e.image), q(img?.key), q(img?.id), q(e.desc), q(e.badge), q(e.shop), q(e.unit), jsonb(e.attributes),
      q(storeId), b(isPrescription(e)), b(meta?.isVeg), `'ACTIVE'::product_status`,
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
// Hero campaigns (0027) — LIVE, in a wide open window so the anon `GET /ads/hero` projection serves
// them on a fresh deploy (mirrors the sponsored-slot demo rows).
sql.push(inserts(
  'ads.campaigns',
  ['placement_id', 'campaign_id', 'seller_id', 'placement', 'target_type', 'target_id', 'target_app',
    'category', 'store_id', 'title', 'subtitle', 'image_url', 'cta', 'state_code', 'starts_at', 'ends_at', 'status'],
  DEMO_HEROES.map((h) => [
    q(h.placementId), q(h.campaignId), q(h.sellerId), `'${h.placement}'::ad_placement`,
    `'${h.targetType}'::ad_target_type`, q(h.targetId), APP(h.targetApp), q(h.category), q(h.storeId),
    q(h.title), q(h.subtitle), q(h.imageUrl), q(h.cta), q(h.state),
    `(now() - interval '1 day')`, `(now() + interval '60 days')`, `'LIVE'::ad_status`,
  ]),
));
sql.push('commit;');
sql.push('');

// ---------------------------------------------------------------- SDUI sections
// The ID-only Home doc is `@data/home/sdui.ts` verbatim (single source). It now owns the Mart
// sections too (`martHero` house banners + `martDeals`/`martEssentials` id lists), so the Mart feed
// has one merchandising owner and the mock/remote shapes match exactly. `HomeView` skips unknown ids
// (`default → null`); `martService.fetchMartFeed` is the only reader of the Mart sections.
function buildSduiSections() {
  return d.homeSdui.map((s) => ({
    id: s.id, title: s.title, subtitle: s.subtitle ?? null, accent: s.accent,
    productIds: s.productIds, storeIds: s.storeIds ?? [], chips: s.chips ?? [],
    ...(s.banners && s.banners.length ? { banners: s.banners } : {}),
    ...(s.campaigns && s.campaigns.length ? { campaigns: s.campaigns } : {}),
  }));
}

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
  // Hero campaigns must point at real rows (the FK/read join would otherwise drop or dangle): a
  // catalog product, a seeded store/venue, a known app, and the contextual scope each placement needs.
  const storeIds = new Set(d.storeDirectory.map((s) => s.id));
  const venueIds = new Set((d.diningVenues ?? []).map((v) => v.id));
  for (const h of DEMO_HEROES) {
    if (!sellerIds.has(h.sellerId)) violations.push(`hero ${h.placementId}: seller ${h.sellerId} not seeded`);
    if (!['MART', 'FOOD', 'PHARMA'].includes(h.targetApp)) violations.push(`hero ${h.placementId}: bad target app ${h.targetApp}`);
    if (h.targetType === 'PRODUCT' && !catalogIds.has(h.targetId)) violations.push(`hero ${h.placementId}: product ${h.targetId} not in catalogIndex`);
    if ((h.targetType === 'STORE' || h.targetType === 'VENUE') && !storeIds.has(h.targetId) && !venueIds.has(h.targetId)) {
      violations.push(`hero ${h.placementId}: target ${h.targetId} not a seeded store/venue`);
    }
    if (h.placement === 'CATEGORY_TOP' && !h.category) violations.push(`hero ${h.placementId}: CATEGORY_TOP needs a category`);
    if (h.placement === 'STORE_TOP' && !h.storeId) violations.push(`hero ${h.placementId}: STORE_TOP needs a storeId`);
  }
  // SDUI product rails (`martDeals`/`martEssentials`/`foodSpecials`/`pharmaPopular`/`pharmaEssentials`)
  // must reference real catalog rows — the app resolves them via getProductsByIds; a typo'd portal
  // publish would silently fall back to the fixture instead of surfacing the error.
  const sduiProductRailIds = new Set(['martDeals', 'martEssentials', 'foodSpecials', 'pharmaPopular', 'pharmaEssentials']);
  for (const section of d.homeSdui) {
    if (!sduiProductRailIds.has(section.id)) continue;
    for (const id of section.productIds) {
      if (!catalogIds.has(id)) violations.push(`${section.id} product ${id} not in catalogIndex`);
    }
  }
  // Editorial campaigns (Home "Deals of the day" / `GET /home/campaigns`) must point at a seeded
  // store + real catalog products, or the gateway join would drop them and the drill-in would dangle.
  for (const section of d.homeSdui) {
    for (const campaign of section.campaigns ?? []) {
      if (!storeIds.has(campaign.storeId)) violations.push(`campaign ${campaign.id}: store ${campaign.storeId} not seeded`);
      if (campaign.carousel !== 1 && campaign.carousel !== 2) violations.push(`campaign ${campaign.id}: carousel ${campaign.carousel} must be 1 or 2`);
      for (const id of campaign.productIds) {
        if (!catalogIds.has(id)) violations.push(`campaign ${campaign.id}: product ${id} not in catalogIndex`);
      }
    }
  }
  // Hero house banners (Mart + Food + Pharma) must satisfy the `internal/sdui` publish bounds
  // (≤8 banners, image URL ≤512) or a seeded/published doc would be rejected at PUT time and the
  // house hero silently vanish.
  for (const section of d.homeSdui) {
    if (section.id !== 'martHero' && section.id !== 'foodHero' && section.id !== 'pharmaHero') continue;
    const banners = section.banners ?? [];
    if (banners.length > 8) violations.push(`${section.id} banners exceed the 8-banner bound`);
    for (const b of banners) {
      if (b.imageUrl && b.imageUrl.length > 512) violations.push(`${section.id} banner ${b.id}: imageUrl >512 chars`);
    }
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
  sections: buildSduiSections(),
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

cleanData();
const mediaCount = manifest ? assetRowsFromManifest(manifest).length : 0;
console.log(`seed written: ${d.catalogIndex.length} products, ${d.storeDirectory.length} stores, ${orders.length} orders, ${d.vendorReviewsTable.length} vendor reviews, ${(d.seedFavorites ?? []).length} favourites, ${menuRows.length} menu dishes, ${(d.BLOOD_DONORS ?? []).length} blood donors, ${(d.BLOOD_REQUESTS ?? []).length} blood requests, ${mediaCount} media assets${manifest ? '' : ' (no media_manifest.json yet)'}`);