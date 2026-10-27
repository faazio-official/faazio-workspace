-- Faazio MVP — notification outbox delivery retries.
--
-- Why: a transient webhook 5xx (or a brief relay outage) permanently dropped the notification;
-- FAILED was terminal. This migration adds a retry budget: attempts counters + a next_attempt_at
-- schedule applied by the drain worker's MarkFailed (capped exponential backoff, terminal after 6
-- attempts). PENDING / retryable FAILED rows are picked by the worker's Pending query.
--
-- Also backfills legacy FAILED rows (attempts = 0, never scheduled) with one more chance — they had
-- no retry mechanics, so giving them a retry window only helps recover a pre-ferret outage.
--
-- Idempotent and re-runnable. Apply from a dev terminal per docs/RUNBOOKS/DATABASE_MIGRATIONS.md;
-- never auto-run on Render.

alter table notifications.outbox add column if not exists attempts int not null default 0;
alter table notifications.outbox add column if not exists next_attempt_at timestamptz;
alter table notifications.outbox add column if not exists updated_at timestamptz not null default now();

-- Drainable = PENDING or FAILED scheduled for (re)delivery. Supports Pending()'s status filter.
create index if not exists notifications_outbox_retry_idx
    on notifications.outbox (status, next_attempt_at)
    where status in ('PENDING', 'FAILED');

-- Give legacy FAILED rows (never scheduled, never counted) one retry instead of leaving them dead.
update notifications.outbox
   set next_attempt_at = now()
 where status = 'FAILED'
   and next_attempt_at is null
   and attempts = 0;