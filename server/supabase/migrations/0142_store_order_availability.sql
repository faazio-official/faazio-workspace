-- Faazio — store-level Instant vs Schedule / pre-order availability (migration 0142).
--
-- Authority: docs/architecture/db-schema.md (directory stores/venues),
-- docs/user-interaction-workflow/seller/web-portal/ (store profile),
-- docs/user-interaction-workflow/customer/discovery/ (food home filter).
--
-- Why: advance ordering is a property of the restaurant/kitchen, not of every dish. A seller sets it
-- once on the store profile (operating-hours level); the customer Food feed can then filter to venues
-- that accept scheduled orders.
--
-- Contract:
--   * instant_delivery           — the shop accepts immediate orders (default true).
--   * accepts_scheduled_orders   — the shop accepts pre-orders / time-slot orders (default false).
--   * schedule_lead_time_minutes — minimum notice for a scheduled order (0..1440; default 60).
--   * schedule_slots             — the seller's offered HH:MM slot labels (text[]; empty = anytime).
--
-- Additive + idempotent; apply from a dev terminal via server/supabase/apply-migration.sh per
-- docs/RUNBOOKS/DATABASE_MIGRATIONS.md. Never auto-run on Render.

begin;

alter table directory.stores
  add column if not exists instant_delivery boolean not null default true,
  add column if not exists accepts_scheduled_orders boolean not null default false,
  add column if not exists schedule_lead_time_minutes smallint not null default 60,
  add column if not exists schedule_slots text[] not null default '{}';

alter table directory.dining_venues
  add column if not exists instant_delivery boolean not null default true,
  add column if not exists accepts_scheduled_orders boolean not null default false,
  add column if not exists schedule_lead_time_minutes smallint not null default 60,
  add column if not exists schedule_slots text[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stores_schedule_lead_check') then
    alter table directory.stores
      add constraint stores_schedule_lead_check
      check (schedule_lead_time_minutes between 0 and 1440);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dining_venues_schedule_lead_check') then
    alter table directory.dining_venues
      add constraint dining_venues_schedule_lead_check
      check (schedule_lead_time_minutes between 0 and 1440);
  end if;
end $$;

-- A FOOD seller edits the store row; the customer venue feed reads dining_venues. Keep the two in
-- sync for rows that share an id (the normal store/venue pair).
update directory.dining_venues v
   set instant_delivery = s.instant_delivery,
       accepts_scheduled_orders = s.accepts_scheduled_orders,
       schedule_lead_time_minutes = s.schedule_lead_time_minutes,
       schedule_slots = s.schedule_slots
  from directory.stores s
 where v.id = s.id
   and s.app = 'FOOD'::app_brand;

commit;
