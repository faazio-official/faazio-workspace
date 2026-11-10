-- Faazio — dish add-ons (extras) with the same DRAFT → PENDING_REVIEW → ACTIVE moderation lifecycle
-- as menu products.
--
-- Why: `directory.menus` rows had no way to order paid extras ("Extra Cheese", "Extra Gravy").
-- Add-ons are venue-scoped catalogue entities, linked many-to-many to dishes, and snapshotted onto
-- placed orders so an order never changes when the catalogue does.
--
-- Lifecycle (mirrors menu/products):
--   seller creates  -> DRAFT (seller-only)
--   seller submits  -> PENDING_REVIEW (admin queue)
--   admin approves  -> ACTIVE (customer-visible)
--   admin rejects   -> DRAFT + review_reason (seller fixes and resubmits)
--   seller delists  -> DELISTED
--
-- Additive and idempotent; safe to apply after the gateway build ships. Apply from a dev terminal
-- per docs/RUNBOOKS/DATABASE_MIGRATIONS.md; never auto-run on Render.

-- ---------------------------------------------------------------- directory.addons
create table if not exists directory.addons (
  addon_id      text primary key,
  venue_id      text not null,
  name          text not null check (octet_length(name) between 1 and 200),
  group_name    text not null default '' check (octet_length(group_name) <= 120),
  price_paisa   int8 not null check (price_paisa >= 0),
  is_veg        boolean not null default true,
  status        product_status not null default 'DRAFT',
  review_reason text check (review_reason is null or octet_length(review_reason) <= 500),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists addons_venue_idx  on directory.addons (venue_id);
create index if not exists addons_status_idx on directory.addons (status);
create index if not exists addons_venue_status_idx on directory.addons (venue_id, status);

-- ---------------------------------------------------------------- directory.menu_addon_links
-- `venue_id` is deliberately not FK'd to directory.stores: a menu venue resolves either to a
-- vendor store or a dining venue (the directory.vendors union), exactly like directory.menus.
create table if not exists directory.menu_addon_links (
  venue_id  text not null,
  dish_id   text not null,
  addon_id  text not null references directory.addons (addon_id) on delete cascade,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (venue_id, dish_id, addon_id)
);

create index if not exists menu_addon_links_addon_idx on directory.menu_addon_links (addon_id);
create index if not exists menu_addon_links_venue_dish_idx on directory.menu_addon_links (venue_id, dish_id);

-- ---------------------------------------------------------------- checkout.order_item_addons
-- Immutable snapshot of the selected extras on a placed order line. Prices are copied so a later
-- catalogue edit never rewrites history.
create table if not exists checkout.order_item_addons (
  order_item_addon_id text primary key,
  order_id            text not null references checkout.orders (order_id) on delete cascade,
  line_id             text not null references checkout.order_items (line_id) on delete cascade,
  addon_id            text,
  addon_name          text not null,
  addon_price_paisa   int8 not null check (addon_price_paisa >= 0),
  qty                 int8 not null default 1 check (qty > 0)
);

create index if not exists order_item_addons_order_idx on checkout.order_item_addons (order_id);
create index if not exists order_item_addons_line_idx  on checkout.order_item_addons (line_id);

-- ---------------------------------------------------------------- RLS (Supabase only)
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    raise notice 'auth schema absent — skipping addon RLS (non-Supabase environment)';
    return;
  end if;
  execute 'alter table directory.addons            enable row level security';
  execute 'alter table directory.menu_addon_links  enable row level security';
  execute 'alter table checkout.order_item_addons  enable row level security';
  execute 'create policy anon_read on directory.addons           for select to anon, authenticated using (true)';
  execute 'create policy anon_read on directory.menu_addon_links for select to anon, authenticated using (true)';
  execute $p$create policy own_rows on checkout.order_item_addons for select to authenticated
    using (exists (
      select 1 from checkout.orders o
       where o.order_id = order_id and o.user_id = checkout.current_app_user_id()))$p$;
end;
$$;
