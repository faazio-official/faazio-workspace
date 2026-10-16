-- Faazio MVP — public promo/ad reads (the anon contract the app rails need).
-- Authority: docs/architecture/db-schema.md §12.9, monolith-breakdown.md §1, mvp-backend.md §2.
-- Why: 0015 shipped coupons + sponsored slots as role-gated control-plane data only; there was no
-- anon-readable projection, so app-facing promotional rails had no server contract. This adds the
-- display fields the rails need and lets the gateway serve active coupons + LIVE ads publicly.
--
-- Additive only (never rewrites 0001–0020). Inherits the lean dtype policy: text = TEXT, money
-- `*_paisa` = INT8, flags = BOOLEAN, time = TIMESTAMPTZ. Idempotent throughout.

-- Display fields the app rail needs but the control-plane model never stored.
alter table promo.coupons add column if not exists title           text    not null default '';
alter table promo.coupons add column if not exists min_order_paisa int8    not null default 0
  check (min_order_paisa >= 0);
alter table promo.coupons add column if not exists free_delivery   boolean not null default false;

-- Public reads filter on (active, valid_till, sector, state); index keeps the projection cheap.
create index if not exists coupons_public_idx
  on promo.coupons (active, valid_till) where active;