-- Faazio MVP — favourites: durable, auth-scoped product/shelf hearts.
-- Authority: docs/architecture/db-schema.md §12, monolith-breakdown.md §1 (favourites context).
-- Why: favourites lived only in client memory (favoriteStore, re-seeded every launch), so they were
-- lost on logout/restart and could not sync across devices. They are the highest-traffic write after
-- the cart.
--
-- No FK on product_id (deliberate deviation from the plan): the client seed (`seedFavorites`) mixes
-- catalog product ids with category/rail ids (`cat-*`, `m-*`) that are not `catalog.products` rows.
-- The column is a bounded opaque shelf id, validated by length; a FK would reject the seed and any
-- future non-product favourite target.
create schema if not exists favourites;

create table favourites.items (
  user_id    text not null references checkout.users (user_id) on delete cascade,
  product_id text not null check (char_length(product_id) between 1 and 64),
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index favourites_items_user_created_idx on favourites.items (user_id, created_at desc);

-- RLS (Supabase only): own rows only. Favourites are auth-scoped + mutable, so they are never
-- edge-cached; anon gets nothing. The gateway connects as service_role (bypasses RLS).
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    raise notice 'auth schema absent — skipping favourites RLS (non-Supabase environment)';
    return;
  end if;

  execute 'alter table favourites.items enable row level security';
  execute $p$create policy own_rows on favourites.items for all to authenticated
    using (user_id = checkout.current_app_user_id())
    with check (user_id = checkout.current_app_user_id())$p$;
end;
$$;