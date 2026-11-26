# Super admin — platform settings, account security, appearance

**App / route(s):** portal `/admin/super/settings` (`app/admin/super/settings/page.client.tsx`)
**Status:** Shipped
**Trigger:** SUPER_ADMIN opens **Operations → Settings** in the Partner Portal.

This page is the superadmin's one settings surface. It absorbed the former standalone **Security**
page (`/admin/super/security`, deleted; the nav entry removed): account security now renders inside
the settings page as a section, next to the platform-wide commercial values and the console theme.

## Steps

1. **Tax & statutory** — the platform TCS percentage (`config.tcsPercent`). It drives the TCS line of
   the settlement maths shown across payouts and invoices.
2. **FaazioCoins** — the earn rate (coins per ₹100) and the redeem rate (₹ per coin), from
   `config.coinEarnRate` / `config.coinRedeemRate`. These are the values the customer app's rewards
   maths reads.
3. **Service levels** — the dispatch SLA in hours (`config.slaHours`); the seller SLA-breach gate uses
   it. *Save settings* confirms the change.
4. **Account security** — the same `AccountSecurity` component as the public `/security` route, embedded
   (`embedded` hides its own `PageHeader`). It shows the signed-in email's password rotation: current
   password, new password (≥ 12 chars), confirm. Save calls `changePortalPassword` →
   `PUT /auth/portal/password`, then re-authenticates in place with the new password
   (`signIn` + `hydrateFromGateway`) and routes to `homeFor(role)`; if the fresh session cannot be
   minted it signs out and lands on `/login`. A SUPER_ADMIN is never forced here (a superadmin sets
   their own temporary password out of band); a scoped role hitting `/security` with `mustChange` is
   shown the "still using a temporary password" banner.
5. **Appearance** — `ThemeSegmentedControl` persists the browser theme via `src/lib/theme.ts` +
   `localStorage["faazio.theme"]` (DB-independent, per browser).

## State

- Local `form` state for the four platform values (TCS %, earn rate, redeem rate, SLA hours), seeded
  from `@/lib/config`.
- `AccountSecurity` owns its own password form state (`currentPassword`/`newPassword`/`confirmPassword`/
  `busy`/`error`).

## Data path

- Platform values: `@/lib/config` baked config (no server write yet — the Save button confirms the
  edit; a gateway-backed `admins.platform_settings` write is a known gap).
- Account security: `changePortalPassword()` → `PUT /api/auth/portal/password` → gateway
  `PUT /auth/portal/password` → `admins.portal_users.password_hash` (Argon2id); the gateway revokes
  `admins.portal_sessions` and denylists the access `jti`. See `docs/user-interaction-workflow/seller/web-portal/settings.md` §Security for the identical seller flow.
- Appearance: `src/lib/theme.ts` → `localStorage["faazio.theme"]` (no server).

## Success / error / empty

- **Success:** the platform values confirm on Save; a password change re-authenticates in place and
  lands on `homeFor(role)`.
- **Error:** the password form maps `weak_password` (≥ 12 chars, not common) and
  `invalid_current_password` to inline copy; a failed in-place re-auth signs out to `/login`.
- **Empty:** not applicable — every section always renders.

## Known gaps

- The platform values are still baked `config` reads; *Save settings* only confirms. A gateway write to
  `admins.platform_settings` (audited) is the next step, matching the credentials/categories pattern.

## Linked docs

- `docs/architecture/web-portal.md` (route map)
- [`settings.md`](./settings.md) — the seller settings page with the same Security component
- [`super-admin-categories.md`](./super-admin-categories.md) — the other superadmin governance surface
