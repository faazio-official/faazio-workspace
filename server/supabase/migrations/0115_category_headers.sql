-- Faazio MVP — category header labels: a category can be shared into more than one curated header
-- list while keeping `taxonomy.categories.app` as its single primary classification.
-- Authority: docs/architecture/db-schema.md §12.30, monolith-breakdown.md §1 (categories row),
-- server-gateway-plan.md (central category taxonomy),
-- user-interaction-workflow/seller/web-portal/super-admin-categories.md.
--
-- Why: `app` is one enum per row, so a Mart or Pharma category could only ever appear in its own app
-- list. The superadmin portal now renders separate curated lists per header (Main App Header, Mart,
-- Food, Pharma) and Mart/Pharma categories can additionally be shared into the Main App Header list.
-- Adding a 5th header later must not need a migration, so the labels live in a normalized join table
-- rather than boolean columns.
--
-- Contract:
--   * `header` is one of MAIN_APP_HEADER | MART | FOOD | PHARMA.
--   * The primary app of the category is always present as its own label (backfilled below and kept
--     in sync by the gateway on create/update).
--   * MAIN_APP_HEADER is the shared main-app header list; FOOD is not eligible (guard trigger).
--   * `taxonomy.categories.show_on_home_rail` is retained as the legacy rail flag and is kept equal
--     to "has the MAIN_APP_HEADER label" by the gateway write path.
--
-- Additive and idempotent; apply from a dev terminal via server/supabase/apply-migration.sh per
-- docs/RUNBOOKS/DATABASE_MIGRATIONS.md. Never auto-run on Render.

begin;

create table if not exists taxonomy.category_headers (
  category_id text not null references taxonomy.categories (id) on delete cascade,
  header      text not null,
  created_at  timestamptz not null default now(),
  constraint category_headers_pkey primary key (category_id, header),
  constraint category_headers_header_check
    check (header in ('MAIN_APP_HEADER', 'MART', 'FOOD', 'PHARMA'))
);

create index if not exists category_headers_header_idx
  on taxonomy.category_headers (header, category_id);

comment on table taxonomy.category_headers is
  'Many-to-many category → curated header labels (MAIN_APP_HEADER | MART | FOOD | PHARMA). One canonical taxonomy.categories row can be shared into several lists; app stays the primary classification.';
comment on column taxonomy.category_headers.header is
  'Curated header list. MAIN_APP_HEADER is the shared main app header (Mart + Pharma only); MART/FOOD/PHARMA mirror taxonomy.categories.app.';
comment on column taxonomy.category_headers.category_id is
  'taxonomy.categories.id. ON DELETE CASCADE: removing a category removes its labels.';

-- Guard: FOOD has no consumer vendor pool, so it can never be shared into the main app header.
create or replace function taxonomy.reject_food_main_header() returns trigger
language plpgsql
as $$
begin
  if new.header = 'MAIN_APP_HEADER'
     and exists (
       select 1 from taxonomy.categories c
        where c.id = new.category_id and c.app = 'FOOD'::app_brand
     ) then
    raise exception 'FOOD categories cannot be tagged MAIN_APP_HEADER'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists category_headers_food_guard on taxonomy.category_headers;
create trigger category_headers_food_guard
  before insert or update on taxonomy.category_headers
  for each row execute function taxonomy.reject_food_main_header();

-- Backfill 1 — every row gets its primary app as a label, so `?header=MART` and the app tabs read
-- the same table as the Main App Header list.
insert into taxonomy.category_headers (category_id, header)
select id, app::text
  from taxonomy.categories
on conflict (category_id, header) do nothing;

-- Backfill 2 — existing curated rail chips become MAIN_APP_HEADER labels (zero visible change for
-- the mobile rail; FOOD is skipped defensively).
insert into taxonomy.category_headers (category_id, header)
select id, 'MAIN_APP_HEADER'
  from taxonomy.categories
 where show_on_home_rail
   and app <> 'FOOD'::app_brand
on conflict (category_id, header) do nothing;

-- RLS (Supabase only): the gateway (service_role) is the only writer; anon/authenticated may read
-- labels of active categories only (mirrors the 0067 categories_public_read policy, so a deactivated
-- category's labels are not exposed).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'auth')
     and exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select on taxonomy.category_headers to anon, authenticated;
    alter table taxonomy.category_headers enable row level security;
    drop policy if exists category_headers_public_read on taxonomy.category_headers;
    create policy category_headers_public_read on taxonomy.category_headers
      for select to anon, authenticated
      using (exists (
        select 1 from taxonomy.categories c
         where c.id = category_id and c.is_active
      ));
  end if;
end $$;

commit;
