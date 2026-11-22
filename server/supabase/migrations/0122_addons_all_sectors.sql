-- Faazio — add-ons become a catalogue capability for every sector, not just Food.
--
-- Why: 0099 introduced `directory.addons` + `directory.menu_addon_links` for dishes only. A Mart or
-- Pharmacy listing ("Extra gift wrap", "Cold-chain pack", "Home sample collection") had no way to
-- carry paid extras, and the gateway hard-blocked every non-FOOD write with `st.app = 'FOOD'`. This
-- migration adds the missing product binding and the moderation states the portal needs, so one
-- add-on catalogue serves MART, FOOD and PHARMA:
--
--   * directory.product_addon_links — add-ons bound to a `catalog.products` row (Mart/Pharmacy, and
--     a Food shop that sells packaged SKUs through Products rather than dishes).
--   * product_status gains CHANGES_REQUESTED — an admin "request an update" state distinct from a
--     hard REJECTED, so the seller is told to edit and resubmit rather than start over.
--   * directory.menus.review_reason — a rejected dish could not carry an explanation (only
--     catalog.products and directory.addons had the column).
--   * directory.addons.sector_app — the sector the add-on was authored for, denormalised from the
--     owning store so a read can filter without a join and a link cannot cross sectors silently.
--
-- Idempotent and additive. Apply from a dev terminal per docs/RUNBOOKS/DATABASE_MIGRATIONS.md.

-- ---------------------------------------------------------------- product_status: CHANGES_REQUESTED
-- `alter type ... add value` cannot run inside a transaction block on older Postgres, and the
-- migrator applies statement-by-statement, so a duplicate-value error is the only risk and is
-- guarded by the DO block.
do $$
begin
  if not exists (
    select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'product_status' and e.enumlabel = 'CHANGES_REQUESTED'
  ) then
    alter type product_status add value 'CHANGES_REQUESTED';
  end if;
end;
$$;

-- ---------------------------------------------------------------- directory.addons: sector column
-- Denormalised owning sector. Existing rows are backfilled from their venue store; a FOOD-owned
-- row stays FOOD, and the column lets a read filter by sector without re-joining stores.
alter table directory.addons
  add column if not exists sector_app text;

update directory.addons a
   set sector_app = st.app::text
  from directory.stores st
 where st.id = a.venue_id
   and a.sector_app is null;

-- A dining venue (no directory.stores row) is Food by definition; leave those as FOOD rather than
-- null so the column is meaningful for every row.
update directory.addons
   set sector_app = 'FOOD'
 where sector_app is null;

alter table directory.addons
  alter column sector_app set default 'FOOD';
alter table directory.addons
  alter column sector_app set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'addons_sector_app_check'
  ) then
    alter table directory.addons
      add constraint addons_sector_app_check
      check (sector_app in ('MART','FOOD','PHARMA'));
  end if;
end;
$$;

create index if not exists addons_venue_sector_idx on directory.addons (venue_id, sector_app);

-- ---------------------------------------------------------------- directory.product_addon_links
-- Binds an add-on to a catalog.products row. Mirrors menu_addon_links: `venue_id` is the store id
-- (kept so the scope/ownership predicate is one join), `product_id` is the catalog row. `addon_id`
-- is the only FK; product/venue ids are validated by the gateway inside the write statement so the
-- sector/ownership check stays atomic.
create table if not exists directory.product_addon_links (
  venue_id   text not null,
  product_id text not null,
  addon_id   text not null references directory.addons (addon_id) on delete cascade,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (venue_id, product_id, addon_id)
);

create index if not exists product_addon_links_addon_idx on directory.product_addon_links (addon_id);
create index if not exists product_addon_links_venue_product_idx on directory.product_addon_links (venue_id, product_id);
create index if not exists product_addon_links_product_idx on directory.product_addon_links (product_id);

-- ---------------------------------------------------------------- directory.menus.review_reason
-- A rejected dish could not explain why. Same shape and cap as catalog.products.review_reason.
alter table directory.menus
  add column if not exists review_reason text
  check (review_reason is null or octet_length(review_reason) <= 500);

-- ---------------------------------------------------------------- RLS (Supabase only)
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    raise notice 'auth schema absent — skipping product_addon_links RLS (non-Supabase environment)';
    return;
  end if;
  execute 'alter table directory.product_addon_links enable row level security';
  -- The gateway filters status/sector; the anon policy only mirrors the existing add-on read so a
  -- direct Supabase client sees the same link rows the public endpoint would.
  execute 'create policy anon_read on directory.product_addon_links for select to anon, authenticated using (true)';
end;
$$;
