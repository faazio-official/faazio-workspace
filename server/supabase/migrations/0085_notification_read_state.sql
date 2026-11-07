-- Faazio MVP — in-app notification read state.
--
-- Why: the inbox badged every row regardless of whether the recipient had seen it, because the
-- outbox had no read marker. This adds a nullable `read_at` stamped the first time the customer
-- opens the notification (POST /notifications/{id}/read) or clears the badge in one go
-- (POST /notifications/read-all). The column is additive and the inbox read is tolerant of NULLs,
-- so the migration is safe to apply after the gateway build ships.
--
-- Idempotent and re-runnable. Apply from a dev terminal per docs/RUNBOOKS/DATABASE_MIGRATIONS.md;
-- never auto-run on Render.

alter table notifications.outbox add column if not exists read_at timestamptz;

-- Unread lookups (badge count) scan a user's rows where read_at is null.
create index if not exists notifications_outbox_unread_idx
    on notifications.outbox (user_id, created_at desc)
    where read_at is null;
