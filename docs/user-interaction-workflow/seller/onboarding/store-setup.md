# Store / vendor setup

**App / route:** portal `/seller/stores`, `/seller/onboarding`, `/seller/outlet-info`
**Status:** Shipped
**Trigger:** Seller completes onboarding or opens the stores page.

## Steps

1. `GET /seller/stores` lists the caller's vendors (the portal switcher's data source).
2. Seller creates a vendor with `POST /seller/stores` (app, category, per-store platform fee,
   FSSAI/drug licence where applicable, own pin, optional masked bank override).
3. Seller edits profile/fee with `PUT /seller/stores/{id}` or `PUT /seller/stores/{id}/fee`.
4. Seller toggles live/offline with `PUT /seller/stores/{id}/live`; cover image with
   `PUT /seller/stores/{id}/cover`.
5. A vendor is a `directory.stores` row with a NOT NULL `seller_id`; products/menus derive ownership
   through the store.

## State

- Portal `usePortalStore` / seller scope.
- No mobile store; the seller app is a WebView.

## Data path

- `GET /seller/stores`, `POST /seller/stores`, `PUT /seller/stores/{id}` →
  `directory.stores`.
- `PUT /seller/stores/{id}/fee` → per-vendor `platform_fee_pct`.
- `PUT /seller/stores/{id}/live` → `directory.stores.is_live`; purges the store's geo/catalog cache
  keys.
- `PUT /seller/stores/{id}/cover` + media confirm → `media.assets`.

## Success / error / empty

- **Success:** vendor created/edited/live.
- **Error:** portal error; no fake store.
- **Empty:** no vendors → create-vendor empty state.

## Known gaps

- None specific.

## Linked docs

- `docs/architecture/monolith-breakdown.md` (directory/sellers rows)
- `docs/architecture/db-schema.md` (`directory.stores`)
- `docs/architecture/caching-cloudflare-valkey.md` (store live purge)
