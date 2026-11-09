# Seller settings

**App / route:** portal `/seller/settings` (`app/seller/settings/page.client.tsx`)
**Status:** Shipped (profile, bank, notifications, appearance, sub-users, and **Security** —
self-service sign-in email + password rotation)
**Trigger:** Seller opens `/seller/settings` from the console shell or the Explore menu
(`app/seller/explore/page.client.tsx`).

## Steps

1. `useSellerScope()` supplies `sellerId` (the signed-in portal session's `sellerId`). The page
   renders six underline tabs: Profile, Bank, Notifications, Appearance, Sub-users, Security.
2. **Profile** — read rows come from the hydrated `sellers` slice (`useSeller`). "Edit profile"
   opens inline `TextField`s for business name, owner name, GSTIN, PAN, contact phone and registered
   address; "Save changes" awaits `updateSeller(sellerId, patch)` → `PATCH /sellers/{id}`. A change to
   a KYC-bearing field (GSTIN/PAN/address) resets the account to `PENDING_REVIEW` for re-verification;
   the success toast only fires after the gateway accepts the write.
3. **Bank** — `useBankAccount(sellerId)` hydrates the payout account from
   `GET /sellers/{id}/bank-account` on mount (a 404 is an honest "not added"). With no account it
   shows an empty state + "Add settlement account"; with one it shows the masked rows + "Change
   account". The form saves through `upsertBankAccount(sellerId, input)`, which masks a full number
   to the stored tail before sending.
4. **Notifications** — `useNotificationPreferences()` reads the local preference map; each `Toggle`
   writes through `updateNotificationPreferences({ [kind]: v })`.
5. **Appearance** — `ThemeSegmentedControl` persists the browser theme via
   `src/lib/theme.ts` + `localStorage["faazio.theme"]` (unchanged; DB-independent).
6. **Sub-users** — `useSubUsers(sellerId)` lists the staff roster hydrated from `GET /seller/sub-users`;
   the invite form (name, email, role Staff/Viewer) awaits `inviteSubUser` → `POST /seller/sub-users`
   (the server mints the row id), and "Revoke" awaits `removeSubUser` → `DELETE /seller/sub-users/{id}`
   with an optimistic removal + re-insert on rejection.
7. **Security** — shows the signed-in email (`useSession()?.email`) and two self-service credential
   rotations, no admin involvement:
   - **Change email** — "Change email" opens the seller `Sheet` popup with a **new email** field and a
     **current password** re-auth field. Save calls `changePortalEmail(currentPassword, newEmail)` →
     `PUT /auth/portal/email`. On success the gateway revokes every refresh session and denylists the
     current access token, so the page re-authenticates in place with the new email + the password just
     entered (`signIn(newEmail, currentPassword)` + `hydrateFromGateway()`) and stays on the page.
   - **Change password** — inline fields for **current password**, **new password** and **confirm new
     password**. Save validates ≥12 chars / match / differs from current, then calls
     `changePortalPassword(current, next)` → `PUT /auth/portal/password`. On success the page
     re-authenticates in place with the same email + the new password (`signIn`).

## State

- `usePortalStore` slices: `sellers` (profile, hydrated from `GET /sellers`), `bankAccounts`
  (hydrated on demand via `useBankAccount`), `subUsers` (`GET /seller/sub-users`) and
  `notificationPreferences` (`GET /seller/notifications/preferences`), both hydrated in
  `hydrateFromGateway` for a SELLER session.
- Seller scope: `useSellerScope()` → `session.sellerId`; Security reads the sign-in email from
  `useSession()` (`usePortalStore.session.email`).
- Security form state is local to the page (email sheet: `emailOpen`/`newEmail`/`emailPassword`/
  `emailBusy`/`emailError`; password: `currentPassword`/`newPassword`/`confirmPassword`/
  `passwordBusy`/`passwordError`).

## Data path

- Bank: `fetchBankAccount()` → `GET /sellers/{id}/bank-account` → `sellers.bank_accounts`;
  `upsertBankAccount()` → `PUT /sellers/{id}/bank-account` → `sellers.bank_accounts` (one row per
  seller; the gateway stores only the masked tail).
- Profile: `updateSeller()` → `PATCH /sellers/{id}` → `sellers.sellers` (the handler diffs the change,
  writes `seller_request_history`, and re-queues KYC-bearing edits for review).
- Notifications: `fetchNotificationPreferences()` → `GET /seller/notifications/preferences`,
  `updateNotificationPreferences()` → `PUT /seller/notifications/preferences` →
  `sellers.notification_preferences` (one row per seller; absent row reads as all-on, 0097).
- Sub-users: `fetchSubUsers()` → `GET /seller/sub-users`, `inviteSubUser()` → `POST /seller/sub-users`,
  `removeSubUser()` → `DELETE /seller/sub-users/{id}` → `sellers.sub_users` (0097).
- Appearance: `src/lib/theme.ts` → `localStorage["faazio.theme"]` (no server).
- Security — email: `changePortalEmail()` → `PUT /api/auth/portal/email` → gateway
  `PUT /auth/portal/email` → `admins.portal_users.email` (existing column + `portal_users_email_lower_uniq`
  unique index; **no migration**). The gateway re-verifies `password_hash`, then revokes
  `admins.portal_sessions` for the user and denylists the access `jti` (`faazio:v1:auth:deny:{jti}`).
- Security — password: `changePortalPassword()` → `PUT /api/auth/portal/password` → gateway
  `PUT /auth/portal/password` → `admins.portal_users.password_hash` (Argon2id); revokes sessions +
  denylists the `jti`.
- Writes are optimistic: `pushWrite` rolls back the store and toasts if the gateway rejects, so a
  swallowed change never lingers on screen.

## Success / error / empty

- **Success:** profile, bank, notification, sub-user and theme changes all persist; Security rotates
  the sign-in email/password and re-authenticates in place without a manual `/login` round-trip.
- **Loading:** profile and bank show pulse skeletons while the seller row / payout account hydrate;
  Security buttons show "Changing…"/"Saving…" while busy.
- **Error:** a rejected write rolls back and shows a `sonner` toast with the server message; Security
  maps `invalid_current_password`, `weak_password`, `email_taken` and `email_unchanged` to inline
  copy. If the in-place re-auth fails, the page signs out and routes to `/login`.
- **Empty:** no payout account → "Add settlement account"; no sub-users → invite prompt.

## Known gaps

- None. Every write on this page now has a gateway endpoint + table backing it.

## Linked docs

- `docs/architecture/web-portal.md`
- `docs/architecture/monolith-breakdown.md` (sellers/directory context)
- `docs/architecture/db-schema.md` (`sellers.bank_accounts`, §12.36 `sellers.notification_preferences`,
  `sellers.sub_users`)
- `server/supabase/migrations/0097_seller_settings.sql`