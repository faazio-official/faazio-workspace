# Seller settings

**App / route:** portal `/seller/settings` (`app/seller/settings/page.client.tsx`)
**Status:** Shipped — profile, bank, notifications, appearance, **Security** (self-service sign-in
email + password rotation) and the full sub-user invite lifecycle (one-time accept link → credential
→ login → revoke). A sub-user (STAFF/VIEWER) sees only Appearance + Security; owner-only tabs are
hidden and enforced server-side. See `accept-invite.md` for the invitee's side.
**Trigger:** Seller opens `/seller/settings` from the console shell or the Explore menu
(`app/seller/explore/page.client.tsx`).

## Steps

1. `useSellerScope()` supplies `sellerId` (the signed-in portal session's `sellerId`). The page
   renders six underline tabs: Profile, Bank, Notifications, Appearance, Sub-users, Security.
2. **Profile** — read rows come from the hydrated `sellers` slice (`useSeller`). "Edit profile"
   opens inline `TextField`s for business name, owner name, GSTIN, PAN, contact phone and registered
   address; "Save changes" sends **only the fields that changed** to `updateSeller(sellerId, patch)`
   → `PATCH /sellers/{id}` (true partial write — an omitted field is never cleared). An actual change
   to a KYC-bearing field (GSTIN/PAN/address) resets an `ACTIVE` account to `PENDING_REVIEW` for
   re-verification; a non-KYC edit (or an already pending/suspended account) keeps its status. The
   success toast only fires after the gateway accepts the write.
3. **Bank** — `useBankAccount(sellerId)` hydrates the payout account from
   `GET /sellers/{id}/bank-account` on mount (a 404 is an honest "not added"). With no account it
   shows an empty state + "Add settlement account"; with one it shows the masked rows + "Change
   account". The form awaits `upsertBankAccount(sellerId, input)` (masking a full number to the stored
   tail) and only shows success after the `PUT` lands; a rejection rolls back and toasts.
4. **Notifications** — `useNotificationPreferences()` reads the local preference map; each `Toggle`
   writes through `updateNotificationPreferences({ [kind]: v })`.
5. **Appearance** — `ThemeSegmentedControl` persists the browser theme via
   `src/lib/theme.ts` + `localStorage["faazio.theme"]` (unchanged; DB-independent).
6. **Sub-users (owner only)** — `useSubUsers(sellerId)` lists the staff roster hydrated from
   `GET /seller/sub-users`; the invite form (name, email, role Staff/Viewer) awaits `inviteSubUser` →
   `POST /seller/sub-users`. The server mints the roster row **and a one-time accept token**; the page
   shows a copyable `/accept-invite?token=…` link (valid 7 days, single use). Duplicate live emails
   return `409 sub_user_exists`; an email that already has any portal login returns `409 email_in_use`.
   Each `PENDING_INVITE` row has **New link** → `resendSubUserInvite` → `POST /seller/sub-users/{id}/resend`
   (rotates the token; the old link stops working) and **Revoke** → `removeSubUser` →
   `DELETE /seller/sub-users/{id}` (marks `REVOKED`, deactivates the linked credential and revokes its
   sessions). An accepted invite flips to `ACTIVE` and the roster shows `last_login_at`.
7. **Security** — shows the signed-in email (`useSession()?.email`) and two self-service credential
   rotations, no admin involvement (email change is owner-only; a sub-user can rotate the password
   they chose at accept, but their sign-in email is managed by the owner):
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
- Sub-users: `fetchSubUsers()` → `GET /seller/sub-users`, `inviteSubUser()` → `POST /seller/sub-users`
  (returns `inviteToken`), `resendSubUserInvite()` → `POST /seller/sub-users/{id}/resend`,
  `removeSubUser()` → `DELETE /seller/sub-users/{id}` → `sellers.sub_users` (0097 + 0098 lifecycle
  columns: `invite_token_hash`, `invite_expires_at`, `accepted_at`, `portal_user_id`, `last_sent_at`).
  Accept is public: `acceptSubUserInvite(token, password)` → `/api/auth/portal/accept-invite` → gateway
  `POST /seller/sub-users/accept` → mints `admins.portal_users` (`role=SELLER`, `sub_role`, `seller_id`,
  `sub_user_id`) and flips the roster `ACTIVE`.
- Appearance: `src/lib/theme.ts` → `localStorage["faazio.theme"]` (no server).
- Security — email: `changePortalEmail()` → `PUT /api/auth/portal/email` → gateway
  `PUT /auth/portal/email` → `admins.portal_users.email` (existing column + `portal_users_email_lower_uniq`
  unique index; **no migration**). The gateway re-verifies `password_hash`, then revokes
  `admins.portal_sessions` for the user and denylists the access `jti` (`faazio:v1:auth:deny:{jti}`).
- Security — password: `changePortalPassword()` → `PUT /api/auth/portal/password` → gateway
  `PUT /auth/portal/password` → `admins.portal_users.password_hash` (Argon2id); revokes sessions +
  denylists the `jti`.
- Notification delivery: `notifications.EnqueueSeller` joins `sellers.notification_preferences` and
  gates at enqueue time by kind (`SELLER_ORDER_NEW`→`new_order`, `SELLER_SLA_BREACH`→`sla_breach`,
  `SELLER_LOW_STOCK`→`low_stock`, `SELLER_CAMPAIGN`→`campaigns`; absent row = on). Only the seller
  **owner** login receives account alerts (sub-user logins are excluded).
- Writes are honest: profile, bank, invite, resend, revoke and accept await their gateway write and
  only then toast success (a rejection rolls back the store and toasts). Notification toggles use
  `pushWrite` (optimistic + rollback/toast) since the switch is a single small flag.

## Success / error / empty

- **Success:** profile, bank, notification, sub-user roster/invite and theme changes all persist; an
  invitee can accept the link, set a password and sign in; Security rotates the sign-in email/password
  and re-authenticates in place without a manual `/login` round-trip.
- **Loading:** profile and bank show pulse skeletons while the seller row / payout account hydrate;
  Security buttons show "Changing…"/"Saving…" while busy.
- **Error:** a rejected write rolls back and shows a `sonner` toast with the server message; Security
  maps `invalid_current_password`, `weak_password`, `email_taken` and `email_unchanged` to inline
  copy. If the in-place re-auth fails, the page signs out and routes to `/login`.
- **Empty:** no payout account → "Add settlement account"; no sub-users → invite prompt.

## Known gaps

- **Invite delivery is a manual link:** there is no transactional-email provider in the repo, so the
  owner copies the `/accept-invite?token=…` link and shares it (WhatsApp/email out of band). Adding a
  mail provider later only changes delivery, not the lifecycle.
- **`lowStock` and `campaigns` toggles have no producer yet:** `newOrder` and `slaBreach` are wired to
  real events; the other two persist and are honoured by the enqueue gate the moment a producer emits
  `SELLER_LOW_STOCK`/`SELLER_CAMPAIGN`.

## Linked docs

- `docs/architecture/web-portal.md`
- `docs/architecture/monolith-breakdown.md` (sellers/directory context)
- `docs/architecture/db-schema.md` (`sellers.bank_accounts`, §12.36 `sellers.notification_preferences`,
  `sellers.sub_users`)
- `server/supabase/migrations/0097_seller_settings.sql`
- `server/supabase/migrations/0098_sub_user_invites.sql`
- `docs/user-interaction-workflow/seller/web-portal/accept-invite.md`