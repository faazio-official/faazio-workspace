# Super admin — global catalog + seller product requests

**App / route:** portal `/admin/super/products` (`app/admin/super/products/page.client.tsx`)
**Status:** Shipped — Listed/Requested/Deleted switch, per-listing detail dialog (full seller
overview), Accept/Reject with confirmation, bulk approve/delete, and a 7-day Deleted trash with
Restore + Delete forever.
**Trigger:** SUPER_ADMIN opens **Supply → Products** in the Partner Portal.

## Steps

1. The page renders the **Global catalog** header and a KPI strip (Active listings, Pending review,
   Needs changes, Showing, Selected). The figures come from the same authoritative rows the table
   renders, so a KPI and the list can never disagree.
2. **Listed / Requested / Deleted switch.** Three `FilterChip` controls sit at the top of the card:
   - **Listed products** → rows with `status === "ACTIVE"`. This is the default view and shows what
     shoppers can already see.
   - **Requested products** → rows with `status === "PENDING_REVIEW"`, the seller request queue at
     platform scope.
   - **Deleted · N** → the 7-day trash (`GET /seller/products/trash`, platform-wide for a super
     admin). Fetched when the view opens, with product, sector, seller, price, `deletedAt` and
     `purgeAt`.
   Switching resets the selection so a bulk action can never span the views. A
   `CHANGES_REQUESTED` row belongs to neither live view (it is counted by the "Needs changes" KPI) so
   it can never be mistaken for a fresh request or a live listing.
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
7. **Bulk actions** (live views): *Approve selected* sets each selected listing `ACTIVE`;
   *Delete selected* is behind an `AlertDialog` confirmation and soft-deletes them into the 7-day
   trash. Every action refetches afterwards, so the moved row leaves the Requested view and the KPIs
   update in the same pass instead of waiting for a re-login.
8. **Deleted (trash) actions.** Rows in the **Deleted** view can be restored with **Restore**
   (`POST /seller/products/{id}/restore` — returns to its previous lifecycle status/status) or removed
   for good with **Delete forever** (`DELETE /seller/products/{id}/permanent` — hard delete now, only
   ever accepted for an already-trashed row). Selection supports a bulk **Delete forever**. The
   gateway's automatic purge (`catalog.purge_deleted_products` via pg_cron plus the hourly
   `catalog.Purger`) still removes anything left after 7 days, so the trash can never linger.

## State

- Local page state — `sector`, `query`, `viewMode` (`LISTED` / `REQUESTED` / `DELETED`), `selected`,
  `detailsId`, `approving`, `rejecting`, `reason`, plus `trashed` / `trashLoading` / `purgeIds` for
  the trash.
- Reads come from a live `GET /seller/pricing` via `useLiveProducts` (fetched on mount, re-fetched
  by *Refresh* and after every approve/reject/delete), not from the persisted hydration slice. Seller
  fields come from the hydrated `sellers` slice via `getSeller` / `useSeller`. The trash is fetched
  directly with `fetchProductTrash()` when the Deleted view opens and after every restore/purge.

## Data path

- Reads: `useLiveProducts` → `fetchSellerPricing()` → `GET /seller/pricing` → `catalog.products`
  (super admin sees every district, a district admin their own). Rows are mapped with the shared
  `mapSellerProductRow` and filtered client-side with `filterProducts` — no new endpoint, no new
  cache key, and no dependence on the once-per-login hydration.
- Trash read: `fetchProductTrash()` → `GET /seller/products/trash` → `catalog.products where
  deleted_at is not null` (super admin gets every district; the read also runs the expiry purge).
- Writes: `setProductStatus()` → `PUT /seller/products/{id}/status` with `{ status }` (approve) or
  `{ status: "REJECTED", reason }` (reject) → `catalog.products.status` / `review_reason`, audit
  logged as `PRODUCT_<STATUS>`. `deleteProduct()` → `DELETE /seller/products/{id}` (soft delete →
  7-day trash). `restoreDeletedProduct()` → `POST /seller/products/{id}/restore`.
  `purgeDeletedProduct()` → `DELETE /seller/products/{id}/permanent` (hard delete, trash-only; purges
  the product/stock/store-products/nearby caches).
- The district-level equivalent (`/admin/district/products/queue`) remains the scoped queue for a
  single district; this board is the platform-wide view.

## Success / error / empty

- **Success:** approve/reject toasts confirm the write; the row moves out of the Requested view and
  the KPI strip recomputes.
- **Loading:** skeleton rows while the first gateway hydration is in flight — no fabricated latency.
- **Error:** a rejected write rolls back the optimistic store patch via `pushWrite` and toasts; a
  reject with an empty reason is blocked client-side with an explanatory toast.
- **Delete:** the row leaves the live list immediately and the toast says it is restorable for 7 days;
  `purgeAt` is shown in the trash.
- **Restore:** the row disappears from Deleted and returns to its previous status.
- **Delete forever:** removes the row + stock now; a row that was never trashed is `404 not_found`.
- **Empty:** "No listed products match" / "No pending requests match" / "Nothing deleted" with a hint
  to clear filters, or a clear queue message when no seller request is waiting.

## Known gaps

- Bulk actions are not confirmation-gated for approve (only delete is); a mis-click on *Approve
  selected* is recoverable only by rejecting the listings again.
- The board has no server-side pagination; it renders the full fetched set.

## Linked docs

- `docs/architecture/web-portal.md`
- `docs/architecture/monolith-breakdown.md` (catalog row)
- [`../catalog/add-product.md`](../catalog/add-product.md) — seller submission side
- [`products.md`](./products.md) — seller's own products list
