-- Faazio MVP — seller hero campaigns (creative + target + placement + schedule).
-- Authority: docs/architecture/db-schema.md §12.17, mvp-backend.md §3,
-- monolith-breakdown.md §1 (ads), caching-cloudflare-valkey.md §5.
--
-- Why: `ads.sponsored_slots` (0015) can only promote a product on a rail — no poster creative, no
-- deep-link target, no placement/schedule. Sellers asked to buy a hero/banner (16:9 poster that opens
-- their own item/store). This adds a second, additive creative surface: `ads.campaigns` holds the
-- seller-owned campaign (target + creative + schedule) and one row per placement it was requested on.
-- Rails are untouched — `ads.sponsored_slots` stays the product-rail authority.
--
-- Additive only (never rewrites 0015–0026): new enum values + one new table. Existing placements and
-- `GET /ads/live` keep working. Idempotent — safe to re-run.

-- ================================================================ new placements
-- Hero / contextual placements the seller wizard can pick. `alter type ... add value` is additive.
alter type ad_placement add value if not exists 'HOME_HERO';
alter type ad_placement add value if not exists 'MART_HERO';
alter type ad_placement add value if not exists 'PHARMA_HERO';
alter type ad_placement add value if not exists 'FOOD_HERO';
alter type ad_placement add value if not exists 'CATEGORY_TOP';
alter type ad_placement add value if not exists 'STORE_TOP';

-- ================================================================ creative + target taxonomy
do $$ begin
  create type ad_creative_type as enum ('RAIL', 'HERO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ad_target_type as enum ('PRODUCT', 'DISH', 'STORE', 'VENUE');
exception when duplicate_object then null; end $$;

-- ================================================================ ads.campaigns (hero creative surface)
-- One row per (campaign, placement): a seller may request the same creative on several placements at
-- once, and each placement is moderated/measured independently (mirrors the rail's per-slot model).
-- The target must be an item the seller owns (enforced in the handler), so a hero can never deep-link
-- another seller's product. `image_url` is a bounded, already-resolved public URL (mirrors the SDUI
-- banner leaf — the portal uploads to R2 and stores the resolved CDN URL, so mobile renders it as-is).
create table if not exists ads.campaigns (
  placement_id      text primary key,               -- 'ad-cmp-*' minted by the gateway
  campaign_id       text not null,                  -- groups the placements of one seller request
  seller_id         text not null references sellers.sellers (seller_id) on delete cascade,
  creative_type     ad_creative_type not null default 'HERO',
  placement         ad_placement not null,
  target_type       ad_target_type not null,
  target_id         text not null check (char_length(target_id) between 1 and 64),
  target_app        app_brand not null,
  category          text check (category is null or char_length(category) <= 64),
  store_id          text check (store_id is null or char_length(store_id) <= 64),
  title             text not null check (char_length(title) between 1 and 40),
  subtitle          text not null default '' check (char_length(subtitle) <= 60),
  image_url         text not null default '' check (char_length(image_url) <= 512),
  cta               text not null default '' check (char_length(cta) <= 24),
  state_code        char(2),
  starts_at         timestamptz not null default now(),
  ends_at           timestamptz not null,
  status            ad_status not null default 'REQUESTED',
  impressions       int4 not null default 0 check (impressions >= 0),
  clicks            int4 not null default 0 check (clicks >= 0),
  orders_attributed int8 not null default 0 check (orders_attributed >= 0),
  requested_at      timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists campaigns_placement_status_idx on ads.campaigns (placement, status, ends_at);
create index if not exists campaigns_seller_idx           on ads.campaigns (seller_id);
create index if not exists campaigns_group_idx            on ads.campaigns (campaign_id);

-- Reuse the generic updated_at touch from 0014.
drop trigger if exists touch_updated_at on ads.campaigns;
create trigger touch_updated_at before update on ads.campaigns
  for each row execute function util.touch_updated_at();

-- ================================================================ RLS + grants (Supabase only)
-- The gateway connects as service_role and is the only writer. Defence-in-depth: a seller reads their
-- own campaign rows; admins read by scope (mirrors ads.sponsored_slots in 0015).
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth')
     or not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'auth schema or Supabase roles absent — skipping 0027 RLS + grants (non-Supabase environment)';
    return;
  end if;

  grant usage on schema ads to anon, authenticated;
  alter table ads.campaigns enable row level security;

  execute 'drop policy if exists seller_read on ads.campaigns';
  execute $p$create policy seller_read on ads.campaigns for select to authenticated
    using (seller_id = sellers.current_seller_id() or sellers.is_super()
           or sellers.is_state_admin_for(state_code))$p$;
end;
$$;