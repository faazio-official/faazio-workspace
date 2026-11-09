# Seller settings

**App / route:** portal `/seller/settings` (`app/seller/settings/page.client.tsx`)
**Status:** Partial (bank account + appearance are shipped; profile, notification preferences and
sub-users are client-complete but blocked on missing gateway endpoints/tables)
**Trigger:** Seller opens `/seller/settings` from the console shell or the Explore menu
(`app/seller/explore/page.client.tsx`).

## Steps

1. `useSellerScope()` supplies `sellerId` (the signed-in portal session's `sellerId`). The page
   renders five underline tabs: Profile, Bank, Notifications, Appearance, Sub-users.
2. **Profile** — read rows come from the hydrated `sellers` slice (`useSeller`). "Edit profile"
   opens inline `TextField`s for business name, owner name, GSTIN, PAN, contact phone and registered
   address; "Save changes" calls `updateSeller(sellerId, patch)`.
3. **Bank** — `useBankAccount(sellerId)` hydrates the payout account from
   `GET /sellers/{id}/bank-account` on mount (a 404 is an honest "not added"). With no account it
   shows an empty state + "Add settlement account"; with one it shows the masked rows + "Change
   account". The form saves through `upsertBankAccount(sellerId, input)`, which masks a full number
   to the stored tail before sending.
4. **Notifications** — `useNotificationPreferences()` reads the local preference map; each `Toggle`
   writes through `updateNotificationPreferences({ [kind]: v })`.
5. **Appearance** — `ThemeSegmentedControl` persists the browser theme via
   `src/lib/theme.ts` + `localStorage["faazio.theme"]` (unchanged; DB-independent).
6. **Sub-users** — `useSubUsers(sellerId)` lists staff logins; the invite form (name, email, role
   Staff/Viewer) calls `inviteSubUser`, and "Revoke" calls `removeSubUser`.

## State

- `usePortalStore` slices: `sellers` (profile, hydrated from `GET /sellers`), `bankAccounts`
  (hydrated on demand via `useBankAccount`), `subUsers`, `notificationPreferences`.
- Seller scope: `useSellerScope()` → `session.sellerId`.

## Data path

- Bank: `fetchBankAccount()` → `GET /sellers/{id}/bank-account` → `sellers.bank_accounts`;
  `upsertBankAccount()` → `PUT /sellers/{id}/bank-account` → `sellers.bank_accounts` (one row per
  seller; the gateway stores only the masked tail).
- Profile: `updateSeller()` → `PATCH /sellers/{id}` → `sellers.sellers` (**pending gateway handler**).
- Notifications: `updateNotificationPreferences()` → `PUT /seller/notifications/preferences`
  (**pending gateway endpoint/table**).
- Sub-users: `inviteSubUser()` → `POST /seller/sub-users`, `removeSubUser()` →
  `DELETE /seller/sub-users/{id}` (**pending gateway endpoint/table**).
- Appearance: `src/lib/theme.ts` → `localStorage["faazio.theme"]` (no server).
- Writes are optimistic: `pushWrite` rolls back the store and toasts if the gateway rejects, so a
  swallowed change never lingers on screen.

## Success / error / empty

- **Success:** bank saves and theme changes persist; profile/notification/sub-user writes persist
  once their gateway endpoints land.
- **Loading:** profile and bank show pulse skeletons while the seller row / payout account hydrate.
- **Error:** a rejected write rolls back and shows a `sonner` toast with the server message.
- **Empty:** no payout account → "Add settlement account"; no sub-users → invite prompt.

## Known gaps

- Profile, notification-preferences and sub-users still depend on gateway endpoints that do not
  exist yet (no generic `PATCH /sellers/{id}`, no `seller.sub_users` or
  `seller.notification_preferences` tables). Until then those writes roll back and toast honestly.
  Tracked in [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/web-portal.md`
- `docs/architecture/monolith-breakdown.md` (sellers/directory context)
- `docs/architecture/db-schema.md` (`sellers.bank_accounts`)