-- 0132_customer_location_identity.sql
-- Why: the admin customer directory (/admin/super/users) needs a real district + pincode per
-- customer, and a stable, human-readable unique id. checkout.users.state_code was only ever written
-- by tests/seed (the mobile app never sent its reverse-geocoded state), and no district/pincode
-- column existed at all.
--
-- The customer's identity stays keyed by the immutable `checkout.users.user_id` (referenced by
-- orders/payments/rewards/blood/tax rows). The visible "user id" is a derived `customer_code`
-- `fa` + 6-digit pincode + 10-digit phone, assigned once the app reports a serviceable location.
-- `PUT /profile/location` writes pincode/district/state and mints that code; see
-- docs/architecture/db-schema.md §12.42 and monolith-breakdown.md §1.
--
-- Additive and nullable: an existing row keeps working and simply shows its internal user_id until
-- the customer opens the app and reports a location. Idempotent: safe to re-run.

alter table checkout.users
  add column if not exists pincode       text,
  add column if not exists district_code text,
  add column if not exists customer_code text;

-- A pincode is a 6-digit Indian PIN; anything else is a bug, never a valid value.
alter table checkout.users drop constraint if exists users_pincode_format;
alter table checkout.users
  add constraint users_pincode_format
  check (pincode is null or pincode ~ '^[0-9]{6}$');

-- The code is the public identity, so it must be unique. A NULL code (phone/pincode not yet known)
-- is unconstrained.
create unique index if not exists users_customer_code_uniq
  on checkout.users (customer_code)
  where customer_code is not null;

create index if not exists users_district_idx
  on checkout.users (district_code);

-- Directory search matches customer_code with a leading wildcard, exactly like the name/phone
-- trigram indexes from 0110.
create index if not exists users_customer_code_trgm_idx
  on checkout.users using gin (customer_code gin_trgm_ops);

-- The projection appends district_code/pincode/customer_code at the tail (Postgres create-or-replace
-- only permits new columns at the end) and keeps the same access control: security_invoker = on,
-- never granted to anon/authenticated, read only by the gateway (service_role).
create or replace view checkout.users_admin
  with (security_invoker = on) as
  select u.user_id,
         u.name,
         u.state_code,
         u.created_at,
         count(o.order_id)::int4               as orders_count,
         coalesce(sum(o.total_paisa), 0)::int8 as spend_paisa,
         max(o.placed_at)                      as last_order_at,
         u.phone,
         u.district_code,
         u.pincode,
         u.customer_code
    from checkout.users u
    left join checkout.orders o on o.user_id = u.user_id
   group by u.user_id, u.name, u.state_code, u.created_at, u.phone,
            u.district_code, u.pincode, u.customer_code;

comment on column checkout.users.pincode is
  'Reverse-geocoded 6-digit PIN reported by the app (PUT /profile/location). PII-adjacent; only the gateway reads it.';
comment on column checkout.users.district_code is
  'admins.district_master code derived server-side from the reported location; never a client-supplied pair.';
comment on column checkout.users.customer_code is
  'Public unique customer id: fa + 6-digit pincode + 10-digit phone. Assigned once; internal user_id remains the FK key.';

comment on view checkout.users_admin is
  'Admin customer directory projection over checkout.users (+ order counts/spend). Exposes name, phone, district, pincode and customer_code for moderation/support; never granted to anon/authenticated — read only by the gateway (service_role).';
