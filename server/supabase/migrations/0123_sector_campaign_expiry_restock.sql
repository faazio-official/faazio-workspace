-- Faazio MVP — three sector-correctness gaps closed in one additive migration.
-- Authority: docs/architecture/db-schema.md, monolith-breakdown.md §1 (promo/directory/inventory
-- rows), docs/user-interaction-workflow/seller/catalog/{inventory,offers}.md,
-- docs/user-interaction-workflow/KNOWN_GAPS.md.
--
-- Why, one block per gap:
--
--   1. promo.festival_campaigns.sector — a campaign had no vertical. `scope` (GLOBAL/STATE) only
--      says which geography it covers, so a "Diwali" campaign could be opted into by a Mart product
--      and a Pharmacy product alike, and the seller console had to filter client-side. A nullable
--      `sector` mirrors promo.coupons.sector: NULL = every vertical, a value = that vertical only.
--      The gateway now rejects an opt-in whose product app differs from the campaign sector.
--
--   2. inventory.stock.batch_no / expiry_date — regulated and perishable stock carried no lot or
--      expiry, so the console could only paint a read-only "Rx" badge and an expired carton stayed
--      sellable forever. Both columns are nullable (a non-perishable SKU has neither); every public
--      read and the checkout decrement treat a past expiry as unavailable.
--
--   3. directory.stores.restock_qty / restock_eta_minutes — the console hardcoded RESTOCK_QTY=10 /
--      RESTOCK_ETA=30 for every shop. A pharmacy restocking a strip and a mart restocking a sack do
--      not share a unit count, so the default moves onto the store row and the console reads it.
--
-- Additive and idempotent; apply from a dev terminal via server/supabase/apply-migration.sh per
-- docs/RUNBOOKS/DATABASE_MIGRATIONS.md. Never auto-run on Render.

-- ---------------------------------------------------------------- 1. campaign sector
alter table promo.festival_campaigns
  add column if not exists sector app_brand;

create index if not exists festival_campaigns_sector_idx
  on promo.festival_campaigns (sector, status, starts_at desc);

-- ---------------------------------------------------------------- 2. batch + expiry on stock
alter table inventory.stock
  add column if not exists batch_no text
  check (batch_no is null or octet_length(batch_no) <= 40);

alter table inventory.stock
  add column if not exists expiry_date date;

-- Partial index: only rows that actually expire can be swept/reported, so the index stays small.
create index if not exists stock_expiry_idx
  on inventory.stock (expiry_date)
  where expiry_date is not null;

-- ---------------------------------------------------------------- 3. per-shop restock defaults
alter table directory.stores
  add column if not exists restock_qty int not null default 10
  check (restock_qty between 1 and 100000);

alter table directory.stores
  add column if not exists restock_eta_minutes int not null default 30
  check (restock_eta_minutes between 0 and 600);
