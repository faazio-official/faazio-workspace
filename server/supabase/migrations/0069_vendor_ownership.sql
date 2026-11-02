-- Faazio MVP — the vendor (directory.stores) becomes a first-class owned object.
-- Authority: docs/architecture/db-schema.md §directory, docs/architecture/monolith-breakdown.md §1.
--
-- Why: directory.stores is the VENDOR (the real shop/restaurant/pharmacy). It must carry everything
-- that is true of that shop rather than of the account: app brand (already there), platform fee,
-- taxonomy category and FSSAI. It must also be owned by exactly one seller account.
--
-- Today (0015:75) `seller_id` is a bare nullable text column with no FK and no NOT NULL, so a store
-- can exist with no owner and nothing stops a dangling id. This migration makes ownership real.
--
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------- per-vendor commercial fields
-- Platform fee is per shop (a 12% Mart electronics shop and a 6% Food kitchen are different deals).
alter table directory.stores
  add column if not exists platform_fee_pct smallint not null default 10
    check (platform_fee_pct between 1 and 100);

-- Taxonomy category for the vendor (e.g. a Food restaurant type). Was on the account (0067:50).
alter table directory.stores
  add column if not exists seller_category_id text references taxonomy.categories (id);

-- FSSAI is a FOOD-shop licence, not a company licence.
alter table directory.stores add column if not exists fssai_number       text not null default '';
alter table directory.stores add column if not exists fssai_cert_key     text not null default '';
alter table directory.stores add column if not exists fssai_cert_asset_id text not null default '';

create index if not exists stores_category_id_idx on directory.stores (seller_category_id);

-- ---------------------------------------------------------------- ownership is real
-- Backfill any pre-existing owner links before the FK/NOT NULL land. The authoritative backfill of
-- currently-unowned stores is 0071; this only guards rows that already carry an id.
update directory.stores d
   set seller_id = null
 where d.seller_id is not null
   and not exists (select 1 from sellers.sellers s where s.seller_id = d.seller_id);

-- FK: a store cannot outlive its owner, and a seller with stores cannot be deleted out from under
-- them (RESTRICT — deleting an account with live vendors must be an explicit, deliberate act).
do $$ begin
  alter table directory.stores
    add constraint stores_seller_fk
    foreign key (seller_id) references sellers.sellers (seller_id) on delete restrict;
exception when duplicate_object then null; end $$;

-- NOT NULL is applied in 0071 after the live backfill, so this migration can run on a database
-- that still has unowned stores.
