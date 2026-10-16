-- Faazio MVP — menu MRP (list price) so Food discounts are authoritative, never synthesized.
-- Authority: docs/architecture/db-schema.md §12.4, monolith-breakdown.md §1.
-- Why: the Food "Recommended & Offers" rail fabricated `price × 1.2` on-device. The discount rule is
-- `mrp_paisa > price_paisa`; a dish with no MRP shows no strike-through. Money is INT8 paisa (freeze
-- §4), exposed as whole rupees by the gateway.

alter table directory.menus
  add column if not exists mrp_paisa int8;

-- A menu MRP can never be below the selling price (the discount predicate would invert).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'menus_mrp_gte_price'
  ) then
    alter table directory.menus
      add constraint menus_mrp_gte_price check (mrp_paisa is null or mrp_paisa >= price_paisa);
  end if;
end;
$$;