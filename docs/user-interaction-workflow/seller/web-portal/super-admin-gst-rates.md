# Super admin — GST rate slab master

**App / route(s):** portal `/admin/super/gst-rates` (`app/admin/super/gst-rates/page.client.tsx`)
**Status:** Shipped
**Trigger:** SUPER_ADMIN opens **Supply → GST rates** in the Partner Portal.

Replaces the deleted **Sectors** page (`/admin/super/sectors`). It owns only the named GST slab
pick-list; which slab a given category uses is set on
[`super-admin-categories.md`](./super-admin-categories.md).

## Steps

1. The page loads `GET /admin/tax/gst-rate-categories` via `useGSTRateCategories()` and groups the
   rows by sector (**Food / Mart / Pharma / Main app header**). Each table shows Name, GST rate,
   Active and Updated.
2. **Add:** *New GST rate* opens the dialog — Name (the human slab label, e.g. "Pharma — General
   Medicines"), Sector, GST rate (one of `0 / 5 / 12 / 18 / 28 / 40`), Active. Save calls
   `POST /admin/tax/gst-rate-categories`. A duplicate name inside the same sector is rejected
   (`UNIQUE (sector, name)`).
3. **Edit:** *Edit* prefills the dialog and calls `PUT /admin/tax/gst-rate-categories/{id}`. Changing
   the rate does **not** re-price existing categories — each category link stores its own copied
   `gst_rate_pct`, so a re-rate is a deliberate edit on the Categories page.
4. **Active is read-only after create:** the dialog's Active switch is shown but disabled; retirement
   is the delete action, so "inactive" always means "retired by the delete path" and never a stray
   toggle.
5. **Retire:** the delete action calls `DELETE /admin/tax/gst-rate-categories/{id}` — a **soft
   deactivate** (`is_active = false`). The gateway refuses with `409` while any category still links
   the slab (`tax.category_gst_rates.gst_rate_category_id` is `ON DELETE RESTRICT`), so a live
   category can never point at a rate the portal no longer offers. Re-point the categories first, then
   retire.
6. The pick-list feeds the **GST rate** select on the Categories page, filtered to the chosen app's
   sector; FOOD categories can only ever take the 5% food slab (server-enforced).
7. Checkout reads the resolved per-category rate (`tax.category_gst_rates`), never this table
   directly — see `docs/architecture/db-schema.md` §12.43.

## State

- `items` — the slab list from `useGSTRateCategories()` (name, sector, `gstRatePct`, `isActive`).
- Dialog form state — name, sector, GST rate, Active.
- No client-side cache; each save reloads the list.

## Data path

- `listGSTRateCategories()` → `GET /admin/tax/gst-rate-categories` → `tax.gst_rate_categories`.
- `upsertGSTRateCategory()` → `POST /admin/tax/gst-rate-categories` /
  `PUT /admin/tax/gst-rate-categories/{id}` → `tax.gst_rate_categories` (SUPER_ADMIN).
- `deleteGSTRateCategory()` → `DELETE /admin/tax/gst-rate-categories/{id}` →
  `tax.gst_rate_categories.is_active = false` (refused `409` while linked).
- Read by the category sheet → `GET /admin/tax/gst-rate-categories`; read by checkout →
  `tax.category_gst_rates.gst_rate_pct` (copied value).

## Success / error / empty

- **Success:** toast *GST rate created/updated/retired*; the Categories page's picker reflects it on
  its next load.
- **Validation:** `400` for a blank name, an unknown sector, or a rate outside
  `0 / 5 / 12 / 18 / 28 / 40`. A duplicate `(sector, name)` is `409`.
- **In use:** `409` when a category still links the slab — retire after re-pointing the categories.
- **Empty:** a sector with no slabs shows its own empty row ("No GST rates in this sector").

## Known gaps

- Slabs are seeded (`gst-food-standard`, `gst-pharma-*`, `gst-mart-*`) but cannot be reordered or
  grouped beyond their sector.
- No bulk re-rate: changing a slab does not touch the categories already linked to it (by design —
  re-pricing stays explicit).

## Linked docs

- [`super-admin-categories.md`](./super-admin-categories.md) — where a category picks its slab
- `docs/architecture/db-schema.md` §12.43 (GST rate master + mandatory per-category GST)
- `docs/architecture/monolith-breakdown.md` §1 (tax row)
- `docs/architecture/server-gateway-plan.md` (tax + invoicing)
