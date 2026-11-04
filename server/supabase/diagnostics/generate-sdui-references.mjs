#!/usr/bin/env node
// Faazio SDUI referential drift guardrail — generator.
//
// Reads the SDUI home layout source (server/supabase/seed/mongo/sdui_layouts.json), collects every
// storeId / productId it references, and regenerates verify-sdui-references.sql so the read-only
// drift check always mirrors the layout source of truth. Zero dependencies (node stdlib only).
//
//   node server/supabase/diagnostics/generate-sdui-references.mjs
//
// Run it whenever sdui_layouts.json (or seed/mongo/seed.js) changes, and before a deploy so a
// section that points at a missing Postgres row surfaces at review time, not on a live phone.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const layoutPath = resolve(here, "../seed/mongo/sdui_layouts.json");
const outPath = resolve(here, "verify-sdui-references.sql");

// Banner/section/campaign/chip ids (hb-1, martHero, ...) are layout ids, never product/store refs.
const IMPORTANT_KEYS = new Set(["storeIds", "storeId", "productIds", "productId"]);

function collect(node, storeIds, productIds) {
  if (Array.isArray(node)) {
    for (const item of node) collect(item, storeIds, productIds);
    return;
  }
  if (node !== null && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (IMPORTANT_KEYS.has(key)) {
        const ids = Array.isArray(value) ? value : [value];
        for (const id of ids) {
          if (typeof id !== "string" || id.length === 0) continue;
          if (key === "storeIds" || key === "storeId") storeIds.add(id);
          else productIds.add(id);
        }
      } else {
        collect(value, storeIds, productIds);
      }
    }
  }
}

const layout = JSON.parse(readFileSync(layoutPath, "utf8"));
const storeIds = new Set();
const productIds = new Set();
collect(layout, storeIds, productIds);
if (storeIds.size === 0 && productIds.size === 0) {
  console.error(`generate-sdui-references: no store/product references found in ${layoutPath}`);
  process.exit(1);
}

const esc = (s) => s.replace(/'/g, "''");
const rows = [
  ...[...storeIds].sort().map((id) => `    ('${esc(id)}', NULL) /* store */`),
  ...[...productIds].sort().map((id) => `    (NULL, '${esc(id)}') /* product */`),
];

const sql = `-- Read-only diagnostic — NOT a migration. Do not place SELECT-only checks under migrations/.
--
-- SDUI referential drift guardrail. Every storeId/productId the SDUI home layout
-- (Mongo sdui_layouts.home; source server/supabase/seed/mongo/sdui_layouts.json) references must
-- exist in Postgres directory.vendors (stores + dining venues) / catalog.products. A referenced id
-- with no Postgres row renders its SDUI section empty, so this check surfaces that before deploy.
--
-- server/gateway/cmd/migrate discards query result rows (PgConn().Exec().ReadAll()), so running this
-- through server/supabase/apply-migration.sh prints no output. Run it in the Supabase SQL Editor (or
-- any pgx/psql client) instead. See docs/RUNBOOKS/DATABASE_MIGRATIONS.md §5.
--
-- Regenerate when sdui_layouts.json changes:
--   node server/supabase/diagnostics/generate-sdui-references.mjs

-- 1. Referenced ids from the layout (regen: ${layout._id} v${layout.version}, ${new Date().toISOString()}).
with referenced(store_id, product_id) as (
  select store_id, product_id from (values
${rows.join(",\n")}
  ) as v(store_id, product_id)
  where store_id is not null or product_id is not null
),
-- 2. Postgres side (the vendor identity set = directory.stores ∪ directory.dining_venues; the menu
--    items food rails point at are catalog.products rows, so that is the only product table to check).
missing_stores as (
  select r.store_id
    from referenced r
   where r.store_id is not null
     and not exists (select 1 from directory.vendors d where d.id = r.store_id)
),
missing_products as (
  select r.product_id
    from referenced r
   where r.product_id is not null
     and not exists (select 1 from catalog.products c where c.id = r.product_id)
)
-- 3. Drift. Empty result = clean. Non-empty = SDUI sections that will render empty.
select 'store'   as ref_type, store_id as ref_id from missing_stores
union all
select 'product' as ref_type, product_id as ref_id from missing_products
order by ref_type, ref_id;
`;

writeFileSync(outPath, sql);
const total = storeIds.size + productIds.size;
console.log(
  `verify-sdui-references.sql regenerated: ${storeIds.size} storeIds + ${productIds.size} productIds = ${total} references`,
);