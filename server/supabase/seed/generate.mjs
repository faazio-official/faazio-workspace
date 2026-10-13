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
  ['id', 'name'],
  d.diningVenues.filter((v) => !storeIds.has(v.id)).map((v) => [q(v.id), q(v.name)]),
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
  d.usersTable.map((u) => [q(u.id), q(u.name), q(u.email), q(u.phone), q(u.defaultAddressId)]),
));
sql.push(inserts(
  'checkout.addresses',
  ['address_id', 'user_id', 'label', 'name', 'phone', 'address', 'is_default'],
  d.addressesTable.map((a) => [q(a.id), q(a.userId), q(a.label ?? a.tag ?? ''), q(a.name), q(a.phone), q(a.address), a.isDefault ? 'true' : 'false']),
));
sql.push(inserts(
  'checkout.coupons',
  ['code', 'discount_percent', 'label', 'min_order_paisa', 'is_free_delivery'],
  d.couponsTable.map((c) => [q(c.code), n(c.discountPercent), q(c.label), paisa(c.minOrder), c.isFreeDelivery ? 'true' : 'false']),
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

sql.push('commit;');
sql.push('');

writeFileSync(join(here, '0001_seed.sql'), sql.join('\n'));

// ---------------------------------------------------------------- Mongo seed
const sduiDoc = {
  _id: 'home',
  version: 1,
  locale: 'en',
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

// mongosh init script (docker-compose / Atlas): upsert the layout + TTL index.
writeFileSync(join(mongoDir, 'seed.js'), [
  '// Faazio Mongo seed — generated. Upserts the ID-only Home layout and TTL index.',
  'db = db.getSiblingDB(process.env.MONGO_DATABASE || "faazio");',
  'db.sdui_layouts.replaceOne({ _id: "home" }, ' + JSON.stringify(sduiDoc) + ', { upsert: true });',
  'db.user_events.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "user_events_ttl" });',
  'print("mongo seed: sdui_layouts=home version=" + ' + JSON.stringify(sduiDoc.version) + ');',
  '',
].join('\n'));

rmSync(buildDir, { recursive: true, force: true });
console.log(`seed written: ${d.catalogIndex.length} products, ${d.storeDirectory.length} stores, ${orders.length} orders, ${d.vendorReviewsTable.length} vendor reviews`);