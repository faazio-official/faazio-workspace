-- Faazio MVP — manual district allocation + dual (AUTOMATED / MANUAL) rider payouts.
-- Authority: docs/architecture/db-schema.md §12.27, docs/architecture/monolith-breakdown.md §1
-- (delivery context row), docs/architecture/server-gateway-plan.md (§delivery).
--
-- Additive only (never rewrites 0001–0054). Idempotent: safe to re-run.
--
-- * delivery_orders gains the admin-visible district (derived from the store's seller) so the
--   portal can scope the allocation board without trusting a client-supplied district.
-- * payout_mode is mandatory at allocation (default AUTOMATED for legacy/auto-dispatched rows).
-- * MANUAL orders record the admin-entered travelled distance + fare override; AUTOMATED orders
--   keep the server-calculated fare snapshot. delivery_payouts mirrors the same fields as the
--   immutable settlement audit trail.
--
-- Money stays integer paisa; no Razorpay transfer is initiated by this feature.

do $$ begin
  create type delivery_payout_mode as enum ('AUTOMATED', 'MANUAL');
exception when duplicate_object then null; end $$;

-- ================================================================ delivery_orders
alter table delivery.delivery_orders
  add column if not exists district_code text
    references admins.district_master (district_code) on delete restrict,
  add column if not exists payout_mode delivery_payout_mode not null default 'AUTOMATED',
  add column if not exists manual_distance_km numeric(7,2)
    check (manual_distance_km is null or manual_distance_km >= 0),
  add column if not exists manual_fare_paisa int8
    check (manual_fare_paisa is null or manual_fare_paisa >= 0),
  add column if not exists calculated_fare_paisa int8
    check (calculated_fare_paisa is null or calculated_fare_paisa >= 0),
  add column if not exists fare_override_reason text;

-- Best-effort backfill for existing jobs: store -> seller district. Legacy stores without a
-- seller/district stay null and remain super-admin-only on the district-scoped board.
update delivery.delivery_orders o
   set district_code = s.district_code
  from directory.stores st
  join sellers.sellers s on s.seller_id = st.seller_id
 where o.store_id = st.id
   and o.district_code is null
   and s.district_code is not null;

create index if not exists delivery_orders_district_status_idx
  on delivery.delivery_orders (district_code, status, created_at desc);

-- ================================================================ delivery_payouts
alter table delivery.delivery_payouts
  add column if not exists payout_mode delivery_payout_mode not null default 'AUTOMATED',
  add column if not exists manual_distance_km numeric(7,2)
    check (manual_distance_km is null or manual_distance_km >= 0),
  add column if not exists manual_fare_paisa int8
    check (manual_fare_paisa is null or manual_fare_paisa >= 0),
  add column if not exists calculated_fare_paisa int8
    check (calculated_fare_paisa is null or calculated_fare_paisa >= 0),
  add column if not exists fare_override_reason text;

create index if not exists delivery_payouts_mode_status_idx
  on delivery.delivery_payouts (payout_mode, status, created_at desc);
