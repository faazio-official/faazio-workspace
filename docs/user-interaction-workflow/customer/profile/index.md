# Customer profile — domain index

**Status:** Partial (core profile + addresses + rewards shipped; `RateVendor`, `DeleteAccount`,
`RequestDataDeletion`, `Notifications` are documented only as coverage gaps)
**Routes:** `MainTabs` → `You` (`AccountScreen.tsx`), `You` pushed (`YouScreen.tsx`), `UserDetails`,
`SavedAddresses`, `DeleteAccount`, `RequestDataDeletion`, `Notifications`, `FaazioRewards`,
`RateVendor`, `Theme`
**Trigger:** Tapping the You tab or an account row.

## Flows

| Flow | Doc |
|---|---|
| Profile details | [user-details.md](./user-details.md) |
| Saved addresses | [saved-addresses.md](./saved-addresses.md) |
| Rewards ledger | [rewards-ledger.md](./rewards-ledger.md) |
| Rate vendor | [rate-vendor.md](./rate-vendor.md) |
| Appearance (theme) | [theme.md](./theme.md) |

## Account surfaces

- `AccountView.tsx` is shared by the tab (`AccountScreen`) and pushed (`YouScreen`).
- Account nav rows come from `useAccountNav` → `GET /account-nav` → `accounts.nav_defaults`
  (universal rows) + `accounts.nav` (per-user overrides). Groups whose effective rows are empty are
  omitted, and the client filters empty groups defensively; there is no `@data` runtime fallback.
- **Appearance** is a client-side Preferences row added after the server groups (the server catalog
  is untouched). It opens `ThemeScreen` → `useThemeStore` → AsyncStorage `faazio.theme`; no
  gateway/DB read or write. See [theme.md](./theme.md).
- Profile details: [`UserDetailsScreen` → `getProfile` / `getDetails`](./user-details.md) →
  `accounts.profile` / `accounts.details`.
- Delete account / partial data deletion: `DeleteAccountScreen` / `RequestDataDeletionScreen` →
  `DELETE /users/me`, `POST /users/me/data-deletion` → `checkout`/`accounts` erasure paths.
- Notifications: `NotificationsScreen` → `GET /notifications`, `POST /notifications/{id}/read`,
  `POST /notifications/read-all` → `notifications.outbox`.

## State

- `useAuthStore` — session and sign-out.
- `useRewardsStore` — rewards summary.
- `useFavoriteStore` — favourites (Favourites surface, not the account screens).
- `useThemeStore` / `useThemeMode` — appearance preference (`light`/`dark`/`auto`, default
  `light`) and the resolved palette; device-local, no server sync.

## Data path

- `getAccountNav`, `getProfile`, `getDetails` → `GET /account-nav`, `/profile`, `/profile/details` →
  `accounts.*` (nav: `accounts.nav_defaults` + `accounts.nav`).
- `gateway.getMembership` / `getOrderStatus` exist on the client but no profile screen calls them.
- No `@data` account rows are substituted on a live read failure.
- Appearance writes only AsyncStorage `faazio.theme`; it is not part of the account API.

## Success / error / empty

- **Success:** server account rows render (four titled groups with real destinations).
- **Error:** honest retry; no fixture profile/order rows.
- **Empty:** empty notifications/orders show honest empty states; an empty nav projection shows the
  "No account options available" retry state, never a blank or fabricated menu.
- **Appearance:** always available (client-side); storage failure keeps the Light default.

## Known gaps

- `DeleteAccount`, `RequestDataDeletion` and `Notifications` exist in code but have no dedicated flow
  page yet; they are tracked in [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md) → "Documentation
  coverage gaps". This is why the domain index is **Partial**.
- `RateVendor` is documented at [rate-vendor.md](./rate-vendor.md).
- Appearance (theme) is shipped, but **dark screen coverage is partial** — the themed shell and
  Account surfaces are converted; remaining light literals are listed in [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).
- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/mobile-app.md` (account/profile)
- `docs/architecture/monolith-breakdown.md` (checkout row)
- `data/DATA_CONTROL.md` (`@data/account`)
