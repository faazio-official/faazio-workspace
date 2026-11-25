# Shop page ads — per-shop storefront playlist

**App / route(s):** seller web portal · `/seller/ads` (`app/seller/ads/page.client.tsx` →
`app/seller/ads/components/StorefrontPlaylist.tsx`); rendered on the customer store page via
`STORE_TOP` (`client/mobile/src/components/shared/CampaignHero.tsx`)
**Status:** Shipped (DB-backed: `ads.campaigns`, migration `0135`)
**Trigger:** Seller opens **Ads** in the console and picks a shop in the shop switcher (the active
store scopes the playlist).

## Steps

1. Open `/seller/ads`. The **Shop page ads** card lists the active shop's `STORE_TOP` rows in play
   order (`sortOrder` ascending), each with a thumbnail, `#position`, status pill and click target.
2. **Add** → the inline editor opens. Choose **Opens**:
   - **This shop page** (`targetType STORE`, `targetId = storeId`), or
   - one of the shop's ACTIVE products (`targetType PRODUCT`) — only items on this shop are offered.
3. Enter title (≤40), subtitle (≤60), upload/paste the 16:9 poster (R2 CDN only) and pick a CTA
   (`Shop Now` / `Order Now` / `View Store` / `Buy Now`). A live 16:9 preview renders the creative.
4. **Save draft** writes a `DRAFT` row (hidden from the app). **Play now** writes/updates it `LIVE`
   (served by the app immediately). The new row is appended at the end of the playlist.
5. Edit an existing row with the pencil (fields + target), pause a LIVE row (`Pause` → `DRAFT`), or
   play a draft (`Play` → `LIVE`).
6. Reorder with the up/down arrows; the full ordered id list is persisted (`sortOrder = index`). The
   customer app carousel plays LIVE rows in that order.
7. Delete removes the row (an admin-taken-down `REJECTED` row is kept; only an admin restores it).

## State

- Portal `usePortalStore.heroCampaigns` (hydrated from `GET /ads/campaigns`; refreshed after every
  playlist write) — read through `useHeroCampaigns({ sellerId, storeId })` and filtered to
  `placement === "STORE_TOP"`.
- Active shop scope: `useSellerScope()` (`storeId`, `activeStore`, shop switcher).
- Product picker: `useProducts({ sellerId, storeId, status: "ACTIVE" })`.

## Data path

- `saveShopAd()` → `POST /ads/campaigns` `{placements:["STORE_TOP"], status:"DRAFT"|"LIVE", sortOrder,
  targetType, targetId, storeId, title, subtitle, imageUrl, cta, startsAt, endsAt}` →
  `ads.campaigns`. The gateway derives `target_app`, enforces ownership (the target belongs to this
  seller **and this store**), R2-CDN poster, bounds and the 90-day window; only LIVE consumes the
  8-row per-shop cap / daily publish budget.
- `updateShopAd(placementId, patch)` → `PUT /ads/campaigns/{id}` → `ads.campaigns` (edit / pause /
  play; placement + seller immutable; `DRAFT→LIVE` re-checks the cap; a seller cannot restore
  `REJECTED`).
- `deleteShopAd(placementId)` → `DELETE /ads/campaigns/{id}` → `ads.campaigns`.
- `reorderShopAds(sellerId, storeId, ids)` → `POST /ads/campaigns/reorder` → `ads.campaigns.sort_order`.
- Every write purges `faazio:v1:ads:hero:` (the anon hero cache); the app reads
  `GET /ads/hero?placement=STORE_TOP&app=…&storeId=…` (`CampaignHero`) and reports impressions/clicks
  via `POST /ads/events`.
- No optimistic fake ids: playlist writes are awaited, then `refreshHeroCampaigns()` re-reads the
  server rows before the seller edits/reorders them.

## Success / error / empty

- **Success:** toast (`Draft saved.` / `Ad is live on your shop page.` / `Ad is playing.` /
  `Ad paused (saved as draft).` / `Ad deleted.`), and the list reflects the server state.
- **Error:** the awaited write rejects, the toast shows the gateway message, and the list is left
  unchanged (nothing is optimistically applied).
- **Empty:** "No shop page ads yet — add a creative and it plays in order." No placeholder ad is
  fabricated.
- **Cap:** adding is disabled at 8 rows; a 9th LIVE row is rejected by the gateway.

## Known gaps

- This card manages only the `STORE_TOP` (shop page) surface; the buy-a-hero `CampaignWizard` below it
  still covers `HOME_HERO`/`MART_HERO`/etc. Drafts are not scheduled (starts/ends keep the gateway
  default window).
- No drag-and-drop reorder (up/down only, by design for the seller WebView app).
