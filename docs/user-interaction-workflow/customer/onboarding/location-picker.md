# Location picker (customer)

**App / route:** customer · `Location` (`src/features/auth/LocationScreen.tsx`)
**Status:** Shipped
**Trigger:** After language selection, or when the saved location is missing/stale.

## Steps

1. A returning user with `useLocationStore.address` starts in `manual`; a first-time user starts in
   `request`.
2. **Request:** `requestAndRefreshLocation()` asks for foreground location permission and a fix.
   Denial or failure shows an inline error and keeps the manual path available.
3. **Manual:** `usePlaceAutocomplete` searches places; `resolvePlaceLocation(placeId)` resolves the
   selected suggestion to coordinates + address.
4. Selecting a place or a confirmed fix calls `useLocationStore.setFix(...)` and moves to `loader`.
5. After a short confirmation dwell, the screen navigates to `MainTabs` only when
   `status === 'ready'` and the fix is not `(0, 0)`. Otherwise it returns to `manual` with an error.

## State

- `useLocationStore` (`src/state/locationStore.ts`) — foreground-only fix, permission status,
  persisted coordinate/address label.
- `useRemoteConfigStore` — supplies the Places API key via `selectPlacesApiKey`.

## Data path

- Device location permission + fix (no server write at this step).
- Places autocomplete uses the configured Places API key (remote config override or bake-time
  default). No fixture coordinates are used as a live location.
- The chosen origin later drives `GET /stores/nearby` / `GET /products/nearby` (Haversine +
  bounding box) and delivery-fee quotes.

## Success / error / empty

- **Success:** `MainTabs`.
- **Permission denied / no fix:** inline message, manual entry remains available.
- **Unresolvable place:** inline message; user can retry or use current location.
- **Empty:** no suggestions → the user can still type/select manually.

## Known gaps

- None specific to this screen. Places availability depends on a valid API key; see
  `docs/RUNBOOKS/TROUBLESHOOTING.md`.

## Linked docs

- `docs/architecture/mobile-app.md` (location + nearby reads)
- `docs/architecture/caching-cloudflare-valkey.md` (geo cache keys)
- `data/DATA_CONTROL.md` (`seedLocation` is `@seed` + `@unused`)
