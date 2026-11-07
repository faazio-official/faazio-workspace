# Saved addresses

**App / route:** customer · `SavedAddresses` (`features/profile/SavedAddressesScreen.tsx`)
**Status:** Shipped
**Trigger:** Profile → Saved addresses, or checkout address management.

## Steps

1. The screen loads `gateway.getAddresses()` (`GET /profile/addresses`).
2. The user adds/edits an address; `gateway.saveAddress(addr)` (`PUT /profile/addresses`) writes it.
3. Deleting calls `gateway.deleteAddress(id)` (`DELETE /profile/addresses/{id}`).
4. Checkout reuses the saved address id; only a durable server id is submitted on `POST /orders`.

## State

- Local screen state for the form/list.
- `useLocationStore` — live fix used to label/seed an address.
- `useCartStore` — selected delivery address for checkout.

## Data path

- `gateway.getAddresses()` → `GET /profile/addresses` → `checkout.addresses`.
- `gateway.saveAddress(addr)` → `PUT /profile/addresses`.
- `gateway.deleteAddress(id)` → `DELETE /profile/addresses/{id}`.
- `defaultAddresses` in `@data/cart` is an offline/error shell only, never the online origin.

## Success / error / empty

- **Success:** address list reflects the server.
- **Error:** inline error; the UI does not keep an unconfirmed address.
- **Empty:** "No saved addresses" state.

## Known gaps

- None specific.

## Linked docs

- `docs/architecture/mobile-app.md`
- `docs/architecture/monolith-breakdown.md` (checkout row)
- `data/DATA_CONTROL.md` (`@data/cart` / `@data/account`)
