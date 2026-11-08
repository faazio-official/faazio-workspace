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

## State

- Local screen state for the form/list.
- The screen reads the server list; it does not import `useLocationStore` or `useCartStore`.
  `CartView` separately selects the default address for checkout.

## Data path

- `gateway.getAddresses()` → `GET /profile/addresses` → `checkout.addresses`.
- `gateway.saveAddress(addr)` → `PUT /profile/addresses`.
- `gateway.deleteAddress(id)` → `DELETE /profile/addresses/{id}`.
- `savedAddresses` in `@data/account` is the offline/error shell only (`gateway.remoteEnabled`
  false); it is never the online origin.

## Success / error / empty

- **Success:** address list reflects the server.
- **Error:** inline error on save; a failed delete keeps the address and alerts the user. A 404 on
  delete is treated as already-deleted. The UI never hides a row the server still holds.
- **Empty:** "No saved addresses" state.

## Known gaps

- None specific.

## Linked docs

- `docs/architecture/mobile-app.md`
- `docs/architecture/monolith-breakdown.md` (checkout row)
- `data/DATA_CONTROL.md` (`@data/account`)
