# Customer profile — domain index

**Status:** Shipped
**Routes:** `MainTabs` → `You` (`AccountScreen.tsx`), `You` pushed (`YouScreen.tsx`), `UserDetails`,
`SavedAddresses`, `DeleteAccount`, `RequestDataDeletion`, `Notifications`, `FaazioRewards`
**Trigger:** Tapping the You tab or an account row.

## Flows

| Flow | Doc |
|---|---|
| Saved addresses | [saved-addresses.md](./saved-addresses.md) |
| Rewards ledger | [rewards-ledger.md](./rewards-ledger.md) |

## Account surfaces

- `AccountView.tsx` is shared by the tab (`AccountScreen`) and pushed (`YouScreen`).
- Account nav rows come from `useAccountNav` → `GET /account-nav` → `accounts.nav`.
- Profile details: `UserDetailsScreen` → `getProfile` / `getDetails` → `accounts.profile` /
  `accounts.details`.
- Delete account / partial data deletion: `DeleteAccountScreen` / `RequestDataDeletionScreen` →
  `DELETE /users/me`, `POST /users/me/data-deletion` → `checkout`/`accounts` erasure paths.
- Notifications: `NotificationsScreen` → `GET /notifications`, `POST /notifications/{id}/read`,
  `POST /notifications/read-all` → `notifications.outbox`.

## State

- `useAuthStore` — session and sign-out.
- `useRemoteConfigStore` — feature/config copy.
- `useRewardsStore` — rewards summary.
- `useFavoriteStore` — favourites.

## Data path

- `getAccountNav`, `getProfile`, `getDetails`, `getMembership`, `getOrderStatus` → `GET /account-nav`,
  `/profile`, `/profile/details`, `/membership`, `/order-status` → `accounts.*`.
- No `@data` account rows are substituted on a live read failure.

## Success / error / empty

- **Success:** server account rows render.
- **Error:** honest retry; no fixture profile/order rows.
- **Empty:** empty notifications/orders show honest empty states.

## Known gaps

- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/mobile-app.md` (account/profile)
- `docs/architecture/monolith-breakdown.md` (checkout row)
- `data/DATA_CONTROL.md` (`@data/account`)
