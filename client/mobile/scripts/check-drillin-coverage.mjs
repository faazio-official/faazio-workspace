/**
 * Drill-in coverage guard.
 *
 * The category drill-in page (CategoryDrillInPanel) resolves each leaf taxonomy
 * category (server/supabase/seed/lib/taxonomy.mjs) to vendors by running its
 * `searchQuery` through `getVendorsWithProducts` → `matchesQuery` (per-token AND over a
 * product's name + category + desc + attributes). The taxonomy and the product
 * fixtures evolve independently, so a title can silently resolve ZERO vendors
 * and the page renders "No vendors yet" with no ad carousel.
 *
 * This script re-implements that predicate over the raw fixtures and fails
 * (exit 1) if any title resolves no vendor, or if a product id is duplicated.
 * It mirrors `src/services/categoryVendors.ts` but stays dependency-free so it
 * can run in CI without a TS toolchain.
 *
 * Run: npm run check:drillin
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TAXONOMY_CATEGORIES } from '../../../server/supabase/seed/lib/taxonomy.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..', '..', '..');
const read = (rel) => readFileSync(join(REPO_ROOT, rel), 'utf8');

const MART_PRODUCTS = read('data/mart/products.ts');
const PHARMA_PRODUCTS = read('data/pharma/products.ts');
const MART_STORES = read('data/mart/stores.ts');
const PHARMA_STORES = read('data/pharma/stores.ts');

/** Reads a field whose value is a single- or double-quoted string (escapes ok). */
function stringField(line, field) {
  const re = new RegExp(`${field}:\\s*(['"])((?:\\\\.|(?!\\1).)*)\\1`);
  const m = line.match(re);
  if (!m) return '';
  return m[2].replace(/\\(['"\\])/g, '$1');
}

/** All values inside an `attributes: { ... }` literal on one line. */
function attributeValues(line) {
  const m = line.match(/attributes:\s*\{([^}]*)\}/);
  if (!m) return '';
  const body = m[1];
  const values = [...body.matchAll(/:\s*(['"])((?:\\\\.|(?!\1).)*)\1/g)].map((x) => x[2]);
  const numbers = [...body.matchAll(/:\s*(\d+(?:\.\d+)?)/g)].map((x) => x[1]);
  return [...values, ...numbers].join(' ');
}

/** One product's searchable text, lowercased (mirrors productSearchableText). */
function searchText(p) {
  return [p.name, p.category, p.desc, p.attributes].join(' ').toLowerCase();
}

const words = (q) => q.trim().toLowerCase().split(/\s+/).filter(Boolean);
const matchesQuery = (p, q) => words(q).every((w) => searchText(p).includes(w));

// --- Build the drill-in taxonomy from the superadmin seed data --------------
// `TAXONOMY_CATEGORIES` is the single source of truth (server/supabase/seed/lib/taxonomy.mjs,
// embedded by migration 0067 and the seed generator). Only leaf rows carry a `searchQuery` — the
// drill-in routes a leaf to vendors by that query. FOOD has no consumer product pool, so it is
// skipped (Food categories back restaurant onboarding, not the Mart/Pharma drill-in).
const APP_POOL = { MART: 'FA_MART', PHARMA: 'PHARMA' };

const childrenOf = new Set(TAXONOMY_CATEGORIES.map((c) => c.parentId).filter(Boolean));
const tabs = TAXONOMY_CATEGORIES.filter((c) => APP_POOL[c.app])
  .filter((c) => c.searchQuery && !childrenOf.has(c.id))
  .map((leaf) => ({
    id: leaf.id,
    title: leaf.name,
    app: APP_POOL[leaf.app],
    items: [{ id: leaf.id, name: leaf.name, query: leaf.searchQuery, app: APP_POOL[leaf.app] }],
  }));

// --- Parse store ids ---------------------------------------------------------
const storeIds = new Set(
  [...(MART_STORES + PHARMA_STORES).matchAll(/id:\s*'(store-[^']+)'/g)].map((m) => m[1]),
);

// --- Parse Mart products -----------------------------------------------------
const martProducts = [];
for (const line of MART_PRODUCTS.split('\n')) {
  if (!line.includes("id: '") || !line.includes('category: ')) continue;
  const id = stringField(line, 'id');
  if (!id) continue;
  martProducts.push({
    id,
    name: stringField(line, 'name'),
    category: stringField(line, 'category'),
    desc: stringField(line, 'desc'),
    attributes: attributeValues(line),
    storeId: stringField(line, 'storeId'),
  });
}

// --- Parse Pharma products (DB rows + derived attributes + store mapping) ----
const deriveForm = (name) => {
  if (/gumm/i.test(name)) return 'Gummies';
  if (/caps/i.test(name)) return 'Capsule';
  if (/tab|tablet/i.test(name)) return 'Tablet';
  if (/syrup/i.test(name)) return 'Syrup';
  if (/inhaler/i.test(name)) return 'Inhaler';
  if (/cream/i.test(name)) return 'Cream';
  if (/lozenge/i.test(name)) return 'Lozenge';
  if (/sachet|salt/i.test(name)) return 'Powder';
  if (/protein/i.test(name)) return 'Powder';
  if (/vaccine/i.test(name)) return 'Injection';
  return 'Other';
};
const PRESCRIPTION_CATEGORIES = ['hypertension', 'asthma', 'fever'];

const storeByCategory = {};
const mapBlock = PHARMA_PRODUCTS.match(/const STORE_BY_CATEGORY[^{]*\{([^}]*)\}/);
if (mapBlock) {
  for (const m of mapBlock[1].matchAll(/(?:'([^']+)'|([A-Za-z-]+))\s*:\s*'([^']+)'/g)) {
    storeByCategory[m[1] ?? m[2]] = m[3];
  }
}

const pharmaProducts = [];
for (const line of PHARMA_PRODUCTS.split('\n')) {
  if (!line.includes("id: 'ph-")) continue;
  const id = stringField(line, 'id');
  const name = stringField(line, 'name');
  const category = stringField(line, 'category');
  if (!id || !name) continue;
  const form = deriveForm(name);
  const prescription = PRESCRIPTION_CATEGORIES.includes(category) ? 'Prescription' : 'OTC';
  pharmaProducts.push({
    id,
    name,
    category,
    desc: stringField(line, 'desc'),
    attributes: `${form} ${prescription} Faazio Health`,
    storeId: storeByCategory[category] ?? 'store-p1',
  });
}

// --- Evaluate every title ----------------------------------------------------
const pools = { FA_MART: martProducts, PHARMA: pharmaProducts };
const errors = [];

const allIds = [...martProducts, ...pharmaProducts].map((p) => p.id);
const seen = new Set();
for (const id of allIds) {
  if (seen.has(id)) errors.push(`duplicate product id: ${id}`);
  seen.add(id);
}

let titleCount = 0;
let emptyCount = 0;
for (const tab of tabs) {
  for (const item of tab.items) {
    titleCount += 1;
    const pool = pools[item.app];
    const matched = pool.filter((p) => matchesQuery(p, item.query));
    const vendors = new Set(
      matched.filter((p) => p.storeId && storeIds.has(p.storeId)).map((p) => p.storeId),
    );
    if (vendors.size === 0) {
      emptyCount += 1;
      const missing = words(item.query).filter(
        (w) => !pool.some((p) => searchText(p).includes(w)),
      );
      const detail = missing.length ? ` [missing tokens: ${missing.join(', ')}]` : '';
      errors.push(
        `${item.app} ${tab.id} "${item.name}" [${item.query}] resolves 0 vendors${detail}`,
      );
    }
  }
}

const label = `Drill-in coverage: ${titleCount} titles, ${emptyCount} unresolved`;
if (errors.length) {
  console.error(`✗ ${label}`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `✓ ${label} — every taxonomy category searchQuery resolves ≥1 vendor ` +
    `(mart=${martProducts.length}, pharma=${pharmaProducts.length} products)`,
);
