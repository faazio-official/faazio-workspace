-- Faazio MVP — the seller's "why" on a platform-fee change request.
-- Authority: docs/architecture/db-schema.md §sellers, monolith-breakdown.md §1 (sellers row).
--
-- Product rule: a seller asks for a new platform fee against one vendor store and may explain why.
-- The note is the SELLER's words (distinct from `review_reason`, which is the admin's decision
-- text and from `admin_note`). It never mutates the live fee; a district/super admin still decides.
--
-- Idempotent: safe to re-run.

alter table sellers.seller_fee_change_requests
  add column if not exists seller_note text not null default '';

-- Keep the column bounded so a client cannot store an unbounded blob. The gateway also trims and
-- caps the value before insert; this is the database-level backstop.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'seller_fee_change_requests_seller_note_len'
  ) then
    alter table sellers.seller_fee_change_requests
      add constraint seller_fee_change_requests_seller_note_len
      check (length(seller_note) <= 500);
  end if;
end;
$$;
