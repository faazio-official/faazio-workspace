-- Faazio MVP — per-vendor (shop) payout-bank override.
-- Authority: docs/architecture/db-schema.md §directory, docs/architecture/monolith-breakdown.md §1.
--
-- Why: one seller ACCOUNT may own several shops with different payout accounts. The account-level
-- payout bank (sellers.bank_accounts) stays the default; a shop may carry its own override, captured
-- during onboarding. Only the masked account tail is ever stored — the full number never reaches
-- Postgres.
--
-- Idempotent: safe to re-run.
alter table directory.stores add column if not exists bank_name              text not null default '';
alter table directory.stores add column if not exists bank_account_number    text not null default '';
alter table directory.stores add column if not exists bank_ifsc              text not null default '';
alter table directory.stores add column if not exists bank_beneficiary_name  text not null default '';
