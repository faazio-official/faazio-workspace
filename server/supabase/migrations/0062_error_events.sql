-- Faazio MVP — client crash/error event sink (POST /errors).
-- Authority: docs/architecture/db-schema.md, monolith-breakdown.md §1.
-- Why: release crashes must be visible to the operator. The app posts non-PII error reports
-- (message + stack only; no route params/keys) fire-and-forget; the gateway inserts here. The
-- structured request log always carries the report too, so a missing migration or a DB outage
-- degrades to "logged, not stored" instead of losing the signal.
create schema if not exists ops;

create table if not exists ops.error_events (
  id             bigint generated always as identity primary key,
  user_id        text not null default '',
  app_variant    text not null default '',
  release        text not null default '',
  message        text not null,
  stack          text,
  component_stack text,
  created_at     timestamptz not null default now()
);

create index if not exists error_events_created_at_idx
  on ops.error_events (created_at desc);

-- The app has no read path; the gateway service role inserts only. RLS stays enabled so a
-- misconfigured client role can never read or write these rows.
alter table ops.error_events enable row level security;