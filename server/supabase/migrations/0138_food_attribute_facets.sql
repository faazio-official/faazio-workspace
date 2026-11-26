-- Faazio — dynamic food attribute facets (the Category Tree vs. Facets split).
--
-- Authority: docs/architecture/db-schema.md §12.4a, docs/architecture/monolith-breakdown.md §1
-- (categories + directory rows), docs/user-interaction-workflow/seller/web-portal/menu-creation.md,
-- docs/user-interaction-workflow/seller/web-portal/super-admin-categories.md.
--
-- Why: the taxonomy tree (taxonomy.categories) is navigation + GST. Dish metadata such as Patty,
-- Cheese Type, Bun, Dosa Style, Cooking Fat is NOT a sub-category — putting it in the tree explodes
-- into thousands of duplicate permutations. These are category-specific facets, superadmin-authored
-- and seller-applied as optional filter tags on a dish:
--
--   taxonomy.subcategory_attribute_groups — one filter group per leaf sub-category
--                                           (Burger → Patty, Cheese Type, Bun, …)
--   taxonomy.attribute_options            — the superadmin's master option list for a group, with
--                                           an optional parent filter tab (Patty → Chicken | Paneer |
--                                           Vegetables) and auto-tag keywords for the seller form
--   directory.menu_item_attributes        — the options a seller applied to one dish
--
-- Seller writes are optional (a dish may publish with no facets). Every option must belong to a
-- group whose sub-category is the dish's own sub-category; the gateway enforces that at write time.
--
-- Additive and idempotent; apply from a dev terminal via server/supabase/apply-migration.sh per
-- docs/RUNBOOKS/DATABASE_MIGRATIONS.md. Never auto-run on Render.

begin;

-- ---------------------------------------------------------------- attribute groups
create table if not exists taxonomy.subcategory_attribute_groups (
  id            text primary key,
  subcategory_id text not null references taxonomy.categories (id) on delete cascade,
  slug          text not null,
  display_name  text not null,
  -- 'single_select' renders a radio-style chip row (e.g. Bun Type); 'multi_select' allows several
  -- picks (e.g. Patty, Toppings).
  input_type    text not null default 'multi_select',
  display_order int  not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint subcategory_attribute_groups_input_type_check
    check (input_type in ('single_select', 'multi_select')),
  constraint subcategory_attribute_groups_slug_check
    check (slug ~ '^[a-z0-9_-]{1,50}$'),
  constraint subcategory_attribute_groups_name_len
    check (octet_length(display_name) between 1 and 100)
);

create unique index if not exists subcategory_attribute_groups_slug_uniq
  on taxonomy.subcategory_attribute_groups (subcategory_id, slug);
create index if not exists subcategory_attribute_groups_sub_idx
  on taxonomy.subcategory_attribute_groups (subcategory_id, display_order);

-- ---------------------------------------------------------------- attribute options
create table if not exists taxonomy.attribute_options (
  id                 text primary key,
  group_id           text not null references taxonomy.subcategory_attribute_groups (id) on delete cascade,
  -- Optional visual parent tab inside a group (the left-rail tabs in the customer filter drawer,
  -- e.g. Patty → Chicken | Paneer | Vegetables). NULL = a flat list.
  parent_filter_tab  text,
  label              text not null,
  icon_url           text,
  -- Keywords used by the seller form's auto-tagger: matching a dish name ("Crispy Peri Peri
  -- Chicken Cheese Burger") pre-selects the option. Never a UI data source on its own.
  keywords           text[] not null default '{}',
  display_order      int  not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint attribute_options_label_len check (octet_length(label) between 1 and 100),
  constraint attribute_options_tab_len
    check (parent_filter_tab is null or octet_length(parent_filter_tab) <= 50)
);

create unique index if not exists attribute_options_label_uniq
  on taxonomy.attribute_options (group_id, lower(label));
create index if not exists attribute_options_group_idx
  on taxonomy.attribute_options (group_id, display_order);

-- ---------------------------------------------------------------- dish → option links
-- Composite FK to directory.menus keeps a deleted dish from leaving orphan tags. option_id cascades
-- so a superadmin removing an option cleans every dish link automatically.
create table if not exists directory.menu_item_attributes (
  venue_id   text not null,
  dish_id    text not null,
  option_id  text not null references taxonomy.attribute_options (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (venue_id, dish_id, option_id),
  constraint menu_item_attributes_menu_fk
    foreign key (venue_id, dish_id) references directory.menus (venue_id, dish_id) on delete cascade
);

create index if not exists menu_item_attributes_option_idx
  on directory.menu_item_attributes (option_id);
create index if not exists menu_item_attributes_dish_idx
  on directory.menu_item_attributes (venue_id, dish_id);

comment on table taxonomy.subcategory_attribute_groups is
  'Superadmin-authored facet groups for a leaf sub-category (Burger → Patty, Cheese Type, Bun). Separate from the navigation/GST taxonomy tree so the tree never explodes into attribute permutations.';
comment on table taxonomy.attribute_options is
  'Master option list per facet group. parent_filter_tab groups options into the customer filter drawer tabs; keywords power the seller form auto-tagger.';
comment on table directory.menu_item_attributes is
  'Options a seller applied to a dish. Optional; every option is validated against the dish sub-category on write. Feeds the customer left-rail filters and the seller edit form.';

-- ---------------------------------------------------------------- RLS (Supabase only)
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    raise notice 'auth schema absent — skipping attribute-facet RLS (non-Supabase environment)';
    return;
  end if;

  execute 'grant usage on schema taxonomy to anon, authenticated';
  execute 'grant select on taxonomy.subcategory_attribute_groups, taxonomy.attribute_options to anon, authenticated';
  execute 'grant select on directory.menu_item_attributes to anon, authenticated';

  execute 'alter table taxonomy.subcategory_attribute_groups enable row level security';
  execute 'alter table taxonomy.attribute_options enable row level security';
  execute 'alter table directory.menu_item_attributes enable row level security';

  execute 'drop policy if exists attribute_groups_public_read on taxonomy.subcategory_attribute_groups';
  execute 'create policy attribute_groups_public_read on taxonomy.subcategory_attribute_groups for select to anon, authenticated using (true)';

  execute 'drop policy if exists attribute_options_public_read on taxonomy.attribute_options';
  execute 'create policy attribute_options_public_read on taxonomy.attribute_options for select to anon, authenticated using (true)';

  execute 'drop policy if exists menu_item_attributes_public_read on directory.menu_item_attributes';
  execute 'create policy menu_item_attributes_public_read on directory.menu_item_attributes for select to anon, authenticated using (true)';
end $$;

commit;
