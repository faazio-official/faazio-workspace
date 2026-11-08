# User profile details

**App / route:** customer · `UserDetails` (`features/profile/UserDetailsScreen.tsx`)
**Status:** Shipped
**Trigger:** "My profile" / account row on the You tab (`YouScreen.tsx` → `UserDetails`).

## Steps

1. `UserDetailsScreen` loads `gateway.getProfile()` and `gateway.getDetails()` in parallel.
2. While loading it shows a spinner; `DETAIL_ICONS` maps each server detail row to an icon.
3. Any detail row can be opened from the account surface; the screen itself is read-only.
4. Back returns to the account screen.

## State

- `useAuthStore` — session / identity (the gateway uses the bearer for both reads).
- Local `profile`, `details`, `loading`, `loadFailed`, `reloadKey`.

## Data path

- `gateway.getProfile()` → `GET /profile` → `accounts.profile`.
- `gateway.getDetails()` → `GET /profile/details` → `accounts.details`.
- No `@data` account rows are substituted on a failed or empty read.

## Success / error / empty

- **Success:** server profile + detail rows render.
- **Error:** honest "unavailable" shell with retry (`reloadKey`); no fixture profile is shown.
- **Empty:** missing detail rows are simply omitted; no fabricated values.

## Known gaps

- None specific to this screen; see [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md) for the profile
  domain's other coverage gaps (`RateVendor`, `DeleteAccount`, `RequestDataDeletion`,
  `Notifications`).

## Linked docs

- [`index.md`](./index.md) (profile domain)
- `docs/architecture/mobile-app.md` (account/profile)
- `docs/architecture/monolith-breakdown.md` (accounts row)
