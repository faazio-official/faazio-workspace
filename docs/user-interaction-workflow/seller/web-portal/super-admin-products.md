# Super admin — global catalog + seller product requests

**App / route:** portal `/admin/super/products` (`app/admin/super/products/page.client.tsx`)
**Status:** Shipped — Listed/Requested switch, per-listing detail dialog (full seller overview),
Accept/Reject with confirmation, plus the existing bulk approve/delete.
**Trigger:** SUPER_ADMIN opens **Supply → Products** in the Partner Portal.

## Steps

1. The page renders the **Global catalog** header and a KPI strip (Active listings, Pending review,
   Showing, Selected). Both the "Showing" and "Selected" figures are scoped to the current view.
2. **Listed / Requested switch.** Two `FilterChip` controls sit at the top of the card:
   - **Listed products** → `useProducts({ status: "ACTIVE" })`. This is the default view and shows
     what shoppers can already see.
   - **Requested products** → `useProducts({ status: "PENDING_REVIEW" })`, the seller request queue
     at platform scope.
   Switching resets the selection so a bulk action can never span the two views.
3. **Filters.** Search (name or product id) and the sector chips (ALL / MART / FOOD / PHARMA) apply
   on top of the view's status filter.
4. **View details.** Every row has a *View details* action that opens a `Dialog` with the complete
   record the seller filled in:
   - Product: name, Tamil name, description, Tamil description, sector, category, unit, price,
     veg / prescription flags, product id, created date.
   - Images: the primary photo plus every gallery URL, each linking to the full-size file.
   - Seller: seller id, business name, owner name, contact phone and registered address
     (`getProduct` → `getSeller` off the hydrated `sellers` slice — no extra request).
   - Review: current status and the stored rejection reason when the listing was rejected.
5. **Accept / Reject.** Pending listings expose both inside the detail dialog and inline on the row:
   - *Accept* opens an `AlertDialog` confirmation ("it will become visible to shoppers
     immediately"), then `setProductStatus(id, "ACTIVE")`, a success toast, and the row leaves the
     Requested view.
   - *Reject* opens a `Dialog` with a **required** reason (max 500 chars, same contract as the
     district queue), then `setProductStatus(id, "REJECTED", reason)`; the seller sees the note.
6. **Bulk actions** (any view): *Approve selected* sets each selected listing `ACTIVE`;
   *Delete selected* is behind an `AlertDialog` confirmation and permanently removes the listings.

## State

- Local page state — `sector`, `query`, `viewMode` (`LISTED` / `REQUESTED`), `selected`,
  `detailsId`, `approving`, `rejecting`, `reason`.
- Reads come from the hydrated `products` slice via `useProducts`; seller fields come from the
  hydrated `sellers` slice via `getSeller` / `useSeller`.

## Data path

- Reads: `hydrateFromGateway()` → `GET /seller/pricing` (all rows) → `catalog.products`;
  `GET /sellers` → `sellers.sellers`. Both view filters run client-side over that slice — no new
  endpoint, no new cache key.
- Writes: `setProductStatus()` → `PUT /seller/products/{id}/status` with `{ status }` (approve) or
  `{ status: "REJECTED", reason }` (reject) → `catalog.products.status` / `review_reason`, audit
  logged as `PRODUCT_<STATUS>`. `deleteProduct()` → `DELETE /seller/products/{id}` for bulk removal.
- The district-level equivalent (`/admin/district/products/queue`) remains the scoped queue for a
  single district; this board is the platform-wide view.

## Success / error / empty

- **Success:** approve/reject toasts confirm the write; the row moves out of the Requested view and
  the KPI strip recomputes.
- **Loading:** skeleton rows while the first gateway hydration is in flight — no fabricated latency.
- **Error:** a rejected write rolls back the optimistic store patch via `pushWrite` and toasts; a
  reject with an empty reason is blocked client-side with an explanatory toast.
- **Empty:** "No listed products match" / "No pending requests match" with a hint to clear filters,
  or a clear queue message when no seller request is waiting.

## Known gaps

- Bulk actions are not confirmation-gated for approve (only delete is); a mis-click on *Approve
  selected* is recoverable only by rejecting the listings again.
- The board has no server-side pagination; it renders the full hydrated slice.

## Linked docs

- `docs/architecture/web-portal.md`
- `docs/architecture/monolith-breakdown.md` (catalog row)
- [`../catalog/add-product.md`](../catalog/add-product.md) — seller submission side
- [`products.md`](./products.md) — seller's own products list
