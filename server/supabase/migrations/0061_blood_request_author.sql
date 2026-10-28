-- Faazio MVP — blood.requests author stamp + right-to-erasure.
-- Authority: docs/architecture/db-schema.md §12.6, monolith-breakdown.md §1.
-- Why: a user's posted contact/address PII in blood.requests could not be linked back to
-- checkout.users and erased on account deletion. The gateway stamps created_by from the bearer
-- token on create, and DeleteAccount now deletes the author's own requests (interests cascade).
-- Seed rows are hospital-posted and stay unowned (created_by = '') — the default.
alter table blood.requests
  add column if not exists created_by text not null default '';

create index if not exists blood_requests_created_by_idx
  on blood.requests (created_by)
  where created_by <> '';