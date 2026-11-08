# Customer profile — domain index

**Status:** Partial (core profile + addresses + rewards shipped; `RateVendor`, `DeleteAccount`,
`RequestDataDeletion`, `Notifications` are documented only as coverage gaps)
**Routes:** `MainTabs` → `You` (`AccountScreen.tsx`), `You` pushed (`YouScreen.tsx`), `UserDetails`,
`SavedAddresses`, `DeleteAccount`, `RequestDataDeletion`, `Notifications`, `FaazioRewards`,
`RateVendor`
**Trigger:** Tapping the You tab or an account row.

## Flows

| Flow | Doc |
|---|---|
| Profile details | [user-details.md](./user-details.md) |
| Saved addresses | [saved-addresses.md](./saved-addresses.md) |
| Rewards ledger | [rewards-ledger.md](./rewards-ledger.md) |
| Rate vendor | [rate-vendor.md](./rate-vendor.md) |

## Account surfaces

- `AccountView.tsx` is shared by the tab (`AccountScreen`) and pushed (`YouScreen`).
- Account nav rows come from `useAccountNav` → `GET /account-nav` → `accounts.nav`.
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

## Data path

- `getAccountNav`, `getProfile`, `getDetails` → `GET /account-nav`, `/profile`, `/profile/details` →
  `accounts.*`.
- `gateway.getMembership` / `getOrderStatus` exist on the client but no profile screen calls them.
- No `@data` account rows are substituted on a live read failure.

## Success / error / empty

- **Success:** server account rows render.
- **Error:** honest retry; no fixture profile/order rows.
- **Empty:** empty notifications/orders show honest empty states.

## Known gaps

- `DeleteAccount`, `RequestDataDeletion` and `Notifications` exist in code but have no dedicated flow
  page yet; they are tracked in [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md) → "Documentation
  coverage gaps". This is why the domain index is **Partial**.
- `RateVendor` is documented at [rate-vendor.md](./rate-vendor.md).
- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/mobile-app.md` (account/profile)
- `docs/architecture/monolith-breakdown.md` (checkout row)
- `data/DATA_CONTROL.md` (`@data/account`)
