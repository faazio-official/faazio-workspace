/**
 * Media plan — the shared model behind `backfill_r2.mjs` and `generate.mjs`.
 *
 * One place owns: collecting the image references out of the compiled @data fixture graph, the
 * content-addressed key/asset-id derivation (identical to `internal/media/handler.go`), the manifest
 * round-trip, and the SQL emitters for `media.assets` + the owner `*_key`/`*_asset_id` columns.
 *
 * The manifest (`seed/media_manifest.json`) is the bridge: `backfill_r2.mjs` downloads each distinct
 * URL, hashes the bytes, uploads to R2, and records `url → {key,hash,id,…}`. `generate.mjs` then reads
 * that file (when present) to emit `media.assets` rows + `image_key` links in the committed seed —
 * no network, deterministic keys. Authority: docs/architecture/db-schema.md §12.16.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { KEY_PREFIX } from './constants.mjs';

export const MANIFEST_VERSION = 1;

// media.assets columns emitted by both scripts (order matters for the insert builder).
export const ASSET_COLUMNS = [
  'id', 'owner_type', 'owner_id', 'kind', 'bucket', 'r2_key', 'mime', 'bytes',
  'width', 'height', 'hash', 'status', 'created_by',
];

const OWNER = { PRODUCT: 'PRODUCT', STORE: 'STORE', MENU: 'MENU' };

// ---------------------------------------------------------------- refs out of @data

/** Collect every product/store/menu image reference from the compiled fixture graph. */
export function collectImageRefs(d) {
  const refs = [];
  for (const e of d.catalogIndex ?? []) {
    if (e?.image) refs.push({ ownerType: OWNER.PRODUCT, ownerId: e.id, url: e.image });
  }
  for (const s of d.storeDirectory ?? []) {
    if (s?.coverImage) refs.push({ ownerType: OWNER.STORE, ownerId: s.id, url: s.coverImage });
  }
  const venueMenus = { ...(d.restaurantMenus ?? {}), ...(d.storeMenus ?? {}) };
  for (const [name, dishes] of Object.entries(venueMenus)) {
    const venue = d.findRestaurantVenueByName?.(name);
    const venueId = venue ? venue.id : slug(name);
    for (const dish of dishes ?? []) {
      if (dish?.image) refs.push({ ownerType: OWNER.MENU, ownerId: dish.id, venueId, url: dish.image });
    }
  }
  return refs;
}

// ---------------------------------------------------------------- url helpers

/** The manifest is keyed by the exact fixture URL; only the fetch request forces `fm=jpg`. */
export function manifestKey(url) {
  return url;
}

/** Force JPEG content negotiation so the downloaded bytes are a stable `image/jpeg`. */
export function fetchUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith('images.unsplash.com')) u.searchParams.set('fm', 'jpg');
    return u.toString();
  } catch {
    return url;
  }
}

/** Read `w`/`h` out of an unsplash-style URL query; null when absent. */
export function parseDims(url) {
  try {
    const u = new URL(url);
    const w = Number(u.searchParams.get('w'));
    const h = Number(u.searchParams.get('h'));
    return { width: Number.isFinite(w) && w > 0 ? w : null, height: Number.isFinite(h) && h > 0 ? h : null };
  } catch {
    return { width: null, height: null };
  }
}

// ---------------------------------------------------------------- content-addressed key/id (mirror of Go)

/** `media/{hash:2}/{hash}.{ext}` — immutable, edge-cacheable (caching-cloudflare-valkey.md §5). */
export function keyForHash(hash, ext = 'jpg') {
  return `${KEY_PREFIX}/${hash.slice(0, 2)}/${hash}.${ext}`;
}

/** Deterministic `img_<16hex>` id (same shape the gateway mints, stable across re-runs). */
export function idForHash(hash) {
  return `img_${hash.slice(0, 16)}`;
}

// ---------------------------------------------------------------- manifest

export function loadManifest(path) {
  if (!path || !existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    if (!parsed?.entries || typeof parsed.entries !== 'object') return null;
    return parsed;
  } catch (err) {
    console.error(`could not parse manifest ${path}:`, err.message);
    return null;
  }
}

export function saveManifest(path, manifest) {
  writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
}

/** The manifest entry for a fixture image URL, or null. */
export function entryFor(manifest, url) {
  return manifest?.entries?.[manifestKey(url)] ?? null;
}

// ---------------------------------------------------------------- SQL emit

/** Deduplicate manifest entries into media.assets rows (one per content hash / r2_key). */
export function assetRowsFromManifest(manifest) {
  const seen = new Map();
  for (const entry of Object.values(manifest?.entries ?? {})) {
    if (entry?.key && !seen.has(entry.key)) seen.set(entry.key, entry);
  }
  return [...seen.values()];
}

/** `insert into media.assets … on conflict (r2_key) do nothing` — idempotent (safe to re-run). */
export function assetsInsertSql(assetRows, batch = 100) {
  if (!assetRows.length) return '';
  const out = [];
  for (let i = 0; i < assetRows.length; i += batch) {
    const slice = assetRows.slice(i, i + batch);
    out.push(`insert into media.assets (${ASSET_COLUMNS.join(', ')}) values`);
    out.push(slice.map((a) => '  (' + [
      q(a.id), q(a.ownerType ?? ''), q(a.ownerId ?? ''), `'${a.kind ?? 'PUBLIC'}'::asset_kind`,
      q(a.bucket), q(a.key), q(a.mime), n(a.bytes), n(a.width), n(a.height),
      a.hash ? q(a.hash) : 'null', `'${a.status ?? 'ACTIVE'}'::asset_status`, q(a.createdBy ?? 'seed'),
    ].join(', ') + ')').join(',\n'));
    out.push('on conflict (r2_key) do nothing;');
    out.push('');
  }
  return out.join('\n');
}

/** UPDATEs that link existing owner rows to the backfilled asset (products/stores/menus). */
export function ownerLinkSql(refs, manifest) {
  const out = [];
  for (const ref of refs) {
    const entry = entryFor(manifest, ref.url);
    if (!entry?.key) continue;
    if (ref.ownerType === OWNER.PRODUCT) {
      out.push(`update catalog.products set image_key = ${q(entry.key)}, image_asset_id = ${q(entry.id)} where id = ${q(ref.ownerId)};`);
    } else if (ref.ownerType === OWNER.STORE) {
      out.push(`update directory.stores set cover_image_key = ${q(entry.key)}, cover_image_asset_id = ${q(entry.id)} where id = ${q(ref.ownerId)};`);
    } else if (ref.ownerType === OWNER.MENU) {
      out.push(`update directory.menus set image_key = ${q(entry.key)}, image_asset_id = ${q(entry.id)} where venue_id = ${q(ref.venueId)} and dish_id = ${q(ref.ownerId)};`);
    }
  }
  return out.join('\n');
}

// ---------------------------------------------------------------- local quoting helpers

const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v === null || v === undefined || v === '' ? 'null' : Number(v));
const slug = (s) => 'seed-' + String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');