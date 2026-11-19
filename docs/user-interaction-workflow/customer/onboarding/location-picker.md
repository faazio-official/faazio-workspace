# Location picker (customer)

**App / route:** customer · `Location` (`src/features/auth/LocationScreen.tsx`)
**Status:** Shipped
**Trigger:** After language selection; on an authenticated cold start with no usable origin
(`useLocationStore.status === 'idle'`); or any time the user taps the Home location chip / the
"Enter address" action in the Home location nudge.

## Steps

1. A returning user with `useLocationStore.address` starts in `manual`; a first-time user starts in
   `request`.
2. **Primer (pre-permission):** the `request` step shows a benefit card ("Find stores delivering
   near you") plus "Allow location access" and "Enter location manually".
   - **Allow:** calls `requestAndRefreshLocation()` — high-accuracy fix + reverse geocode.
   - **Enter location manually:** skips the OS dialog entirely and goes to `manual`.
   - **First denial (Android):** inline error; the manual path stays available and a later tap can
     show the OS dialog again.
   - **Blocked (iOS "Don't Allow", Android "Don't ask again", Location Services off):** the OS will
     never show the permission dialog again. The screen shows a Settings instruction, opens the
     Settings app via `Linking.openSettings()`, and the manual path stays available.
3. **Manual:** `usePlaceAutocomplete` searches places; `resolvePlaceLocation(placeId)` resolves the
   selected suggestion to coordinates + address.
4. Selecting a place or a confirmed fix calls `useLocationStore.setFix(...)` — `source: 'gps'` for
   the GPS path, `source: 'manual'` for a picked area — and moves to `loader`.
5. After a short confirmation dwell, the screen navigates to `MainTabs` only when
   `status === 'ready'` and the fix is not `(0, 0)`. Otherwise it returns to `manual` with an error.

## Resume-time permission detection

`useLiveLocation` (mounted once in `App.tsx`) re-reads the native state on every `AppState` →
`active`:

- `getLocationAuthorizationStatus()` — the app grant.
- `isLocationServicesEnabled()` — the OS Location Services master switch (native
  `FaazioGeocoder` on iOS/Android).

A user who enabled location in the OS Settings app while Faazio was closed is detected on the next
foreground: the store flips to granted and a silent coarse fix runs, so the nearby feeds re-sort with
no restart and no second OS prompt. A manual origin (`source: 'manual'`) is never silently replaced
by a GPS fix — the grant is adopted, the chosen address stays the origin.

## Blocked / denied users

`denied` and `blocked` are non-fatal: `MainTabs` still opens and `HomeTabScreen` shows a dismissible
banner ("Location following is off") with **Open Settings** (deep link to the OS screen) and
**Enter address** (`Location`) actions. No screen is held behind a location lockout.

## State

- `useLocationStore` (`src/state/locationStore.ts`) — `status` (`idle`/`loading`/`ready`/`denied`/
  `blocked`), `source` (`gps`/`manual`), foreground-only fix, permission + services flags, persisted
  coordinate/address label/status.
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

- Places availability depends on a valid API key; see `docs/RUNBOOKS/TROUBLESHOOTING.md`.
- Permission and services state are read through the local `FaazioGeocoder` native module
  (`getLocationAuthorizationStatus`, `isLocationServicesEnabled`, `geocodeAddress`,
  `reverseGeocode`). A native rebuild (CI) is required when this module changes.

## Linked docs

- `docs/architecture/mobile-app.md` (live location + nearby reads)
- `docs/architecture/caching-cloudflare-valkey.md` (geo cache keys)
- `data/DATA_CONTROL.md` (`seedLocation` is `@seed` + `@unused`)
