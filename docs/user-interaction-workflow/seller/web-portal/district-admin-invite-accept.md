# District admin — invite acceptance (set your own password)

**App / route:** portal `/accept-invite/admin?token=…` (`app/accept-invite/admin/page.client.tsx`)
**Status:** Shipped (public page; no portal session required)
**Trigger:** A super admin assigns a district admin in **invite** mode and shares the generated
`/accept-invite/admin?token=…` link out of band.

## Steps

1. The invitee opens the link. The page reads `token` from the query string (client-side) and shows a
   **Set up your admin login** form (password + confirm). A missing token shows an invalid-link notice
   and the submit stays disabled.
2. Client validation: ≥12 characters and the two fields match.
3. Submit calls `acceptDistrictAdminInvite(token, password)` → same-origin
   `/api/auth/portal/accept-admin-invite` → gateway `POST /district-admins/accept-invite` (public; the
   token is the capability). The page shows "Activating...".
4. The gateway hashes the token (SHA-256) and resolves a live `admins.portal_users` row whose
   `invite_status = 'pending'`, `invite_expires_at > now()` and `deleted_at IS NULL`. It hashes the
   chosen password (Argon2id + pepper) and, in one guarded update, sets `password_hash`,
   `must_change = false`, `invite_status = 'active'`, clears `invite_token_hash` /
   `invite_expires_at`, and clears the lockout — so the link is single-use and a concurrent second
   accept loses the race.
5. On success the page shows **You're all set** + a link to `/login`. The admin signs in with their
   email and the password they just set. A pending login cannot sign in before this step (the login
   endpoint returns the generic `invalid_credentials`).

## Authorization boundary (server-enforced)

The route is public by design — the invitee has no portal session yet; the one-time token in the body
is the only authority. It never mints a session itself; the invitee signs in normally afterwards. A
superadmin password reset supersedes an outstanding invite (same columns cleared), so a reset link and
an old invite cannot both be live.

## State

- Local page state only: `token`, `password`, `confirm`, `error`, `busy`, `done`. No portal store
  writes and no hydration (the invitee has no session yet).

## Data path

`acceptDistrictAdminInvite()` → `/api/auth/portal/accept-admin-invite` (public Next route) → gateway
`POST /district-admins/accept-invite`:

- `admins.portal_users`: token-hash lookup (`invite_token_hash`), expiry + pending + live check, then
  `invite_status='active'`, password set, token cleared (`0131`).
- Audit `DISTRICT_ADMIN_INVITE_ACCEPT` (hashed email only — never the token, password or raw email).

## Success / error / empty

- **Success:** login activated, page links to `/login`.
- **Error:** `weak_password` → inline policy copy; `invite_invalid` / expired / already used → ask the
  super admin to resend. A replay of a consumed token is refused.
- **Empty/invalid:** missing token shows "This invite link is invalid" and the submit stays disabled.

## Known gaps

- The invite link is delivered manually (no email/WhatsApp provider in the repo) — see
  [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- [`district-admin-roster.md`](./district-admin-roster.md) (super-admin side)
- `docs/architecture/db-schema.md` §12.46 (`admins.portal_users` invite columns)
- `docs/architecture/server-gateway-plan.md` (portal identity writes)
