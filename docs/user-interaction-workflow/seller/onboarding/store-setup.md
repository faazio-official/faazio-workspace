# Store / vendor setup

**App / route:** portal `/seller/stores`, `/seller/onboarding`, `/seller/outlet-info`
**Status:** Partial (platform fee and cover-image steps have no seller UI)**Trigger:** Seller completes onboarding or opens the stores page.

## Steps

1. `GET /seller/stores` lists the caller's vendors (the portal switcher's data source).
2. Seller opens the create form from any of three entry points: `Add shop` in the `/seller/stores`
   header, the "Create a shop" empty state on `/seller/products/new`, or `/seller/onboarding`
   directly. The header action is a single-line button (`shrink-0` + `whitespace-nowrap` in the
   `PageHeader` `right` slot, whose title truncates first), so the label never wraps under the plus
   icon on a narrow phone.
3. Seller creates a vendor with `POST /seller/stores` (name, app, address, phone, hours, live flag,
   **shop geo pin**; FSSAI/drug licence where applicable). The portal form does not send a platform
   fee. The form also
   asks for two optional Tamil fields — **Tamil shop name** and **Tamil description** (`0108`,
   `nameTa`/`descTa`, ≤160 / ≤2000 characters). Both validate with `tamilFieldError`
   (`src/lib/tamil.ts`, Tamil letters/digits/light punctuation only, blank = untranslated) and the
   gateway re-validates with `internal/platform/locale.IsTamilText`; the customer app shows them on
   store and restaurant cards when the shopper picked Tamil, falling back to English when blank.
   The pin is **required** at creation (`StorePinPicker`, `src/components/sellers/StorePinPicker.tsx`):
   device geolocation or manual latitude/longitude, both-or-neither, with an OpenStreetMap preview.
   Coordinates are never invented — a denied/unavailable geolocation leaves the fields empty for the
   seller to type.
4. Seller edits the profile with `PUT /seller/stores/{id}` — `/seller/stores` carries the opening
   hours, the same two Tamil fields (clearing a field clears the translation), the **Pure vegetarian**
   toggle (`isVeg`) and the shop pin (set or move; the pin is never cleared from the portal, and an
   omitted pin keeps the stored one). Platform fee is **not** seller-editable:
   `PUT /seller/stores/{id}/fee` is admin-only (`403 forbidden`) and a seller-supplied fee is
   zeroed. Sellers file `POST /sellers/{id}/platform-fee-request` from the portal page
   `/seller/fee-change-request` instead — see
   [`../web-portal/fee-change-requests.md`](../web-portal/fee-change-requests.md).
   A Mart/Pharmacy shop also carries **restock defaults** (0123) — `restockQty` (1..100000) and
   `restockEtaMinutes` (0..600) on `directory.stores`, edited from `/seller/stores` and applied by
   `/seller/inventory` when a SKU is turned back on. Omitted fields keep the current values; a new
   shop defaults to 10 units / 30 min.
5. Seller toggles live/offline with `PUT /seller/stores/{id}/live`. `PUT /seller/stores/{id}/cover`
   exists on the gateway but no client calls it yet.
6. A vendor is a `directory.stores` row with a NOT NULL `seller_id`; products/menus derive ownership
   through the store.
7. `/seller/outlet-info` shows the active shop's pin (`latitude, longitude`, 6 dp) and links "View on
   map" to OpenStreetMap when pinned, else to the address and a "no pin" warning.

## Why the pin matters

`directory.stores.latitude/longitude` (migration `0041_store_geo.sql`) is the only shop location the
delivery path reads. An unpinned shop is filtered out of `directory.Nearby` (the nearby-shopper
feed), quotes the base delivery fee (`checkout.DeliveryFeeForStore`), is skipped by `checkout.autoDispatch`,
and manual rider allocation fails with `409 missing_coordinates`. That is why the pin is a required
field at creation rather than a nice-to-have, and why `/seller/stores` warns when a shop has none.

## State

- Portal `usePortalStore` / seller scope.
- No mobile store; the seller app is a WebView.

## Data path

- `GET /seller/stores`, `POST /seller/stores`, `PUT /seller/stores/{id}` →
  `directory.stores` (including `latitude`/`longitude`).
- `PUT /seller/stores/{id}/fee` → admin-only, per-vendor `platform_fee_pct`.
- `POST /sellers/{id}/platform-fee-request` → seller fee-change request.
- `PUT /seller/stores/{id}/live` → `directory.stores.is_live`; purges the store's geo/catalog cache
  keys. `POST`/`PUT /seller/stores` flush the geo:nearby store+product tiles for both the previous
  and the new pin, so a created/moved shop is visible to nearby shoppers immediately.
- `PUT /seller/stores/{id}/cover` + media confirm → `media.assets` (gateway-only today).

## Success / error / empty

- **Success:** vendor created/edited/live.
- **Error:** portal error; no fake store.
- **Empty:** no vendors → create-vendor empty state.

## Known gaps

- Platform fee is admin-controlled; the seller only files a fee-change request from
  `/seller/fee-change-request` (mobile `SellerPlatformFeeRequestScreen` is the customer-app path).
- Cover-image upload has no seller UI even though the endpoint exists.
- The create-vendor form does not collect a platform fee.
- The portal can set or move a pin but cannot **clear** one (`UpdateStore` uses
  `coalesce($n, s.latitude)`), so the `/seller/stores` picker hides its "Clear pin" action.
- Shops created by the mobile seller registration (`sellers.repo.CreateExtended`) land with
  `is_live = false` and are not flipped live on approval — the seller publishes from `/seller/stores`.

## Linked docs

- `docs/architecture/monolith-breakdown.md` (directory/sellers rows)
- `docs/architecture/db-schema.md` (`directory.stores`)
- `docs/architecture/caching-cloudflare-valkey.md` (store live purge)
