# Saved addresses

**App / route:** customer · `SavedAddresses` (`features/profile/SavedAddressesScreen.tsx`)
**Status:** Shipped
**Trigger:** Profile → Saved addresses, or checkout address management.

## Steps

1. The screen loads `gateway.getAddresses()` (`GET /profile/addresses`).
2. The user adds/edits an address; `gateway.saveAddress(addr)` (`PUT /profile/addresses`) writes it.
3. Deleting calls `gateway.deleteAddress(id)` (`DELETE /profile/addresses/{id}`). The row is removed
   locally only after the server confirms (or returns 404, meaning it is already gone); any other
   failure keeps the row and shows a delete-failed alert.
4. Checkout reuses the saved address id; only a durable server id is submitted on `POST /orders`.
5. **Selecting a card (radio / "Deliver here")** also makes it the live origin: the address text is
   forward-geocoded (`geocodeAddress()` → native `FaazioGeocoder.geocodeAddress`) and written with
   `useLocationStore.setFix({ coordinates, address, source: 'manual' })`, so the nearby feeds sort
   from the same address checkout uses. Saving an address flagged default does the same. A saved row
   holds text only — when the geocode fails the card shows an inline error and the origin is left
   untouched (checkout text and the nearby origin must never silently diverge).

## State

- Local screen state for the form/list, the in-flight selection, and the sync error.
- On selection/default-save the screen writes `useLocationStore` (manual origin); it never writes
  `useCartStore`. `CartView` separately selects the default address for checkout.

## Data path

- `gateway.getAddresses()` → `GET /profile/addresses` → `checkout.addresses`.
- `gateway.saveAddress(addr)` → `PUT /profile/addresses`.
- `gateway.deleteAddress(id)` → `DELETE /profile/addresses/{id}`.
- The screen is server-only: it never seeds from `savedAddresses` in `@data/account` (that fixture
  remains a `data/checkout/orders.ts` seed). Saves require the server-minted id; there is no local
  `addr-local-…` fallback.

## Success / error / empty

- **Success:** address list reflects the server.
- **Error:** inline error on save; a failed delete keeps the address and alerts the user. A 404 on
  delete is treated as already-deleted. The UI never hides a row the server still holds. An address
  that cannot be geocoded shows an inline "could not locate this address" note and does not become
  the origin.
- **Empty:** "No saved addresses" state.

## Known gaps

- None specific.

## Linked docs

- `docs/architecture/mobile-app.md`
- `docs/architecture/monolith-breakdown.md` (checkout row)
- `data/DATA_CONTROL.md` (`@data/account`)
