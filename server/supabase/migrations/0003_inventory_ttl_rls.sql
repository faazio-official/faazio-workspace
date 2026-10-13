-- Faazio MVP — inventory TTL sweeps + Row Level Security.
-- Authority: docs/architecture/mvp-backend.md §2 (RLS classes), db-schema.md §6 (TTL),
-- caching-cloudflare-valkey.md §7 (idempotency locks are Valkey-side, not here).

-- ---------------------------------------------------------------- cart TTL
-- Carts are auth-scoped and mutable; sweep abandoned ones after 30 days.
create or replace function inventory.sweep_stale_carts(max_age interval default '30 days')
returns integer language plpgsql as $$
declare deleted integer;
begin
  delete from inventory.carts where updated_at < now() - max_age;
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

-- ---------------------------------------------------------------- reservation TTL
-- Release expired reservations back to stock (DynamoDB TTL analogue).
create or replace function inventory.release_expired_reservations()
returns integer language plpgsql as $$
declare released integer;
begin
  with expired as (
    delete from inventory.stock_reservations
    where expires_at < now()
    returning product_id, qty
  ), agg as (
    select product_id, sum(qty) as qty from expired group by product_id
  )
  update inventory.stock s
     set in_stock_qty = s.in_stock_qty + agg.qty,
         updated_at   = now()
    from agg
   where s.product_id = agg.product_id;
  get diagnostics released = row_count;
  return released;
end;
$$;

-- Schedule the sweeps (idempotent; only where pg_cron is installed).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('faazio-release-expired-reservations')
      where exists (select 1 from cron.job where jobname = 'faazio-release-expired-reservations');
    perform cron.schedule('faazio-release-expired-reservations', '*/5 * * * *',
      $cron$ select inventory.release_expired_reservations(); $cron$);

    perform cron.unschedule('faazio-sweep-stale-carts')
      where exists (select 1 from cron.job where jobname = 'faazio-sweep-stale-carts');
    perform cron.schedule('faazio-sweep-stale-carts', '0 3 * * *',
      $cron$ select inventory.sweep_stale_carts(); $cron$);
  end if;
end;
$$;

-- ---------------------------------------------------------------- RLS (Supabase only)
-- Applied only where the Supabase `auth` schema exists; a bare local Postgres skips it.
-- The gateway connects as service_role (bypasses RLS); anon/auth clients are least-privilege.
-- PII columns (phone/email/full address/user linkage) are never exposed by anon/auth reads.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    raise notice 'auth schema absent — skipping RLS (non-Supabase environment)';
    return;
  end if;

  -- Supabase auth user (uuid) → app user slug.
  execute $f$
    create or replace function checkout.current_app_user_id() returns text
    language sql stable security definer set search_path = checkout, public as
    $body$ select u.user_id from checkout.users u where u.auth_uid = auth.uid() limit 1 $body$
  $f$;

  -- ---- anon read: public catalog / stores / public reviews / coupons / stock
  execute 'alter table catalog.products          enable row level security';
  execute 'alter table directory.stores          enable row level security';
  execute 'alter table directory.dining_venues   enable row level security';
  execute 'alter table reviews.reviews           enable row level security';
  execute 'alter table reviews.vendor_reviews    enable row level security';
  execute 'alter table reviews.specs             enable row level security';
  execute 'alter table reviews.highlights        enable row level security';
  execute 'alter table inventory.stock           enable row level security';
  execute 'alter table checkout.coupons          enable row level security';

  execute 'create policy anon_read on catalog.products        for select to anon, authenticated using (true)';
  execute 'create policy anon_read on directory.stores        for select to anon, authenticated using (true)';
  execute 'create policy anon_read on directory.dining_venues for select to anon, authenticated using (true)';
  execute 'create policy anon_read on reviews.reviews         for select to anon, authenticated using (true)';
  execute 'create policy anon_read on reviews.specs           for select to anon, authenticated using (true)';
  execute 'create policy anon_read on reviews.highlights      for select to anon, authenticated using (true)';
  execute 'create policy anon_read on inventory.stock         for select to anon, authenticated using (true)';
  execute 'create policy anon_read on checkout.coupons        for select to anon, authenticated using (true)';
  -- vendor_reviews: public columns only (all columns here are public-safe; user_id is never selected by the gateway).
  execute 'create policy anon_read on reviews.vendor_reviews for select to anon, authenticated using (true)';

  -- ---- auth-scoped: own rows only
  execute 'alter table inventory.carts       enable row level security';
  execute 'alter table checkout.orders       enable row level security';
  execute 'alter table checkout.order_items  enable row level security';
  execute 'alter table accounts.profile      enable row level security';
  execute 'alter table accounts.membership   enable row level security';
  execute 'alter table accounts.order_status enable row level security';
  execute 'alter table accounts.nav          enable row level security';
  execute 'alter table accounts.details      enable row level security';
  execute 'alter table inventory.stock_reservations enable row level security';

  execute $p$create policy own_rows on inventory.carts for all to authenticated
    using (user_id = checkout.current_app_user_id())
    with check (user_id = checkout.current_app_user_id())$p$;
  execute $p$create policy own_rows on checkout.orders for select to authenticated
    using (user_id = checkout.current_app_user_id())$p$;
  execute $p$create policy own_rows on checkout.order_items for select to authenticated
    using (exists (select 1 from checkout.orders o where o.order_id = order_id and o.user_id = checkout.current_app_user_id()))$p$;
  execute $p$create policy own_rows on accounts.profile for select to authenticated
    using (id = checkout.current_app_user_id())$p$;
  execute $p$create policy own_rows on accounts.membership for select to authenticated
    using (user_id = checkout.current_app_user_id())$p$;
  execute $p$create policy own_rows on accounts.order_status for select to authenticated
    using (user_id = checkout.current_app_user_id())$p$;
  execute $p$create policy own_rows on accounts.nav for select to authenticated
    using (user_id = checkout.current_app_user_id())$p$;
  execute $p$create policy own_rows on accounts.details for select to authenticated
    using (user_id = checkout.current_app_user_id())$p$;
  execute $p$create policy own_rows on inventory.stock_reservations for all to authenticated
    using (user_id = checkout.current_app_user_id())
    with check (user_id = checkout.current_app_user_id())$p$;

  -- Writes (stock decrements, checkout writes, moderation, rating upsert) are service_role only,
  -- which bypasses RLS. anon/authenticated get no insert/update/delete policies here.
  execute $p$create policy public_insert on reviews.vendor_reviews for insert to authenticated
    with check (user_id = checkout.current_app_user_id())$p$;
  execute $p$create policy public_update on reviews.vendor_reviews for update to authenticated
    using (user_id = checkout.current_app_user_id())
    with check (user_id = checkout.current_app_user_id())$p$;
end;
$$;