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
| **D** | "could not read the portal credential tables" | `portal_unavailable` (500) | migration `0033` (or `0032`) not applied | apply the migration, then redeploy |

```bash
# One browser-able verdict (unauthenticated, rate-limited; hostname only, no secrets):
curl -sS https://<portal-origin>/api/auth/portal/status | jq

# Gateway proof the auth stack is up (bad credentials ⇒ 401, never 503):
curl -sS -X POST "$GATEWAY/auth/portal/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"x@y.zz","password":"nope"}' | jq '{error,code}'
```

## 1. What must exist before the first login

1. Migrations `server/supabase/migrations/0032_portal_users.sql` +
   `0033_portal_roles.sql` + `0034_portal_superadmin_no_force.sql` applied (credential/session store;
   role + scope; superadmin confinement repair). Deploy order:
   **migrations first**, then the gateway, then the portal. In local compose both are mounted
   automatically; for a **pre-existing** compose volume run `docker compose down -v` (dev only) or
   apply `0033` by hand (`psql -f`) — without it the scoped-role path 500s.
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
plus `portal_tables=ok|partial|missing` so cause **C** is visible in the Render logs in seconds.

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

## 6. Incident: revoke all sessions for a user

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
above is the manual equivalent.

## 7. Rotate `PORTAL_JWT_SECRET` / `PORTAL_PEPPER`

- `PORTAL_JWT_SECRET`: set the new value on Render and roll the deploy. Every access token minted with
  the old secret stops verifying immediately; refresh tokens still work (they are opaque) and mint
  new access tokens. Users may see one silent refresh.
- `PORTAL_PEPPER`: **breaking**. Set the new pepper, then re-provision every account with a freshly
  generated hash (§2 for superadmins, password reset for the rest) in the same maintenance window.
  Existing hashes cannot be verified with a new pepper.

## 8. Rollback

- Portal only: redeploy the previous portal build; portal auth is the only mode, so there is no mock
  fallback to switch back to.
- Gateway only: an older binary ignores `/auth/portal/*` and `/admin/portal-users`; the tables can stay.
- Full abandon: `update admins.portal_users set active = false;` (keep the audit history). Only drop
  the tables if you are permanently removing the feature.

## 9. Audit + observability

Every outcome writes one `admins.audit_logs` row (actor = the signed-in superadmin for credential
changes, the affected user for their own login/password events; entity `admins.portal_users`,
entity id = user id, `after = {result, ipHash}` — never a password or token):

`PORTAL_LOGIN_SUCCESS`, `PORTAL_LOGIN_FAIL`, `PORTAL_LOGIN_LOCKED`, `PORTAL_REFRESH`,
`PORTAL_REFRESH_REUSE`, `PORTAL_LOGOUT`, `PORTAL_PASSWORD_CHANGE`, `PORTAL_USER_CREATE`,
`PORTAL_USER_UPDATE`, `PORTAL_USER_PASSWORD_RESET`.
