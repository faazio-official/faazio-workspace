-- Faazio MVP — customer account deletion + partial data erasure.
-- Authority: docs/architecture/db-schema.md §1 (checkout), monolith-breakdown.md §1.
-- Why: Play Console requires a working in-app delete-account path. Financial rows (orders,
-- payments, tax invoices) must survive for tax/accounting/dispute-resolution, so deletion
-- anonymises the checkout.users row and erases the PII tables instead of hard-deleting the user
-- (the non-cascading FKs would reject a hard delete anyway).
alter table checkout.users
  add column if not exists deleted_at timestamptz;

create index if not exists users_deleted_idx
  on checkout.users (deleted_at)
  where deleted_at is not null;

comment on column checkout.users.deleted_at is
  'Set when the customer deletes their account; PII is erased and auth_uid unlinked so the identity no longer resolves.';
