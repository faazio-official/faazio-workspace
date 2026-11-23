# Saved addresses

**App / route:** customer · `SavedAddresses` (`features/profile/SavedAddressesScreen.tsx`)
**Status:** Shipped
**Trigger:** Profile → Saved addresses, or checkout address management.

## Steps

1. The screen loads `gateway.getAddresses()` (`GET /profile/addresses`) and mirrors the result into
   `useAddressesStore` so proximity auto-select can read the list without a screen.
2. The user adds/edits an address; `gateway.saveAddress(addr)` (`PUT /profile/addresses`) writes it.
   The editor carries an optional **pinned point** (`latitude`/`longitude`) chosen on the map
   (`PinLocationPicker`, `react-native-maps`). A point is only ever sent as a complete pair — the
   server rejects a lone axis (`400 invalid_address`).
3. Deleting calls `gateway.deleteAddress(id)` (`DELETE /profile/addresses/{id}`). The row is removed
   locally only after the server confirms (or returns 404, meaning it is already gone); any other
   failure keeps the row and shows a delete-failed alert.
4. Checkout reuses the saved address id; only a durable server id is submitted on `POST /orders`.
5. **Selecting a card (radio / "Deliver here")** also makes it the live origin:
   - A row with a stored point uses it directly — no network call, and the origin is exactly the
     point checkout delivers to.
   - A row saved before coordinates existed (or one never pinned) falls back to a best-effort
     forward geocode (`geocodeAddress()` → native `FaazioGeocoder.geocodeAddress`).
   - Either path writes `useLocationStore.setActiveLocation({ coordinates, address, source: 'saved',
     addressId })`, which also sets `overrideActive` so proximity auto-select cannot pull the origin
     back to the device position.
   - If neither a stored point nor a geocode resolves, the card shows an inline error and the origin
     is left untouched (checkout text and the nearby origin must never silently diverge).
6. Saving an address flagged default does the same (stored point first, geocode only when absent).

## State

- Local screen state for the form/list, the in-flight selection, the pin picker, and the sync error.
- `useAddressesStore` — server-cached address list, read by the location poller for proximity
  matching (`utils/addressProximity.findNearbySavedAddress`, 200 m radius, unpinned rows skipped).
- On selection/default-save the screen writes `useLocationStore` (active origin); it never writes
  `useCartStore`. `CartView` separately selects the active/default address for checkout.

## Data path

- `gateway.getAddresses()` → `GET /profile/addresses` → `checkout.addresses` (incl. `latitude`,
  `longitude`, migration `0125`).
- `gateway.saveAddress(addr)` → `PUT /profile/addresses`.
- `gateway.deleteAddress(id)` → `DELETE /profile/addresses/{id}`.
- The screen is server-only: it never seeds from `savedAddresses` in `@data/account` (that fixture
  remains a `data/checkout/orders.ts` seed). Saves require the server-minted id; there is no local
  `addr-local-…` fallback.

## Success / error / empty

- **Success:** address list reflects the server.
- **Error:** inline error on save; a failed delete keeps the address and alerts the user. A 404 on
  delete is treated as already-deleted. The UI never hides a row the server still holds. An address
  that cannot be located (no stored point and the geocode fails) shows an inline "could not locate
  this address" note, is not adopted as the origin, and the user is invited to pin it.
- **Empty:** "No saved addresses" state.

## Known gaps

- Rows saved before `0125` have no point and still need a forward geocode (one network call) on
  selection. They gain a point the next time the user pins and saves them.

## Linked docs

- `docs/architecture/mobile-app.md`
- `docs/architecture/monolith-breakdown.md` (checkout row)
- `docs/architecture/db-schema.md` §7.2 (`checkout.addresses`)
- `data/DATA_CONTROL.md` (`@data/account`)
