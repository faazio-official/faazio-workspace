# Portal Superadmin Auth — provisioning, rotation, unlock, revoke

> Gateway-native email+password sign-in for the **two SUPER_ADMIN** Partner Portal accounts.
> Authority: `docs/architecture/web-portal.md` → "Portal superadmin auth",
> `db-schema.md` §12.18, `monolith-breakdown.md` §1 (`portal auth` row).
>
> Seller/state-admin password login, self-signup, email password-reset and mobile auth are
> **out of scope**. Never commit a password, hash, email list or secret — the SQL below is run in the
> Supabase SQL editor, not in a migration.

## 1. What must exist before the first login

1. Migration `server/supabase/migrations/0032_portal_users.sql` applied (creates
   `admins.portal_users` + `admins.portal_sessions`). Deploy order: **migration first**, then the
   gateway, then the portal.
2. Gateway env (Render dashboard — never in the repo):
   - `PORTAL_JWT_SECRET` — `openssl rand -base64 48` (≥256-bit HS256 signing key).
   - `PORTAL_PEPPER` — `openssl rand -base64 32` (server-side HMAC pepper; **changing it invalidates
     every existing password hash**).
   - `AUTH_DISABLED=false`, `ALLOWED_ORIGINS=https://<portal-origin>` (exact, no `*`).
3. Portal env (Vercel): `NEXT_PUBLIC_AUTH_MODE=portal`,
   `NEXT_PUBLIC_GATEWAY_URL=https://<gateway-origin>`.
4. Cloudflare WAF: rate-limit `POST /auth/portal/*` to ~20/min/IP, bot-fight on, TLS Full (strict),
   origin lock still in place (see `RELEASE.md` / `render.yaml` hardening notes).

If `PORTAL_JWT_SECRET` is empty the gateway returns `503 portal_auth_unavailable` for login; it never
falls back to the legacy Supabase secret.

## 2. Provision the two accounts (one-time)

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
  ('pu-super-1', '<email-1>', 'Faazio Control', '<phc-hash-1>', 'SUPER_ADMIN', true, true),
  ('pu-super-2', '<email-2>', 'Faazio Ops',     '<phc-hash-2>', 'SUPER_ADMIN', true, true)
on conflict (user_id) do update
  set email = excluded.email,
      display_name = excluded.display_name,
      password_hash = excluded.password_hash,
      active = true,
      must_change = true,
      failed_attempts = 0,
      locked_until = null,
      updated_at = now();
```

`must_change=true` is mandatory for the initial shared password: the portal redirects the first
sign-in to `/admin/super/security`, which rotates the password, clears `must_change` and revokes every
session.

Verify:

```bash
curl -sS -X POST "$GATEWAY/auth/portal/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"<email-1>","password":"<initial-password>"}' | jq '{tokenType,expiresIn,user}'
curl -sS "$GATEWAY/auth/portal/me" -H "Authorization: Bearer <accessToken>" | jq
# SUPER_ADMIN-only proof:
curl -sS "$GATEWAY/admin/sdui/home" -H "Authorization: Bearer <accessToken>" | jq '.layoutId'
```

## 3. Rotate a password (operator-initiated)

Use this when a superadmin loses access or a scheduled rotation is due. The user can also rotate from
`/admin/super/security`.

1. Generate a new hash with the tool (§2) using the current `PORTAL_PEPPER`.
2. Update the row and force a change on next login:

```sql
update admins.portal_users
   set password_hash = '<new-phc-hash>',
       must_change = true,
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

## 4. Unlock a locked account

Five consecutive failures set `locked_until = now() + 15 minutes` (durable in Postgres). The lock
expires on its own; to unlock immediately:

```sql
update admins.portal_users
   set failed_attempts = 0, locked_until = null, updated_at = now()
 where user_id = 'pu-super-1';
```

Valkey counters (`faazio:v1:auth:login:{ip,email}:*`) are a rolling 60-second window and need no
manual action.

## 5. Incident: revoke all sessions for a user

```sql
update admins.portal_sessions
   set revoked_at = now()
 where user_id = 'pu-super-1' and revoked_at is null;
```

Access tokens are stateless and live at most 15 minutes. To kill them immediately, delete their
denylist namespace in Valkey (the next verify then passes — only do this if you are also rotating the
password **and** the access TTL has elapsed; otherwise add the specific jti keys via your Valkey
client):

```bash
# List/inspect (never KEYS in production):
valkey-cli --scan --pattern 'faazio:v1:auth:deny:*'
```

If a refresh token was suspected stolen, the replay path already revokes the whole family; the SQL
above is the manual equivalent.

## 6. Rotate `PORTAL_JWT_SECRET` / `PORTAL_PEPPER`

- `PORTAL_JWT_SECRET`: set the new value on Render and roll the deploy. Every access token minted with
  the old secret stops verifying immediately; refresh tokens still work (they are opaque) and mint
  new access tokens. Users may see one silent refresh.
- `PORTAL_PEPPER`: **breaking**. Set the new pepper, then re-provision every account with a freshly
  generated hash (§2) in the same maintenance window. Existing hashes cannot be verified with a new
  pepper.

## 7. Rollback

- Portal only: set `NEXT_PUBLIC_AUTH_MODE=mock` on Vercel (demo directory returns) and redeploy.
- Gateway only: an older binary ignores `/auth/portal/*`; the tables can stay.
- Full abandon: `update admins.portal_users set active = false;` (keep the audit history). Only drop
  the tables if you are permanently removing the feature.

## 8. Audit + observability

Every outcome writes one `admins.audit_logs` row (actor `SUPER_ADMIN`, entity
`admins.portal_users`, entity id = user id, `after = {result, ipHash}` — never a password or token):

`PORTAL_LOGIN_SUCCESS`, `PORTAL_LOGIN_FAIL`, `PORTAL_LOGIN_LOCKED`, `PORTAL_REFRESH`,
`PORTAL_REFRESH_REUSE`, `PORTAL_LOGOUT`, `PORTAL_PASSWORD_CHANGE`.
