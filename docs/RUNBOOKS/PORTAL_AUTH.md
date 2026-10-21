# Portal Auth — provisioning, credentials, rotation, unlock, revoke

> Gateway-native email+password sign-in for the Partner Portal. Three roles are issued:
> `SUPER_ADMIN` (seeded operationally), `STATE_ADMIN` (scoped to a 2-letter state) and
> `SELLER` (scoped to a seller). Authority: `docs/architecture/web-portal.md` → "Portal auth",
> `db-schema.md` §12.18, `monolith-breakdown.md` §1 (`portal auth` row).
>
> Self-signup, email password-reset and mobile auth are **out of scope**. Never commit a password,
> hash, email list or secret — the SQL below is run in the Supabase SQL editor, not in a migration.

## 0. Triage a failed sign-in (A/B/C)

A `503` is config, not logic — three different origins collapse into one status. The portal now
preserves the `code` and renders distinct copy; `GET /api/auth/portal/status` returns the combined
verdict in one browser call, and every route echoes an `X-Request-Id` that is propagated to the
gateway so one Vercel log line correlates with the Render request log.

| Cause | UI copy | Body `code` | Origin | Fix |
|---|---|---|---|---|
| **A** | "This portal build has no gateway URL" | `not_configured` | `NEXT_PUBLIC_GATEWAY_URL` empty at `next build` | set the Vercel env var, then **redeploy** (build-time inlined) |
| **B** | "the gateway is unreachable" | `gateway_unavailable` | gateway down / wrong origin / TLS / cold start | check `GET $GATEWAY/health`, origin, Cloudflare TLS Full (strict) |
| **C** | "Gateway auth is not configured" | `portal_auth_unavailable` | `PORTAL_JWT_SECRET=""` on Render | set it (§1, item 2), roll the deploy |
| **D** | "could not read the portal credential tables" | `portal_unavailable` (500) | portal migration not applied — most often `0038` (login writes `absolute_expires_at` / `ua_hash`), less often `0032`/`0033` | apply the missing migration; boot log shows `portal_tables=missing|partial hint=…`, request log shows `portal_error op=login_session_create sqlstate=42703 column=…` |

```bash
# One browser-able verdict (unauthenticated, rate-limited; hostname only, no secrets):
curl -sS https://<portal-origin>/api/auth/portal/status | jq

# Gateway proof the auth stack is up (bad credentials ⇒ 401, never 503):
curl -sS -X POST "$GATEWAY/auth/portal/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"x@y.zz","password":"nope"}' | jq '{error,code}'
```

### 0.1 A gateway blip never logs you out (P0 — transient vs terminal refresh)

The portal keeps the long-lived `faazio_prt` refresh cookie through any transient failure so one
Cloudflare 5xx / Render cold-start / timeout cannot kill a still-valid session:

- **Transient** — network error, 5 s timeout, `502/503/504` (or any non-`401/400`): the nextjs
  routes (`me`, `refresh`, `gateway/[...path]`) **keep the cookies** and return `503`; the client
  retries once (1 s) for data calls and up to 3× with backoff (1/3/8 s) on session restore,
  showing a "Reconnecting…" gate instead of the login screen.
- **Terminal** — only gateway `401 invalid_refresh` / `400`: the refresh truly died, so the route
  clears both cookies and the user re-signs-in at `/login`.

Refresh classification lives in `src/lib/portal/server.ts` (`refreshTokens()` →
`RefreshResult.terminal`); the client mapping is `restorePortalSession()` in
`src/lib/portal/auth.ts`. A `503` in the Vercel logs with `code=gateway_unavailable` and no
`invalid_refresh` means the session is intact — do not investigate it as a logout (see §0 A/B/C
for the *pre-submit* status probe).

Sessions are now kept alive proactively (P3): rotation is single-flight
(`refreshTokensSingleflight`, so N concurrent 401s share one `/auth/portal/refresh`), the client
pre-rotates ~80% into the access token's life and on tab focus, and `middleware.ts` guards
`/seller/*` + `/admin/*` (edge cookie-presence check → `/login?next=…`; real validity is verified
by `me`/the proxy, never by the edge). The login form's "Stay signed in" checkbox maps to the
non-secret `faazio_remember` cookie (`0` = refresh cookie is browser-session-only, shared PC).

## 1. What must exist before the first login

1. Migrations `server/supabase/migrations/0032_portal_users.sql` +
   `0033_portal_roles.sql` + `0034_portal_superadmin_no_force.sql` +
   `0038_portal_session_lifetime.sql` applied (credential/session store; role + scope; superadmin
   confinement repair; GCP-style lifetimes — sliding idle / absolute cap / reuse grace). Deploy order:
   **migrations first**, then the gateway, then the portal. In local compose both are mounted
   automatically; for a **pre-existing** compose volume run `docker compose down -v` (dev only) or
   apply `0033` by hand (`psql -f`) — without it the scoped-role path 500s. `0038` is fully
   additive: legacy session rows are backfilled to `created_at + 180 d`, so nobody is logged out at
   deploy and pre-`0038` tokens behave exactly as before (a replayed used token still revokes the
   family, because `rotated_to_hash` is null).
2. Gateway env (Render dashboard — never in the repo; `render.yaml` declares them with `sync:false`):
   - `PORTAL_JWT_SECRET` — `openssl rand -base64 48` (≥256-bit HS256 signing key).
   - `PORTAL_PEPPER` — `openssl rand -base64 32` (server-side HMAC pepper; **changing it invalidates
     every existing password hash**).
   - `AUTH_DISABLED=false`, `ALLOWED_ORIGINS=https://<portal-origin>` (exact, no `*`).
   - Local dev: `PORTAL_JWT_SECRET=$(openssl rand -base64 48) PORTAL_PEPPER=$(openssl rand -base64 32) docker compose up --build`.
3. Portal env (Vercel): `NEXT_PUBLIC_GATEWAY_URL=https://<gateway-origin>` only. There is no auth-mode
   switch — the portal is always gateway-native. `NEXT_PUBLIC_*` is inlined at build time: changing it
   requires a redeploy (local values belong in gitignored `.env.local`).
4. Cloudflare WAF: rate-limit `POST /auth/portal/*`, `/admin/portal-users*` and
   `/api/auth/portal/status` to ~20/min/IP, bot-fight on, TLS Full (strict), origin lock still in
   place (see `RELEASE.md` / `render.yaml`).

If `PORTAL_JWT_SECRET` is empty the gateway returns `503 portal_auth_unavailable` for login; it never
falls back to the legacy Supabase secret. On boot the gateway logs `portal_auth=enabled|disabled`
plus `portal_tables=ok|partial|missing` so causes **C/D** are visible in the Render logs in seconds
(`partial` names the next migration: `0033` for scoped roles, `0038` for session lifetimes). A
failing portal query also logs one sanitized line — `portal_error op=<site> sqlstate=<code>`
plus `table|column|constraint=<name>` — never query values, hosts or secrets.

## 2. Provision the superadmin accounts (one-time)

Generate each hash locally with the **same** `PORTAL_PEPPER` the gateway uses. The password is read
from stdin; the tool prints only the PHC hash.

```bash
cd server/gateway
PORTAL_PEPPER='<the render value>' go run ./tools/hash-password < /path/to/password.txt
# or: read -rs PW && printf '%s' "$PW" | PORTAL_PEPPER='…' go run ./tools/hash-password
```

Run it **twice** (once per account). Then in the Supabase SQL editor paste the two hashes and the
out-of-band emails (do not save this snippet anywhere in the repo):

```sql
insert into admins.portal_users
  (user_id, email, display_name, password_hash, role, active, must_change)
values
  ('pu-super-1', '<email-1>', 'Faazio Control', '<phc-hash-1>', 'SUPER_ADMIN', true, false),
  ('pu-super-2', '<email-2>', 'Faazio Ops',     '<phc-hash-2>', 'SUPER_ADMIN', true, false)
on conflict (user_id) do update
  set email = excluded.email,
      display_name = excluded.display_name,
      password_hash = excluded.password_hash,
      role = 'SUPER_ADMIN',
      seller_id = null,
      state_code = null,
      active = true,
      must_change = false,
      failed_attempts = 0,
      locked_until = null,
      updated_at = now();
```

`must_change=false` for `SUPER_ADMIN`: superadmins are never confined, so the seeded password stays
valid until they voluntarily rotate it at `/security`. Forced rotation (`must_change=true`) is
reserved for scoped `SELLER` / `STATE_ADMIN` credentials, where the confinement stops a leaked
temporary password from reaching the control plane. Existing superadmin rows are repaired by
migration `0034_portal_superadmin_no_force.sql`.

Verify:

```bash
curl -sS -X POST "$GATEWAY/auth/portal/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"<email-1>","password":"<initial-password>"}' | jq '{tokenType,expiresIn,user}'
curl -sS "$GATEWAY/auth/portal/me" -H "Authorization: Bearer <accessToken>" | jq
# SUPER_ADMIN-only proof:
curl -sS "$GATEWAY/admin/portal-users" -H "Authorization: Bearer <accessToken>" | jq '.users | length'
```

## 3. Issue seller / state-admin logins

A signed-in superadmin uses **Portal credentials** (`/admin/super/credentials`) to create a login:

- role `SELLER` → requires a real `seller_id` (the gateway checks `sellers.sellers`);
- role `STATE_ADMIN` → requires a 2-letter `state_code` (`^[A-Z]{2}$`);
- email, display name and a temporary password (≥12 chars, not a common value);
- the row starts `active=true`, `must_change=true`, and the token carries the scope.

For **state admins** the entry point is **State admins** (`/admin/super/state-admins`): one form
creates the roster row **and** the login atomically (`issueLogin` default ON, `POST /state-admins`,
`0036`). `must_change` is locked `true`, so the temporary password is single-use. A duplicate
**email** (portal/roster — case-insensitive) is hard-blocked with a role-specific `409`; a duplicate
**phone** (seller/roster — digit-normalized) is a **soft warning** (`201 warnings[]`, amber UI) —
shared/SME lines are allowed, never blocked. The page shows the copyable temporary password once.
`issueLogin:false` pre-provisions a roster-only row (No login badge, one-click issue later).

The holder signs in at `/login`, is forced to `/security` to rotate the password, then lands in
`seller` or `/admin/state`. Deactivate/reactivate from the same page; resetting a password revokes
every existing refresh session and forces another change.

Equivalent API (superadmin bearer only): `GET|POST /admin/portal-users`,
`PUT /admin/portal-users/{id}` (`{active}`), `PUT /admin/portal-users/{id}/password`
(`{newPassword, forceChange?}`). A reset defaults to `forceChange=true` for `SELLER` / `STATE_ADMIN`
and `false` for `SUPER_ADMIN`; the optional `forceChange` overrides either way. Any active superadmin
may reset any role, including another superadmin — no OTP/mail, effect is immediate (sessions are
revoked). Deactivating a superadmin is refused (`last_super_admin`) when it would leave zero active
superadmins. Do not create `SUPER_ADMIN` rows from this surface; use §2.

## 4. Rotate a superadmin password (operator-initiated)

Use this when a superadmin loses access or a scheduled rotation is due. The user can also rotate from
`/security`.

1. Generate a new hash with the tool (§2) using the current `PORTAL_PEPPER`.
2. Update the row (superadmins are not confined, so `must_change=false`):

```sql
update admins.portal_users
   set password_hash = '<new-phc-hash>',
       must_change = false,
       failed_attempts = 0,
       locked_until = null,
       password_changed_at = now(),
       updated_at = now()
 where user_id = 'pu-super-1';

update admins.portal_sessions
   set revoked_at = now()
 where user_id = 'pu-super-1' and revoked_at is null;
```

3. Communicate the temporary password out-of-band (never email/commit/log it).

## 5. Unlock a locked account

Five consecutive failures set `locked_until = now() + 15 minutes` (durable in Postgres). The lock
expires on its own; to unlock immediately:

```sql
update admins.portal_users
   set failed_attempts = 0, locked_until = null, updated_at = now()
 where user_id = '<user-id>';
```

Valkey counters (`faazio:v1:auth:login:{ip,email}:*`) are a rolling 60-second window and need no
manual action.

## 6. Session lifetimes (GCP-style, migration `0038`)

Refresh families behave like `accounts.google.com` sessions — active operators stay signed in
forever, but a leaked/abandoned family still dies. Policy lives in
`server/gateway/internal/portal/tokens.go`; per-row state lives on `admins.portal_sessions`.

| Lifetime | Value | Gate | Effect when hit |
|---|---|---|---|
| Access | 15 min | JWT `exp` | proxy mounts a silent refresh, never a login wall |
| Idle (sliding) | 30 d | `expires_at` | reset on every rotation; lapsed → `401 session_expired_idle`, **this device only** |
| Absolute (hard cap) | 180 d | `absolute_expires_at` | set at login, **never** extended; hit → `401 session_expired_absolute`, family revoked |
| Reuse grace | 30 s | `reuse_grace_until` | replay *inside* → idempotent sibling (`PORTAL_REFRESH_GRACE`, `X-Refresh-Reused`); replay *after* → `401 invalid_refresh_reuse`, family revoked |

Rotation consumes the presented row atomically (`used_at`, `reuse_grace_until=now+30s`,
`rotated_to_hash=<child>` in one `UPDATE ... WHERE used_at IS NULL ...`) and inserts the child under
the same family + `absolute_expires_at`. The 30 s grace is what makes two tabs / a concurrent
gateway-proxy refresh **not** look like theft (the old `used_at → RevokeFamily` nuked both tabs —
that was the original F1 bug). Grace and family-revoke behaviour is unit-tested in
`internal/portal/refresh_test.go`.

Operationally relevant:

- A `PORTAL_REFRESH_GRACE` audit event is **expected** under concurrent refresh (two tabs, a retry
  racing a proxy rotation) — it is not an incident. A `PORTAL_REFRESH_REUSE` after the grace window,
  or a `session_expired_absolute` at exactly ~180 d from login, is the signal to look closer.
- The sweeper (P4.1 backlog) deletes `portal_sessions` where `revoked_at < now() - 7d OR
  absolute_expires_at < now() - 7d`, so `absolute_expires_at` sportingly serves as the GC index
  (`portal_sessions_absolute_idx`).

## 7. Incident: revoke all sessions for a user

```sql
update admins.portal_sessions
   set revoked_at = now()
 where user_id = '<user-id>' and revoked_at is null;
```

Access tokens are stateless and live at most 15 minutes. To kill them immediately, add their `jti`
keys to the denylist via your Valkey client (never `KEYS` in production):

```bash
valkey-cli --scan --pattern 'faazio:v1:auth:deny:*'
```

If a refresh token was suspected stolen, the replay path already revokes the whole family; the SQL
above is the manual equivalent. Note `PORTAL_REFRESH_GRACE` (a replay inside the 30 s reuse window)
is a normal two-tab race, **not** a theft signal — see §6.

## 8. Rotate `PORTAL_JWT_SECRET` / `PORTAL_PEPPER`

- `PORTAL_JWT_SECRET`: set the new value on Render and roll the deploy. Every access token minted with
  the old secret stops verifying immediately; refresh tokens still work (they are opaque) and mint
  new access tokens. Users may see one silent refresh.
- `PORTAL_PEPPER`: **breaking**. Set the new pepper, then re-provision every account with a freshly
  generated hash (§2 for superadmins, password reset for the rest) in the same maintenance window.
  Existing hashes cannot be verified with a new pepper.

## 9. Rollback

- Portal only: redeploy the previous portal build; portal auth is the only mode, so there is no mock
  fallback to switch back to.
- Gateway only: an older binary ignores `/auth/portal/*` and `/admin/portal-users`; the tables can stay.
  `0038` is additive — reverting the binary leaves the new columns unused and the pre-grace behaviour
  (used token → family revoke) intact.
- Full abandon: `update admins.portal_users set active = false;` (keep the audit history). Only drop
  the tables if you are permanently removing the feature.

## 10. Audit + observability

Every outcome writes one `admins.audit_logs` row (actor = the signed-in superadmin for credential
changes, the affected user for their own login/password events; entity `admins.portal_users`,
entity id = user id, `after = {result, ipHash}` — never a password or token):

`PORTAL_LOGIN_SUCCESS`, `PORTAL_LOGIN_FAIL`, `PORTAL_LOGIN_LOCKED`, `PORTAL_REFRESH`,
`PORTAL_REFRESH_GRACE` (replay inside the reuse window — expected under concurrent refresh),
`PORTAL_REFRESH_EXPIRED` (idle or absolute-cap hit), `PORTAL_REFRESH_REUSE` (replay after grace —
theft signal), `PORTAL_LOGOUT`, `PORTAL_PASSWORD_CHANGE`, `PORTAL_USER_CREATE`,
`PORTAL_USER_UPDATE`, `PORTAL_USER_PASSWORD_RESET`.
