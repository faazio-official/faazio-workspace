# Product-first festival offers

**App / route:** portal `/seller/offers` (`app/seller/offers/page.client.tsx`), shared surface
`src/components/sellers/FestivalOptins.tsx`
**Status:** Shipped
**Trigger:** Mart/Pharmacy seller taps **Offers** in the bottom nav, desktop sidebar, or the
Explore grid. Food shops keep **Menu** in that slot instead.

## Steps

1. The shell reads the active store (`useActiveStore`) and builds the nav for its sector. Food →
   Menu (`/seller/menus`); Mart/Pharmacy → Offers (`/seller/offers`). The same rule drives the
   desktop sidebar (`sellerNavItems`) and the Explore catalog tiles.
2. The page scopes products to the signed-in seller and the active store
   (`useProducts({ sellerId, storeId })`), then keeps only rows matching the active store's sector.
3. Live and scheduled campaigns are listed (`GET /promo/campaigns`; the seeded store slice is
   hydrated by the sync pass). The first campaign is selected; the header button opens a sheet to
   switch campaign.
4. The page reads the seller's own opt-ins (`GET /promo/optins`) and the sector caps
   (`GET /promo/sector-caps`, now seller-readable) so the discount bound matches the cap the
   gateway applies at price time.
5. Per product the seller enters an integer discount percent. The row shows the base price, the
   computed live price, and the existing `PENDING` / `APPROVED` / `REJECTED` status (or "Not
   joined").
6. **Opt in / Update** calls `POST /seller/promotions/optin` (the same write as Promotions). The
   write resets an existing opt-in to `PENDING`; shoppers see the live price only after a district
   admin approves it.
7. If the seller searches, the product list filters by name or product id.

## State

- Portal Zustand store slices: `products`, `campaigns`, `optins`, `sectorCaps`; local page state for
  the selected campaign, draft percentages, search, and the campaign sheet.
- No mock/demo rows: an unconfigured gateway renders honest empty states; the sync pass hydrates the
  slices from the gateway.

## Data path

- Reads: `GET /promo/campaigns` → `promo.festival_campaigns`; `GET /promo/optins` →
  `promo.festival_optins` (seller-scoped); `GET /promo/sector-caps` → `promo.sector_caps`;
  `GET /seller/pricing` → `catalog.products` (+ `inventory.stock`).
- Write: `POST /seller/promotions/optin` → `promo.festival_optins` (`status = PENDING`), then the
  promo cache keys for the product are invalidated.
- Server ownership: the gateway verifies the product belongs to the seller (`catalog.products` →
  `directory.stores.seller_id`) and rejects cross-seller overwrites with `409 optin_owned`.
- Cap enforcement: the client validates against the selected campaign's state override (else the
  global cap). `ActiveDiscounts` applies the same cap at read time, so an over-cap opt-in can never
  leak an uncapped shopper price.

## Success / error / empty

- **Success:** the opt-in is optimistically written as `PENDING` and the row shows the status; the
  server keeps the authoritative row and a later admin approval makes the discount live.
- **Error:** an invalid percent (empty, `0`, non-integer, over the cap or over 90) disables the
  button and shows the reason; a rejected gateway write rolls the optimistic row back and toasts the
  failure.
- **Empty:** no live/scheduled campaign → "Your district admin hasn't opened a campaign window
  yet"; no store products → "No products listed yet"; no search matches → "No products match your
  search".

## Known gaps

- Campaigns are seller-visible without a state filter, and the seller opt-in path does not re-check
  the campaign scope against the seller's store state; a seller could submit a campaign id from
  another state. The client only lists `LIVE`/`SCHEDULED` campaigns and shows the campaign scope,
  but the server-side scope guard should be added before relying on state isolation.
- `/seller/menus` is still reachable by direct URL for Mart/Pharmacy sellers; the nav and Explore
  no longer link it, but the page itself is not role-gated.

## Linked docs

- [`index.md`](./index.md) — catalog domain index
- [`../web-portal/seller-console.md`](../web-portal/seller-console.md) — shell + bottom-nav contract
- `docs/architecture/web-portal.md` — seller route table
