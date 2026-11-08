-- Faazio MVP — product soft delete + 7-day trash window.
--
-- Why: sellers/admins delete listings from the portal, but the delete was local-only (no gateway
-- write) and a hard delete loses the audit trail and offers no undo. A soft delete moves the row to
-- a trash view that the owner can restore within 7 days; after that the row (and its stock) is
-- purged. Shopper reads exclude deleted rows through `deleted_at is null`.
--
-- Additive and idempotent; safe to apply after the gateway build ships. Apply from a dev terminal
-- per docs/RUNBOOKS/DATABASE_MIGRATIONS.md; never auto-run on Render.

alter table catalog.products add column if not exists deleted_at timestamptz;
alter table catalog.products add column if not exists delete_reason text not null default ''
  check (octet_length(delete_reason) <= 500);

create index if not exists products_deleted_idx
  on catalog.products (deleted_at) where deleted_at is not null;

-- Purge rows past the trash window and their inventory rows. Order history (checkout.order_items)
-- is intentionally preserved; it is a historical record, not a live catalogue row.
create or replace function catalog.purge_deleted_products(max_age interval default '7 days')
returns integer language plpgsql as $$
declare purged integer;
begin
  delete from inventory.stock s
   using catalog.products p
   where s.product_id = p.id
     and p.deleted_at is not null
     and p.deleted_at < now() - max_age;

  delete from catalog.products
   where deleted_at is not null
     and deleted_at < now() - max_age;
  get diagnostics purged = row_count;
  return purged;
end;
$$;

-- Schedule the purge hourly where pg_cron is installed (idempotent).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('faazio-purge-deleted-products')
      where exists (select 1 from cron.job where jobname = 'faazio-purge-deleted-products');
    perform cron.schedule('faazio-purge-deleted-products', '17 * * * *',
      $cron$ select catalog.purge_deleted_products(); $cron$);
  end if;
end;
$$;
