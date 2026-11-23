#!/usr/bin/env node
/**
 * gen-district-migration.mjs — turn the verified seed artefact into a SQL migration.
 *
 * Input:  scripts/district-seed.json (produced by gen-district-seed.mjs)
 * Output: server/supabase/migrations/0127_india_districts_place_id.sql
 *
 * CODE PRESERVATION
 * -----------------
 * The 42 rows seeded by 0046 (Tamil Nadu 38 + Puducherry 4) already have 3-character codes
 * (TCH, PY0 …) referenced by sellers, district admins, portal users and delivery payouts. Those
 * codes are NEVER regenerated: the migration upserts on district_code, so the existing rows keep
 * their identity and only gain the new google_place_id column.
 *
 * Every NEW district gets a generated code `${STATE}${NN}` (e.g. UP01 … UP75), which fits the
 * widened CHECK `^[A-Z]{2}[A-Z0-9]{1,3}$`.
 *
 * USAGE
 *   node scripts/gen-district-migration.mjs [--in scripts/district-seed.json]
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const inIdx = process.argv.indexOf("--in");
const inPath = inIdx > -1 ? process.argv[inIdx + 1] : path.join(root, "scripts", "district-seed.json");
const outPath = path.join(root, "server", "supabase", "migrations", "0127_india_districts_place_id.sql");

/** The 42 codes shipped by 0046 — frozen identities, matched to roster names. */
const LEGACY = {
  Ariyalur: "TNA", Chengalpattu: "TNC", Chennai: "TCH", Coimbatore: "TCO", Cuddalore: "TCD",
  Dharmapuri: "TDP", Dindigul: "TDG", Erode: "TER", Kallakurichi: "TKL", Kanchipuram: "TKP",
  Kanyakumari: "TKK", Karur: "TKR", Krishnagiri: "TKG", Madurai: "TMD", Mayiladuthurai: "TMY",
  Nagapattinam: "TNP", Namakkal: "TNK", Nilgiris: "TNG", Perambalur: "TPE", Pudukkottai: "TPK",
  Ramanathapuram: "TRT", Ranipet: "TRN", Salem: "TSL", Sivaganga: "TSK", Tenkasi: "TTK",
  Thanjavur: "TTH", Theni: "TTE", Thoothukudi: "TTT", Tiruchirappalli: "TTC",
  Tirunelveli: "TTL", Tirupathur: "TTP", Tiruppur: "TPP", Tiruvallur: "TLV",
  Tiruvannamalai: "TVA", Tiruvarur: "TVR", Vellore: "VEL", Villupuram: "VLP",
  Virudhunagar: "VIR",
  Puducherry: "PY0", Karaikal: "PY1", "Mahé": "PY2", Yanam: "PY3",
};

const seed = JSON.parse(readFileSync(inPath, "utf8"));
if (!seed.rows?.length) {
  console.error("seed artefact has no rows");
  process.exit(1);
}

/** SQL single-quote escaping. */
function q(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

const rows = [...seed.rows];

// Assign codes: legacy first, then generated per state in name order.
for (const r of rows) {
  if (r.stateCode === "TN" || r.stateCode === "PY") {
    const legacy = LEGACY[r.name];
    if (!legacy) {
      console.error(`TN/PY district without a frozen legacy code: ${r.name}`);
      process.exit(1);
    }
    r.districtCode = legacy;
  }
}

// Generated codes must not collide with a legacy code or another generated one. Legacy codes are
// 3 chars and generated are 4, so the only real risk is a state whose generated prefix collides —
// impossible because states are distinct 2-letter ISO codes.
const byState = {};
for (const r of rows) {
  if (r.districtCode) continue;
  (byState[r.stateCode] ??= []).push(r);
}
for (const [stateCode, list] of Object.entries(byState)) {
  list.sort((a, b) => a.name.localeCompare(b.name));
  list.forEach((r, i) => {
    const n = String(i + 1).padStart(2, "0");
    r.districtCode = `${stateCode}${n}`;
  });
}

// Guard: unique codes and unique place_ids (a duplicate place_id would make the unique index fail).
const seenCode = new Set();
const seenPid = new Set();
for (const r of rows) {
  if (seenCode.has(r.districtCode)) {
    console.error(`duplicate district_code ${r.districtCode}`);
    process.exit(1);
  }
  seenCode.add(r.districtCode);
  if (!r.placeId || seenPid.has(r.placeId)) {
    console.error(`missing/duplicate place_id for ${r.stateCode}/${r.name}: ${r.placeId}`);
    process.exit(1);
  }
  seenPid.add(r.placeId);
}

// Active-only-in-TN/PY: the platform's live coverage stays what it is today. Every other district is
// seeded INACTIVE so it exists (with its place_id) but is hidden from pickers until an operator
// enables that state. This keeps the change additive and does not silently open all-India coverage.
const isLive = (r) => r.stateCode === "TN" || r.stateCode === "PY";

const values = rows
  .sort((a, b) => {
    // stable, readable order: live states first, then by state, then name
    const la = isLive(a) ? 0 : 1;
    const lb = isLive(b) ? 0 : 1;
    if (la !== lb) return la - lb;
    if (a.stateCode !== b.stateCode) return a.stateCode.localeCompare(b.stateCode);
    return a.name.localeCompare(b.name);
  })
  .map((r) =>
    `  (${q(r.districtCode)}, ${q(r.name)}, ${q(r.stateCode)}, ${q(r.placeId)}, ${isLive(r) ? "true" : "false"})`,
  )
  .join(",\n");

const liveCount = rows.filter(isLive).length;
const total = rows.length;

const sql = `-- Faazio — all-India district master with Google place_id identity.
-- Authority: docs/architecture/db-schema.md §12, docs/architecture/monolith-breakdown.md §1 (districts),
--            docs/user-interaction-workflow/seller/onboarding/seller-web-intake.md.
--
-- WHY
-- The district master shipped by 0046 was a 42-row MVP (Tamil Nadu 38 + Puducherry 4) resolved by
-- matching a free-text district NAME. Names drift and vary ("Bengaluru" vs "Bangalore", "Trichy" vs
-- "Tiruchirappalli", "Mahé" vs "Mahe"), so a reverse-geocoded label cannot reliably identify a row.
-- This migration attaches the durable identifier instead: the Google place_id of each district's
-- administrative_area_level_3 component, which is exactly what a reverse geocode returns for a point
-- inside that district. Resolution then becomes an exact \`WHERE google_place_id = $1\`.
--
-- NOTE ON GOOGLE'S INDIA LEVELS (this is the trap the old code fell into):
--   administrative_area_level_1 = state / UT
--   administrative_area_level_2 = DIVISION ("Bangalore Division")  <- NOT the district
--   administrative_area_level_3 = DISTRICT ("Bengaluru Urban")     <- what coverage is keyed on
-- The landing page previously read level_2 first, which sent division names ("Mandi Division") as
-- the district. The client now reads level_3 and this seed is keyed on level_3 place_ids.
--
-- SCOPE
--   1. Widen district_code from 2 letters + 1 char (36 slots/state) to 2 letters + 1–3 chars, so
--      states with more than 36 districts fit (Uttar Pradesh 75, Madhya Pradesh 55, Bihar 38).
--      Existing 3-char codes are unchanged; only the constraint is relaxed.
--   2. Add google_place_id (nullable, unique when present).
--   3. Seed ALL ${total} districts of all 36 states/UTs. The 42 legacy rows keep their exact
--      district_code (upsert on the primary key) and simply gain their place_id.
--   4. Only Tamil Nadu and Puducherry are seeded is_active = true — the platform's live coverage is
--      unchanged. Every other state's districts are seeded is_active = false, so they exist and can
--      be enabled per state by an operator without a code ship; they do NOT silently appear in
--      seller pickers or district filters.
--
-- Source of truth for the place_ids: scripts/gen-district-seed.mjs (forward lookup, verified by a
-- reverse round-trip at the district centroid; the reverse id wins because that is the id a real
-- visitor's location yields). Regenerate with:
--   GOOGLE_GEOCODING_API_KEY=... node scripts/gen-district-seed.mjs
--   node scripts/gen-district-migration.mjs
--
-- Idempotent: safe to re-run. Additive: no existing column is dropped or retyped.

-- ---------------------------------------------------------------- 1. widen district_code
-- 0046/0048 enforced ^[A-Z]{2}[A-Z0-9]$ (state + exactly one char). That caps a state at 36 districts,
-- which Uttar Pradesh (75) and Madhya Pradesh (55) exceed. Relax to 1–3 trailing chars: TCH and PY0
-- stay valid untouched, and UP01…UP75 fit.
alter table admins.district_master
  drop constraint if exists district_master_district_code_check;
alter table admins.district_master
  add constraint district_master_district_code_check
  check (district_code ~ '^[A-Z]{2}[A-Z0-9]{1,3}$');

alter table admins.portal_users
  drop constraint if exists portal_users_district_code_check;
alter table admins.portal_users
  add constraint portal_users_district_code_check
  check (district_code is null or district_code ~ '^[A-Z]{2}[A-Z0-9]{1,3}$');

-- ---------------------------------------------------------------- 2. google_place_id
alter table admins.district_master
  add column if not exists google_place_id text;

-- One district per place_id. Partial so the column can be NULL (a district Google cannot resolve
-- keeps name matching as its fallback rather than blocking the row).
create unique index if not exists district_master_google_place_id_key
  on admins.district_master (google_place_id)
  where google_place_id is not null;

comment on column admins.district_master.google_place_id is
  'Google Geocoding place_id for the district''s administrative_area_level_3 component. Durable identity: reverse-geocoding any point in the district returns this id. NULL when Google cannot resolve the district (the gateway then falls back to name matching).';

-- ---------------------------------------------------------------- 3. seed all districts
-- ON CONFLICT (district_code): the 42 legacy rows keep their code and only take the new place_id.
-- is_active is NOT overwritten on conflict: a district an operator has since enabled must stay
-- enabled when this file is re-applied. New rows take their seeded is_active (true for TN/PY, false
-- everywhere else) from the VALUES list.
insert into admins.district_master
  (district_code, district_name, state_code, google_place_id, is_active)
values
${values}
on conflict (district_code) do update
  set district_name   = excluded.district_name,
      state_code      = excluded.state_code,
      google_place_id = excluded.google_place_id;

-- ---------------------------------------------------------------- 4. guard
-- Every row must carry a place_id (the generator refuses to emit one without); fail loudly rather
-- than shipping a half-seeded master.
do $$
declare missing int;
begin
  select count(*) into missing
    from admins.district_master
   where google_place_id is null;
  if missing > 0 then
    raise exception 'district_master has % row(s) without google_place_id', missing;
  end if;
end;
$$;

-- Live coverage is unchanged: Tamil Nadu + Puducherry only.
comment on table admins.district_master is
  'District master (single source of truth). ${total} districts across 36 states/UTs; live coverage is Tamil Nadu + Puducherry (is_active = true), the rest are seeded inactive until an operator enables a state. Keyed on google_place_id for location resolution.';
`;

writeFileSync(outPath, sql);
console.log(`Wrote ${outPath}`);
console.log(`  rows: ${total} (${liveCount} active: TN + PY)`);
console.log(`  legacy codes preserved: ${rows.filter((r) => r.districtCode.length === 3).length}`);
