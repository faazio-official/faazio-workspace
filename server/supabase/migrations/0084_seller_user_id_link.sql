-- Faazio MVP — link a seller application to its authenticated shopper.
-- Authority: docs/architecture/db-schema.md §sellers, docs/architecture/monolith-breakdown.md §1.
--
-- Why: the customer app's "Sell with us" applicant is an authenticated shopper (checkout.users.id via
-- auth.UserID()) but has no SELLER role until an admin activates the account. Storing that user id on
-- the application lets GET /sellers/me answer "what is my application status?" across app sessions.
--
-- Idempotent: safe to re-run.
alter table sellers.sellers add column if not exists user_id text;
create index if not exists sellers_user_id_idx on sellers.sellers (user_id) where user_id is not null;
