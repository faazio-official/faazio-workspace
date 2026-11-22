# Seller inventory (sector-aware)

**App / route:** portal `/seller/inventory` (`app/seller/inventory/page.client.tsx`)
**Status:** Shipped
**Trigger:** Seller console → **Inventory** (sidebar Catalog group, bottom-nav Stock, Explore grid).

## Steps

1. The route file is only a **sector router**: it reads `useSellerScope()` and renders one of two
   separate views — it holds no data hooks or sheets of its own.
2. **FOOD → `FoodInventoryView`** (`src/components/sellers/inventory/food-view.tsx`):
   - `useMenus({ sellerId, venueId: storeId })` lists the shop's dishes.
   - **Menu dishes** tab: each dish row carries a veg mark, cuisine, price and a listed/delisted
     toggle → `setMenuStatus(venueId, dishId, "ACTIVE" | "DELISTED")`. A delisted-only filter and a
     name search narrow the list. There is no unit count: a kitchen sets availability, it does not
     decrement plates. Creating/editing a dish (section → leaf sub-category, photo dropzone,
     Publish/Save-as-Draft) lives on `/seller/menus` — see
     [`../web-portal/menu-creation.md`](../web-portal/menu-creation.md).
   - **Add-ons** tab: `listAddons({ venueId })` + `listMenuAddons(storeId)` drive the create sheet
     (`createAddon` → DRAFT), submit-for-review (`submitAddonForReview`), delist (`delistAddon`) and
     per-dish link toggles (`linkAddonToDish` / `unlinkAddonFromDish`). See
     [`../web-portal/addons.md`](../web-portal/addons.md).
3. **MART / PHARMA → `RetailStockInventoryView`** (`src/components/sellers/inventory/retail-view.tsx`):
   - `useStock(sellerId, storeId)` lists stock rows (product + qty + low-stock threshold + ETA).
   - Rows are grouped by category with a per-category out-of-stock count; each row shows the product
     image, name, an **In stock / Low stock / Out of stock** pill, `qty in stock • ETA` and price.
   - Turning a row **off** opens the ETA sheet (2h / 4h / next business day / custom date+time /
     manual) and writes `updateStock(productId, 0, etaMinutes)`; turning it **on** restocks to the
     **shop's own** defaults — `directory.stores.restock_qty` / `restock_eta_minutes` (0123, set on
     `/seller/stores`), falling back to 10 units / 30 min only when the shop has none.
   - **Batch & expiry** (0123): a **Lot** button on each row opens a sheet for `batchNo` +
     `expiryDate`, written through the same `PUT /seller/inventory/{productId}`. The lot renders under
     the row; an expiry in the past turns the row's pill to **Out of stock** and greys the toggle,
     because the gateway treats a past `expiry_date` as unavailable on every read.
   - A **low-stock-only** filter and a name search narrow the list; a **Jump** sheet scrolls to a
     category.
   - **Pharmacy nuance:** a row whose product is prescription-only carries a read-only **Rx** badge
     so regulated stock is visually distinct, and its batch/expiry is the regulated lot. No veg mark,
     cuisine or add-on linking is rendered.
4. Both views show the same "Want to edit your catalog or items?" shortcut to `/seller/products`.

## State

- Portal Zustand store slices: `menus` (food), `stock` + `products` (retail).
- Local page state only: search text, active tab / low-stock filter, sheet open flags, add-on lists
  fetched on mount.

## Data path

- Food: `GET /seller/menus` → `directory.menus`; `GET/POST /seller/addons`,
  `POST /seller/addons/{id}/submit-for-review`, `DELETE`/delist and `GET/POST /seller/menu-addons`
  + `DELETE /seller/menu-addons/{venueId}/{dishId}/{addonId}` → `directory.addons` +
  `directory.menu_addon_links`.
- Retail: `GET /seller/inventory` → `inventory.stock` (+ `catalog.products`);
  `PUT /seller/inventory/{productId}` writes qty + ETA (gateway clamps ETA to 0..600 min) and,
  optionally, `batchNo` / `expiryDate` (`YYYY-MM-DD`; an explicit empty string clears the column).
- Availability is *effective* availability: every product/stock read computes
  `available and (expiry_date is null or expiry_date >= current_date)`, and the checkout
  `Decrement` adds the same expiry clause, so an expired lot can never be sold.
- Ownership/sector: the gateway scopes every menu/add-on write to the seller's store **and** requires
  the store's `app` to be `FOOD`, so a Mart/Pharmacy shop cannot write the Food tables even by id.

## Success / error / empty

- **Success:** the toggle/sheet write is confirmed and the row reflects the new state; a toast
  confirms the change.
- **Error:** a rejected write toasts and the optimistic row reverts (store-level rollback in
  `src/lib/api`).
- **Empty:** food with no dishes → "No dishes in your menu yet"; retail with no stock rows → "No
  stock rows yet — add a product first"; a filtered miss → "No dishes/items match your search".

## Known gaps

- Batch/expiry is **single-lot per product row** (`inventory.stock.batch_no` / `expiry_date`): two
  batches of the same SKU on the shelf at once cannot both be represented.
- The low-stock threshold is still the client constant `12` (`src/lib/api/sync.ts`); restock qty/ETA
  are per-shop. See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- [`../web-portal/menu-creation.md`](../web-portal/menu-creation.md) — dish creation + publish
- [`price-update.md`](./price-update.md) — pricing and the stock write contract
- [`index.md`](./index.md) — catalog domain index
- `docs/architecture/monolith-breakdown.md` (catalog/directory rows)
