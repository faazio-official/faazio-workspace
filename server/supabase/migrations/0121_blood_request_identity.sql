-- Faazio — blood.requests: patient + contact-person identity, and a deterministic alert order.
-- Authority: docs/architecture/db-schema.md §12.6, monolith-breakdown.md §1.
--
-- Why the columns: a public request was posted with only a city and a blood group, so the donor
-- board could show "someone in Chennai needs O+" with nobody to ask for and no person to call. A
-- donor could not act on it. The post form now collects the patient's name, a contact number, and
-- the name of the person who will receive the call.
--
-- Both new columns are PII and follow the existing `contact`/`address` rule: they are returned to an
-- authenticated caller and stripped from the public (anon) projection, which is the only projection
-- that is ever cached.
--
-- Default '' (not NULL) so existing rows and any older client that does not send them stay valid;
-- the client requires them, the server accepts their absence for backward compatibility.
alter table blood.requests
  add column if not exists patient_name   text not null default '',
  add column if not exists contact_person text not null default '';

comment on column blood.requests.patient_name is
  'Patient name as given by the requester. PII: redacted from the public/anon board projection.';
comment on column blood.requests.contact_person is
  'Name of the person who will receive a donor''s call. PII: redacted from the public/anon projection.';

-- Alert recipient ordering. The board nudge caps how many donors one post can reach, so which
-- donors are chosen must be deterministic and useful rather than whatever order the planner returns.
-- `push_tokens.updated_at` is the best "this device is actually in use" signal we hold: the OS
-- rotates a token on reinstall/re-register, and the gateway refreshes it on every app start, so the
-- most recently refreshed tokens are the most reachable devices. The recipient query orders by it
-- (ties break on user_id, so the order is total and two identical posts nudge the same set); this
-- index lets that join stay cheap per user.
create index if not exists push_tokens_user_kind_updated_idx
  on notifications.push_tokens (user_id, token_kind, updated_at desc);

