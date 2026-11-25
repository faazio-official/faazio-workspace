# Location picker (customer)

**App / route:** customer · `Location` (`src/features/auth/LocationScreen.tsx`)
**Status:** Shipped
**Trigger:** After language selection; on an authenticated cold start with no usable origin
(`useLocationStore.status === 'idle'`); or any time the user taps the Home location chip / the
"Enter address" action in the Home location nudge.

## Two locations, deliberately

`useLocationStore` (`src/state/locationStore.ts`) keeps **two separate facts**:

- **`deviceFix`** — what the hardware says. Written only by a real GPS read (`setDeviceFix`). It
  keeps updating in the foreground even after the user picks another address, because the checkout
  distance guardrail needs the truth about where the phone is.
- **`activeLocation`** — where the order goes and which feeds sort from (`useLiveOrigin()`). It is
  the only thing sent to the gateway as the delivery origin, and carries
  `source: 'gps' | 'saved' | 'pinned'`.

Collapsing them into one field makes two real flows impossible: ordering to a saved address in
another city, and warning the user that they are nowhere near it. `overrideActive` records a
deliberate choice; while it is set, proximity auto-select stands down.

## Steps

1. A returning user with `useLocationStore.activeLocation` starts in `manual`; a first-time user
   starts in `request`.
2. **Primer (pre-permission):** the `request` step shows a benefit card ("Find stores delivering
   near you") plus "Allow location access" and "Enter location manually".
   - **Allow:** calls `requestAndRefreshLocation()` in strict order — runtime permission first, then
     the device Location master switch, then a high-accuracy fix + reverse geocode, then
     `adoptDeviceAsActive()` (an explicit "follow me" clears any override) and proximity auto-select.
     - On Android, if the master switch is off it opens the system "Turn on location" dialog
       (Play Services resolution) and, when accepted, runs the fix without another tap. Cancelling
       it returns no inline error; the next tap explains via the instructional sheet.
     - On iOS the global switch has no in-app prompt, so the screen opens the instructional sheet
       (`App-Prefs:Privacy&path=LOCATION`, falling back to `Linking.openSettings()`) and auto-resumes
       on `AppState` → `active`.
   - **Enter location manually:** skips the OS dialog entirely and goes to `manual`.
   - **First denial (Android):** inline error; the manual path stays available and a later tap can
     show the OS dialog again.
   - **Services off:** an instructional bottom sheet ("Turn on Device Location") with Continue and
     "Enter address manually"; no premature red text.
   - **Blocked (iOS "Don't Allow", Android "Don't ask again"):** the OS will never show the
     permission dialog again. The screen shows a Settings instruction, opens the Settings app via
     `Linking.openSettings()`, and the manual path stays available.
3. **Manual:** `usePlaceAutocomplete` searches places; `resolvePlaceLocation(placeId)` resolves the
   selected suggestion to coordinates + address.
4. Selecting a place or a confirmed fix calls `useLocationStore.setActiveLocation(...)` —
   `source: 'pinned'` for a picked area, `source: 'gps'` for the GPS path — and moves to `loader`.
5. After a short confirmation dwell, the screen navigates to `MainTabs` only when
   `status === 'ready'` and the origin is not `(0, 0)`. Otherwise it returns to `manual` with an error.

## Proximity auto-select

While `overrideActive` is false, every device fix is matched against the caller's saved addresses
(`utils/addressProximity.findNearbySavedAddress`, 200 m radius, using each row's stored
`latitude`/`longitude`). The nearest match becomes `activeLocation` with `source: 'saved'`; with no
match the origin follows the device fix. Unpinned rows are skipped — matching a text address per poll
would need a network call and could match a different point than the user saved.
`useAddressesStore` caches the server list for this.

## Resume-time permission detection

`useLiveLocation` (mounted once in `App.tsx`) re-reads the native state on every `AppState` →
`active`:

- `getLocationAuthorizationStatus()` — the app grant.
- `isLocationServicesEnabled()` — the OS Location Services master switch (native
  `FaazioGeocoder` on iOS/Android).

A user who enabled location in the OS Settings app while Faazio was closed is detected on the next
foreground: the store flips to granted and a silent coarse fix runs, so the nearby feeds re-sort with
no restart and no second OS prompt. A chosen origin (`source: 'saved'` / `'pinned'`) is never
silently replaced by a GPS fix — the grant is adopted, the chosen address stays the origin.

## Blocked / denied users

`denied` and `blocked` are non-fatal: `MainTabs` still opens and `HomeTabScreen` shows a dismissible
banner ("Location following is off") with **Open Settings** (deep link to the OS screen) and
**Enter address** (`Location`) actions. No screen is held behind a location lockout. A chosen origin
stays `ready`, so nearby sorting keeps working from it even with GPS denied.

## State

- `useLocationStore` (`src/state/locationStore.ts`) — `status` (`idle`/`loading`/`ready`/`denied`/
  `blocked`), `deviceFix`, `activeLocation` (`source: 'gps' | 'saved' | 'pinned'`),
  `overrideActive`, foreground-only fix, permission + services flags, persisted under
  `faazio:location:v2`.
- `useAddressesStore` (`src/state/addressesStore.ts`) — cached saved list for proximity matching.
- `useRemoteConfigStore` — supplies the Places API key via `selectPlacesApiKey`.

## Data path

- Device location permission + fix (no server write at this step).
- Reverse geocode via native `FaazioGeocoder` (`Geocoder` / `CLGeocoder`).
- Places autocomplete uses the configured Places API key (remote config override or bake-time
  default). No fixture coordinates are used as a live location.
- The chosen origin later drives `GET /stores/nearby` / `GET /products/nearby` (Haversine +
  bounding box), delivery-fee quotes, and `POST /orders`' `deliveryLocation`.

## Success / error / empty

- **Success:** `MainTabs`.
- **Permission denied / no fix:** inline message, manual entry remains available.
- **Unresolvable place:** inline message; user can retry or use current location.
- **Empty:** no suggestions → the user can still type/select manually.

## Known gaps

- Places availability depends on a valid API key; see `docs/RUNBOOKS/TROUBLESHOOTING.md`.
- Permission and services state are read through the local `FaazioGeocoder` native module
  (`getLocationAuthorizationStatus`, `isLocationServicesEnabled`, `requestEnableLocation`,
  `geocodeAddress`, `reverseGeocode`). `requestEnableLocation` uses `com.google.android.gms:play-services-location`
  on Android for the system "Turn on location" dialog. A native rebuild (CI) is required when this
  module changes.

## Linked docs

- `docs/architecture/mobile-app.md` (live location + nearby reads)
- `docs/architecture/caching-cloudflare-valkey.md` (geo cache keys)
- [`../profile/saved-addresses.md`](../profile/saved-addresses.md)
- `data/DATA_CONTROL.md` (`seedLocation` is `@seed` + `@unused`)
