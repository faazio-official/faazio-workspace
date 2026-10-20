-- Faazio MVP — GCP-style portal session lifetimes: sliding-idle + absolute cap + reuse grace.
-- Access stays 15 min; a refresh family now lives at most 180 days, slides 30 days per rotation,
-- and a concurrently-replayed token inside a 30 s grace window is never treated as theft.
-- Authority: docs/architecture/web-portal.md ("Portal auth"), db-schema.md §12.18,
-- monolith-breakdown.md §1 (portal auth row), docs/RUNBOOKS/PORTAL_AUTH.md (§6 "Session lifetimes").
--
-- WHY (F1 from the eternal-sessions plan): the old `used_at != nil → RevokeFamily` rotation made a
-- two-tab / gateway-proxy refresh race look like theft and nuked the whole session family. GCP's
-- model instead: a just-consumed token is idempotent for ~30 s (reuse-grace), the idle window
-- (expires_at) slides on every rotation, and a hard absolute cap (absolute_expires_at, 180 d) makes
-- sure an abandoned/stolen family still dies even when the owner keeps returning.
--
-- WHAT: new per-row columns on admins.portal_sessions. `rotated_to_hash` points at the child token a
-- rotation minted, so a replayed parent inside the grace window is matched to its own chain instead
-- of a blanket family revoke. `ua_hash` is a one-way fingerprint for the device-ish binding check
-- (P2.3); never a raw UA. `last_seen_at` records the most recent rotation. Only hashes live here —
-- the raw refresh token stays client-only, consistent with the surge-suppression PII rule.
--
-- Completely additive: identical-token behaviour for rows minted before this migration (their
-- `rotated_to_hash` is null → a replayed used token still revokes the family, exactly as 0032 did).
-- No mass logout: legacy rows are backfilled to created_at + 180 d, which is ≥ their existing 30 d
-- sliding expiry, so nobody is force-logged-out at deploy.

-- Backdate the absolute cap first so the DEFAULT below never leaves a legacy row with a cap that
-- starts counting from the ALTER instead of its original creation.
update admins.portal_sessions
   set absolute_expires_at = created_at + interval '180 days'
 where absolute_expires_at is null;

alter table admins.portal_sessions
  add column if not exists absolute_expires_at timestamptz not null default (now() + interval '180 days'),
  add column if not exists last_seen_at       timestamptz,
  add column if not exists reuse_grace_until  timestamptz,
  add column if not exists ua_hash            text not null default '',
  add column if not exists rotated_to_hash    text;

-- Absolute-cap scan is the sweeper's primary key (P4.1); the rotated_to partial index makes the
-- grace-chain join (parent → child) a lookup, not a scan.
create index if not exists portal_sessions_absolute_idx
  on admins.portal_sessions (absolute_expires_at);
create index if not exists portal_sessions_rotated_to_idx
  on admins.portal_sessions (rotated_to_hash)
 where rotated_to_hash is not null;

comment on column admins.portal_sessions.absolute_expires_at is
  'Hard cap: the family dies here no matter how often it slides (180 d from creation, never extended).';
comment on column admins.portal_sessions.reuse_grace_until is
  'Within this window a replayed used token is an idempotent rotation, not theft (GCP reuse grace).';
comment on column admins.portal_sessions.rotated_to_hash is
  'Hash of the child token this row rotated to; enables grace-accept matching.';
comment on column admins.portal_sessions.ua_hash is
  'One-way (sha256 prefix) browser fingerprint, never the raw User-Agent.';