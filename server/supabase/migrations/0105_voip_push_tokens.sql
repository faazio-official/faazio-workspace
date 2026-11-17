-- Faazio — VoIP (PushKit) push tokens beside the FCM token.
-- Authority: docs/architecture/db-schema.md (§12.12 notifications), monolith-breakdown.md §1
-- (notifications row), user-interaction-workflow/customer/calling/*.
--
-- Why: `notifications.push_tokens` was one row per user (`user_id` primary key), so an iOS device
-- could store exactly one token. A PushKit VoIP token is a different credential from the FCM token:
-- both are needed at once, because order/Rx pushes still travel through FCM while an incoming call
-- needs APNs (`apns-push-type: voip`). `token_kind` splits them without touching the delivery
-- contract: the drain query picks `voip` for `incoming_call` rows when present, else `push`.
--
-- Additive and idempotent; apply from a dev terminal per docs/RUNBOOKS/DATABASE_MIGRATIONS.md.
-- Never auto-run on Render.

alter table notifications.push_tokens
  add column if not exists token_kind text not null default 'push';

alter table notifications.push_tokens
  drop constraint if exists push_tokens_token_kind_check;
alter table notifications.push_tokens
  add constraint push_tokens_token_kind_check check (token_kind in ('push', 'voip'));

-- One token per (user, kind): the FCM token and the VoIP token coexist, each replaceable on its own.
alter table notifications.push_tokens
  drop constraint if exists push_tokens_pkey;
alter table notifications.push_tokens
  add constraint push_tokens_pkey primary key (user_id, token_kind);

-- Token prune / cross-user takeover look the token up by value.
create index if not exists push_tokens_token_idx
  on notifications.push_tokens (token);

comment on column notifications.push_tokens.token_kind is
  'push = FCM/APNs alert or background token; voip = PushKit token used only for incoming_call.';
