-- Faazio MVP — Pharma Rx privacy hardening (app-aligned, additive).
-- Authority: docs/architecture/db-schema.md §12.12, monolith-breakdown.md §1, mvp-plan §5.
-- Why: the seller already reads the customer name by joining checkout.users (never a stored
-- duplicate), and contact stays gated on revealed_at. This migration only adds what backs the new
-- deep-link read + the server-side quote integrity checks. Additive only; safe to re-run.

-- Fast lookup for the seller Rx queue/deep-link: one seller's prescriptions by status, newest first.
create index if not exists prescriptions_vendor_status_idx
  on pharma.prescriptions (vendor_id, status, created_at desc);

-- Quote integrity at the DB edge, mirroring the handler gate: price never exceeds MRP (when an MRP is
-- authored) and a discount never exceeds the price. NOT VALID so pre-existing rows are untouched;
-- the constraint is enforced for every new/updated row.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quote_items_price_le_mrp') then
    alter table pharma.quote_items
      add constraint quote_items_price_le_mrp
      check (mrp_paisa = 0 or price_paisa <= mrp_paisa) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quote_items_discount_le_price') then
    alter table pharma.quote_items
      add constraint quote_items_discount_le_price
      check (discount_paisa <= price_paisa) not valid;
  end if;
end;
$$;

-- RLS note (Supabase only): pharma.prescriptions already has the owner read-only policy (0009);
-- pharma.quote_items/status_history are deny-all (0018). Every seller/rx write goes through the
-- gateway (service_role), which is the real scope enforcer — the portal never talks to Postgres
-- directly. No policy change is needed here; this comment records the invariant.