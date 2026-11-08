-- Faazio MVP — customer post-delivery product reviews + order feedback.
--
-- Why: customers could only rate a vendor (reviews.vendor_reviews). There was no way to submit a
-- product-level review or order-level feedback after delivery, so the review context was limited
-- to a store rating. This migration:
--   1. makes reviews.reviews writable per user by adding the author (user_id), the verified-purchase
--      provenance (order_ids) and updated_at, with one live review per (user, product);
--   2. adds reviews.order_feedback for a single post-delivery feedback row per order.
--
-- Additive and idempotent; safe to apply after the gateway build ships. Apply from a dev terminal
-- per docs/RUNBOOKS/DATABASE_MIGRATIONS.md; never auto-run on Render.

alter table reviews.reviews add column if not exists user_id text;
alter table reviews.reviews add column if not exists order_ids text[] not null default '{}';
alter table reviews.reviews add column if not exists updated_at timestamptz not null default now();

-- One live review per (user, product), latest wins. Seeded/editorial rows keep user_id null and are
-- not constrained.
create unique index if not exists reviews_product_user_idx
  on reviews.reviews (product_id, user_id) where user_id is not null;

create table if not exists reviews.order_feedback (
  order_id    text primary key,                 -- → checkout.orders.order_id
  user_id     text not null,                    -- author (PII linkage — never public)
  user_name   text not null,                    -- public display name only (admin views)
  rating      int8 not null check (rating between 1 and 5),
  comment     text not null default '' check (octet_length(comment) <= 280),
  order_ids   text[] not null default '{}',     -- provenance snapshot
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists order_feedback_user_idx on reviews.order_feedback (user_id);

-- RLS: product reviews are publicly readable, but writes belong to the signed-in author. Order
-- feedback is private to its author. The gateway writes as service_role (bypasses RLS); these
-- policies keep any direct Supabase client honest.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth')
     or not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'auth schema or Supabase roles absent — skipping 0090 RLS (non-Supabase environment)';
    return;
  end if;
  execute 'alter table reviews.order_feedback enable row level security';
  execute 'drop policy if exists public_insert on reviews.reviews';
  execute $p$create policy public_insert on reviews.reviews for insert to authenticated
    with check (user_id = checkout.current_app_user_id())$p$;
  execute 'drop policy if exists public_update on reviews.reviews';
  execute $p$create policy public_update on reviews.reviews for update to authenticated
    using (user_id = checkout.current_app_user_id())
    with check (user_id = checkout.current_app_user_id())$p$;
  execute 'drop policy if exists own_rows on reviews.order_feedback';
  execute $p$create policy own_rows on reviews.order_feedback for all to authenticated
    using (user_id = checkout.current_app_user_id())
    with check (user_id = checkout.current_app_user_id())$p$;
end;
$$;
