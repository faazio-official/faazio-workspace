# Seller team invite acceptance

**App / route:** portal `/accept-invite?token=…` (`app/accept-invite/page.client.tsx`)
**Status:** Shipped (public page; no portal session required)
**Trigger:** The shop owner creates/resends an invite in `/seller/settings` → Sub-users and shares the
generated link out of band.

## Steps

1. The invitee opens the link. The page reads `token` from the query string (client-side) and shows a
   **Choose a password** form (password + confirm).
2. Client validation: ≥12 characters and the two fields match.
3. Submit calls `acceptSubUserInvite(token, password)` → same-origin
   `/api/auth/portal/accept-invite` → gateway `POST /seller/sub-users/accept` (public; the token is
   the capability). The page shows "Activating...".
4. The gateway hashes the token and resolves a live `PENDING_INVITE` row whose `invite_expires_at >
   now()` (`sellers.sub_users`). It then mints a scoped portal credential in `admins.portal_users`
   (`role=SELLER`, `seller_id`, `sub_role=STAFF|VIEWER`, `sub_user_id`, `must_change=false`) with the
   invitee's chosen password (Argon2id + pepper), and atomically flips the roster row to `ACTIVE`
   (`accepted_at`, `portal_user_id`) **clearing the token hash so the link is single-use**.
5. On success the page shows **Account activated** + a link to `/login`. The invitee signs in with
   their email and the password they just set.

## Authorization boundary (server-enforced)

The sub-user login keeps `app_role=SELLER` (so the existing console routes/UI work) and carries a
`sub_role` claim minted from the credential, never from the client:

- **Owner** (`sub_role` empty) — everything.
- **STAFF** — full seller console except owner-only actions: sub-user roster, alert preferences,
  business profile, payout account, sign-in email.
- **VIEWER** — read-only: `auth.EnforceSubUserReadOnly` rejects every non-GET/HEAD/OPTIONS request
  outside `/auth/portal/*` (so they can still rotate their own password, refresh and sign out).

`auth.RequireSellerOwner` guards the owner-only routes; the Settings page also hides those tabs for a
sub-user and shows a role banner.

## State

- Local page state only: `token`, `password`, `confirm`, `error`, `busy`, `done`. No portal store
  writes and no hydration (the invitee has no session yet).
- The signed-in sub-user later sees `session.subRole` from `GET /auth/portal/me`; the store's seller
  slices hydrate normally (scoped by the JWT `seller_id`).

## Data path

`acceptSubUserInvite()` → `/api/auth/portal/accept-invite` (public Next route) → gateway
`POST /seller/sub-users/accept`:

- `sellers.sub_users`: token hash lookup (`invite_token_hash`), expiry check, then
  `status='ACTIVE'`, `accepted_at`, `portal_user_id`, token cleared (0098).
- `admins.portal_users`: one `SELLER` credential with `sub_role`/`sub_user_id` (0098).
- Audit `SUBUSER_ACCEPT` (no token, password or raw email in the log).
- A DB trigger mirrors `portal_users.last_login_at` onto the roster row on each later login.

## Success / error / empty

- **Success:** credential minted, roster `ACTIVE`, page links to `/login`.
- **Error:** `weak_password` → inline policy copy; `email_in_use` (the email gained a login after the
  invite) → ask the owner for a new invite; `invite_invalid`/expired/already used → ask the owner to
  resend. A replay of a consumed token is refused (`409 invite_invalid`).
- **Empty/invalid:** missing token shows "This invite link is invalid" and the submit stays disabled.

## Linked docs

- `docs/user-interaction-workflow/seller/web-portal/settings.md` (owner side)
- `docs/architecture/web-portal.md`
- `docs/architecture/db-schema.md` (`sellers.sub_users`, `admins.portal_users`)
- `server/supabase/migrations/0098_sub_user_invites.sql`