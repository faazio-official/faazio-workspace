-- 0043_delivery_reassign.sql — bounded dispatch fallback on rider rejection.
--
-- An offer keeps the same delivery job across retries: the order is released back to ASSIGNED for
-- the next best candidate instead of being terminally rejected on the first decline. The attempt
-- counter caps the chain, and excluded_rider_ids prevents re-offering the job to a rider who has
-- already declined it. Additive only; no existing columns/tables change shape.

alter table delivery.delivery_orders
  add column if not exists dispatch_attempts int not null default 1,
  add column if not exists excluded_rider_ids jsonb not null default '[]'::jsonb;

alter table delivery.delivery_orders
  drop constraint if exists delivery_orders_excluded_rider_ids_array;
alter table delivery.delivery_orders
  add constraint delivery_orders_excluded_rider_ids_array
  check (jsonb_typeof(excluded_rider_ids) = 'array');
