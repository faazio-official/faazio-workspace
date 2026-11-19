-- Faazio MVP — expose the customer phone in the admin customer directory.
-- Authority: docs/architecture/db-schema.md §12.40, monolith-breakdown.md §1 (admins row).
--
-- Why: a Firebase phone-OTP customer is provisioned into checkout.users on first authenticated
-- gateway call (ProvisionUserID), but checkout.users_admin (0017) is a counts-only projection, so
-- /admin/super/users could neither display nor search their phone. The super-admin orders board
-- already shows real customer name + phone (super-admin-orders.md), so projecting phone into the
-- admin-only directory is access-control consistent: the view keeps `security_invoker = on`, is
-- never granted to anon/authenticated, and is read only by the gateway (service_role).
--
-- Column is appended at the END so `create or replace view` stays valid (Postgres only allows new
-- columns at the tail). Idempotent: safe to re-run.

create or replace view checkout.users_admin
  with (security_invoker = on) as
  select u.user_id,
         u.name,
         u.state_code,
         u.created_at,
         count(o.order_id)::int4              as orders_count,
         coalesce(sum(o.total_paisa), 0)::int8 as spend_paisa,
         max(o.placed_at)                     as last_order_at,
         u.phone
    from checkout.users u
    left join checkout.orders o on o.user_id = u.user_id
   group by u.user_id, u.name, u.state_code, u.created_at, u.phone;

comment on view checkout.users_admin is
  'Admin customer directory projection over checkout.users (+ order counts/spend). Exposes name and phone for moderation/support; never granted to anon/authenticated — read only by the gateway (service_role).';

-- Backs the directory search (`name`/phone/user id ILIKE) without a sequential scan once the
-- customer base grows past the board's 200-row page. Trigram indexes (pg_trgm from 0001) serve the
-- leading-wildcard ILIKE used by the repo query.
create index if not exists users_name_trgm_idx on checkout.users using gin (name gin_trgm_ops);
create index if not exists users_phone_trgm_idx on checkout.users using gin (phone gin_trgm_ops);
