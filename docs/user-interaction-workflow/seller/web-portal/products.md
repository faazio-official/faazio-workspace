# Seller products list

**App / route:** portal `/seller/products` (`app/seller/products/page.client.tsx`)
**Status:** Shipped
**Trigger:** Seller opens Products from the console nav / hub.

## Steps

1. The page reads `useProducts({ sellerId, storeId, query, sector, status })`
   (`src/lib/api/hooks.ts`) — a `useMemo` over the hydrated `products` slice, scoped to the
   signed-in seller and active vendor. Rows are filtered by seller / store / query / sector / status.
2. **Search** (name or product id), **sector** chips (`ALL` / MART / FOOD / PHARMA) and the
   **status** filter `Sheet` (ALL / ACTIVE / PENDING_REVIEW / DELISTED) all filter client-side over
   the same slice — no extra endpoint.
3. **Load more** paginates client-side: `products.slice(0, limit)` with `limit += 10`.
4. **Mobile row contract.** Each row is a flex card clamped to the viewport so right-side content
   never clips: the image and the `ChevronRight` are `shrink-0`; the middle column is
   `min-w-0 flex-1`; every truncating target (name, `category · productId`, price) carries
   `min-w-0 truncate`; the status pill is `shrink-0` pinned right (`ml-auto`). The card is
   `min-w-0 max-w-full overflow-hidden`, so a long name ellipsizes instead of forcing horizontal
   scroll. The image is `h-12 w-12` below `sm` and `h-14 w-14` at `sm`+.
5. **Scroll-down to reload** (web-native equivalent of the customer app's pull-to-refresh):
   scrolling to within ~100px of the page bottom calls `refreshSellerProducts()`,
   guarded by an in-flight flag and a **30s cooldown** so it cannot loop.
6. `refreshSellerProducts()` (`src/lib/api/sync.ts`) re-fetches `GET /seller/pricing` and maps the
   rows with the **same** `mapSellerProductRow` used at hydration, then replaces the `products`
   slice. `useProducts` re-reads the updated slice (Zustand subscription → auto re-render) and
   "Load more" keeps working.
7. While a refresh is in flight a Faazio Blue (`text-brand`) `Loader2` spinner + "Refreshing…" shows
   at the bottom of the list.

## State

- `usePortalStore` — the hydrated `products` slice (the read source); refreshed in place by
  `refreshSellerProducts`.
- Local page state — `query`, `sector`, `status`, `limit`, `filtersOpen`, `refreshing`.

## Data path

- `hydrateFromGateway()` → `GET /seller/pricing` → `catalog.products` (+ price, identity) →
  `ProductRecord[]` written to the `products` slice (`src/lib/api/sync.ts`). Scroll refresh re-runs
  the same read; no new endpoint, no new mapping.
- Reads only on this page. Create / edit / delete-restore live in
  [`../catalog/add-product.md`](../catalog/add-product.md) and
  [`../catalog/product-trash.md`](../catalog/product-trash.md).
- No cache-key change: the gateway/cache contract is unchanged (`GET /seller/pricing` is served as
  today; the client re-reads it).

## Success / error / empty

- **Success:** live rows render; scroll refresh replaces the slice and toasts
  `Products refreshed`.
- **Loading:** skeleton rows while the first gateway hydration is in flight (`usePortalLoading`) —
  no fabricated latency.
- **Error:** a failed refresh leaves the last-loaded rows in place (the slice is written only after a
  successful fetch) and toasts `Couldn't refresh products`. A disconnected gateway is a no-op that
  returns the current slice, so rows are never blanked.
- **Empty:** "No products match — clear the filters or add a new product"; zero products show the
  "Add your first product" call to action.

## Known gaps

None for this flow. The list is read-only here; product create/edit/moderate gaps are tracked on
their own pages. See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/web-portal.md`
- `docs/architecture/monolith-breakdown.md` (catalog row)
- `docs/user-interaction-workflow/seller/catalog/add-product.md`
