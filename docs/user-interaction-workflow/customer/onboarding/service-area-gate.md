# Customer service-area gate (enabled districts)

**App / route:** customer · app-level gate in `App.tsx` (`ServiceAreaBlockedPage`,
`src/components/shared/ServiceAreaBlockedPage.tsx`); no navigator route is mounted while blocked
**Status:** Shipped
**Trigger:** an authenticated origin exists (after login/location selection, a restored cold-start
origin, or a live origin change) and the address does not match a district the super admin has
enabled in **Governance → District coverage**.

## Steps

1. The app owns one coverage decision in `useServiceabilityStore`. On a cold start
   `useLiveLocation()` hydrates the stored origin and immediately fires a silent fix; as soon as
   `useLocationStore.status === 'ready'`, `useServiceability()` starts the coverage check under the
   branded splash.
2. The check reads the active master (`GET /geo/states` + `GET /geo/districts`, the latter filtered
   by `admins.district_master.is_active`) and matches the **on-device** reverse-geocoded
   `adminDistrict`/`city`/`region`/formatted address against those rows. No coordinates are sent to
   the gateway for this check. `adminDistrict` is the revenue district (`subAdminArea` on Android,
   `subAdministrativeArea` on iOS) and is matched **before** the sub-locality `district` field, which
   for a taluk town such as Lalgudi holds "Lalgudi" rather than "Tiruchirappalli". The check prefers
   the **chosen origin's** geocode (`activeLocation.place`, covering GPS, saved and pinned origins)
   and only falls back to `deviceFix.place`, so a saved/pinned point is never judged by the phone's
   unrelated hardware position. The native geocoders request English (`Locale.ENGLISH` /
   `en_IN`) names because the master is English, and the matcher also compares a repeated-letter
   fold (`Tiruchirappalli` ≈ `Tiruchirapalli`) before giving up. If the name match still finds no
   district (the platform geocoder can return `adminDistrict: null` with only a taluk name — verified
   on a Lalgudi device: city "Lalgudi", sub-locality "sirudayur", no district), the app resolves the
   **nearest active district in the matched state from the origin coordinates** (centroids from
   `0133`, ≤100 km). That fallback only runs after a name match fails and never overrides one.
3. The branded splash is held until **both** the session's first silent fix attempt has settled
   (`useLocationStore.fixAttemptedAt`, set once per session) **and** a coverage result exists for the
   origin the device actually reported. A persisted origin from a previous run therefore cannot
   decide coverage on its own: a user who moved into an enabled district sees `MainTabs`, and a user
   who moved out of one sees the gate, without ever flashing the wrong surface. The hold is bounded
   (`COVERAGE_HOLD_TIMEOUT_MS`, 12 s) so a dead fix or a dead fetch cannot strand the splash.
4. `LocationScreen` awaits the same check in its confirmation loader before pushing `MainTabs`.
   The check is **forced** (`check(true)`) so a district the super admin has just enabled is seen
   even when the origin has not changed since an older `unserviceable` verdict:
   - **serviceable** → `MainTabs`.
   - **unserviceable** → the picker does not navigate; the app-level gate renders the coverage page.
   - **failed / unknown** → the picker stays on `manual` with a "could not verify coverage" message
     and keeps retrying available. `unknown` (the origin moved mid-read) is never treated as a pass.
5. While the gate is up, the shopping navigator is not mounted, so no catalogue, cart or checkout
   surface can be reached. The page offers:
   - **Choose another location** — clears the persisted origin (`useLocationStore.reset()`), which
     lifts the gate and returns the app to the `Location` picker.
   - **Check again** — forces a fresh coverage read (bypassing the short client cache) without
     leaving the page.
   - **Notify me when we arrive** — a real `mailto:` to support; there is no fake subscribe state.
6. A returning user whose origin is still outside coverage sees the gate after the splash without
   ever flashing `MainTabs`. A user who moved into an enabled district gets `serviceable` on the
   cold-start check and the normal `MainTabs` start route.
7. Every `AppState → active` forces a coverage re-check, so a district the super admin activates or
   deactivates in the portal is reflected without restarting the app. A moved live origin also
   re-checks automatically (normally at the 10 s foreground poll). **Returning from offline also
   forces a re-check**: a cold start that happened offline records `failed` (`reason: network`), and
   that is never accepted as a verdict once connectivity returns. Until the forced re-check settles,
   the app holds the branded splash (`coverageNeedsRecheck`) instead of mounting the navigator, so an
   out-of-area device cannot reach the catalogue by booting without a connection and then
   reconnecting. `navigatorEverMounted` is set only when the navigator actually renders, so a cold
   start parked on the offline page keeps the hold armed for the reconnect.

## State

- `useServiceabilityStore` (`src/state/serviceabilityStore.ts`) — `status`
  (`unknown`/`serviceable`/`unserviceable`/`failed`), `checking`, matched
  state/district codes and names, `reason`, `checkedAt`, `locationKey` (guards against a stale result
  landing after the origin moved). `check(force)` de-duplicates concurrent reads.
  `isServiceabilityPending(state, currentOriginKey)` reports "no settled verdict for this origin",
  which is what the splash hold keys on.
- `useLocationStore` (`src/state/locationStore.ts`) — the origin and address label being matched,
  plus `fixAttemptedAt` (session-only, set once by the first silent fix attempt; never persisted).
  `hydrate()` refuses to overwrite a device fix that landed while its storage read was in flight.
- `useAuthStore` — the gate and the authenticated coverage read only exist for a signed-in session.

## Data path

- `gateway.getStates()` → `GET /geo/states` → `admins.states` (`is_active` only).
- `gateway.fetchDistricts()` → `GET /geo/districts` → `admins.district_master` (`is_active` only;
  each row carries the optional centroid `latitude`/`longitude` from `0133`).
- The super-admin write side is `PATCH /admin/districts/{code}/toggle` see
  [`../../seller/web-portal/super-admin-district-coverage.md`](../../seller/web-portal/super-admin-district-coverage.md).
- Reverse geocoding is the native `FaazioGeocoder` on-device step used by the picker
  (`reverseGeocode` returns `street`, `district` = sub-locality, `adminDistrict` = revenue district,
  `city`, `region`, `postalCode`, `name`); the coverage match itself is local. `district` is the
  sub-locality **only** — it never falls back to `locality`, so the city cannot masquerade as the
  district (an empty sub-locality leaves `district` null and the city stays in `city`).
  `reverseGeocode` requests English names (`Locale.ENGLISH` on Android, `en_IN` on iOS) so the
  device UI language cannot change the strings being matched. Offline/HTTP failure becomes
  `failed`, never `unserviceable`.

## Success / error / empty

- **Success:** `serviceable`; `MainTabs` mounts with the normal origin.
- **Unserviceable:** full-screen coverage page (Faazio welcome wordmark, map-pin-off icon) with
  change-location, re-check and notify actions.
- **Network / verification failure:** `failed`; on the cold-start path the app proceeds only after
  the bounded splash hold, and the picker asks the user to retry instead of pretending coverage is
  known. A cold start with no connection shows the offline page **only after the layer-2 splash
  completes its minimum display** (`SPLASH_MIN_DISPLAY_MS`), never cutting the splash short; on
  reconnect the coverage read is forced before the navigator may mount.
- **No usable address:** `failed` / `unknown` (for example a device whose native reverse geocoder is
  unavailable and whose label is only `lat, lng`); it never blocks a covered user.

## Known gaps

- Coverage is **district-level**, matching the enabled `admins.district_master` rows. There is no
  polygon/hex service-area geometry in the gateway yet, so an address on the wrong side of a district
  boundary inside an enabled district is not distinguished. The mobile gate is a district allowlist,
  not a Swiggy-style polygon fence: an enabled district is serviceable everywhere inside it, even at
  its far edge.
- Matching prefers the native reverse-geocoded names and the formatted address, then falls back to
  the nearest active **district centroid** (`admins.district_master.latitude/longitude`, `0133`) from
  the origin point when the name is absent or differs beyond the repeated-letter fold. The centroid is
  a per-district point, not a boundary: inside a state whose active districts are not contiguous or
  are mixed with inactive ones, a point in an inactive district near an active neighbour could be
  resolved to that neighbour (within the 100 km bound). Production coverage is all-or-nothing per
  state (TN/PY fully active, every other district inactive), so this cannot over-allow today; a true
  polygon/GPS fence remains the long-term hardening. The `Check again` action and manual location
  picker are the recovery path.
- A user who denies location permission while holding a persisted in-coverage origin stays
  serviceable on that stale origin: no fix is possible, so coverage cannot be re-decided. The Home
  "Location following is off" banner is the visible signal.

## Linked docs

- [`location-picker.md`](./location-picker.md)
- [`../home/index.md`](../home/index.md)
- [`../../seller/web-portal/super-admin-district-coverage.md`](../../seller/web-portal/super-admin-district-coverage.md)
- `docs/architecture/mobile-app.md` (live location section)
