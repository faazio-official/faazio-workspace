# Super admin — global catalog + seller product requests

**App / route:** portal `/admin/super/products` (`app/admin/super/products/page.client.tsx`)
**Status:** Shipped — Listed/Requested switch, per-listing detail dialog (full seller overview),
Accept/Reject with confirmation, plus the existing bulk approve/delete.
**Trigger:** SUPER_ADMIN opens **Supply → Products** in the Partner Portal.

## Steps

1. The page renders the **Global catalog** header and a KPI strip (Active listings, Pending review,
   Needs changes, Showing, Selected). The figures come from the same authoritative rows the table
   renders, so a KPI and the list can never disagree.
2. **Listed / Requested switch.** Two `FilterChip` controls sit at the top of the card:
   - **Listed products** → rows with `status === "ACTIVE"`. This is the default view and shows what
     shoppers can already see.
   - **Requested products** → rows with `status === "PENDING_REVIEW"`, the seller request queue at
     platform scope.
   Switching resets the selection so a bulk action can never span the two views. A
   `CHANGES_REQUESTED` row belongs to neither view (it is counted by the "Needs changes" KPI) so it
   can never be mistaken for a fresh request or a live listing.
3. **Refresh.** A *Refresh* button, plus a fetch on mount and a refetch after every moderation
   action, re-reads `GET /seller/pricing`. This is deliberate: the persisted hydration slice is
   written once per login, so without it a newly submitted seller request — or another admin's
   decision — would not appear until re-login.
4. **Filters.** Search (name or product id) and the sector chips (ALL / MART / FOOD / PHARMA) apply
   on top of the view's status filter, client-side over the fetched rows.
5. **View details.** Every row has a *View details* action that opens a `Dialog` with the complete
   record the seller filled in:
   - Product: name, Tamil name, description, Tamil description, sector, category, unit, price,
     veg / prescription flags, product id, created date.
   - Images: the primary photo plus every gallery URL, each linking to the full-size file.
   - Seller: seller id, business name, owner name, contact phone and registered address
     (`getProduct` → `getSeller` off the hydrated `sellers` slice — no extra request).
   - Review: current status and the stored rejection reason when the listing was rejected.
6. **Accept / Reject.** Pending listings expose both inside the detail dialog and inline on the row:
   - *Accept* opens an `AlertDialog` confirmation ("it will become visible to shoppers
     immediately"), then `setProductStatus(id, "ACTIVE")`, a success toast, and the row leaves the
     Requested view.
   - *Reject* opens a `Dialog` with a **required** reason (max 500 chars, same contract as the
     district queue), then `setProductStatus(id, "REJECTED", reason)`; the seller sees the note.
7. **Bulk actions** (any view): *Approve selected* sets each selected listing `ACTIVE`;
   *Delete selected* is behind an `AlertDialog` confirmation and permanently removes the listings.
   Every action refetches afterwards, so the moved row leaves the Requested view and the KPIs update
   in the same pass instead of waiting for a re-login.

## State

- Local page state — `sector`, `query`, `viewMode` (`LISTED` / `REQUESTED`), `selected`,
  `detailsId`, `approving`, `rejecting`, `reason`.
- Reads come from a live `GET /seller/pricing` via `useLiveProducts` (fetched on mount, re-fetched
  by *Refresh* and after every approve/reject/delete), not from the persisted hydration slice. Seller
  fields come from the hydrated `sellers` slice via `getSeller` / `useSeller`.

## Data path

- Reads: `useLiveProducts` → `fetchSellerPricing()` → `GET /seller/pricing` → `catalog.products`
  (super admin sees every district, a district admin their own). Rows are mapped with the shared
  `mapSellerProductRow` and filtered client-side with `filterProducts` — no new endpoint, no new
  cache key, and no dependence on the once-per-login hydration.
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
- The board has no server-side pagination; it renders the full fetched set.

## Linked docs

- `docs/architecture/web-portal.md`
- `docs/architecture/monolith-breakdown.md` (catalog row)
- [`../catalog/add-product.md`](../catalog/add-product.md) — seller submission side
- [`products.md`](./products.md) — seller's own products list
