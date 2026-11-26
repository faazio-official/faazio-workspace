# Home feed (SDUI)

**App / route:** customer · `MainTabs` → `Home` (`src/features/home/HomeTabScreen.tsx`,
`HomeView.tsx`, `hooks/useHomeFeed.ts`)
**Status:** Shipped (server SDUI; rails are server-only while online)
**Trigger:** Authenticated app launch or Home tab focus.

## Steps

1. `HomeView` calls `useHomeFeed()`.
2. `gateway.getHomeFeed()` fetches `GET /sdui/home`.
3. The gateway compiles the Mongo layout (`sdui_layouts`) and joins each section's `productIds` and
   `storeIds` through `contracts.ProductReader` / `contracts.StoreReader`.
4. The app maps each section to a `HomeRow` and renders the matching section component.
5. Section components may fire their own supporting reads (ads, discounts, ratings) and add to cart.
6. The header category rail (`HeaderCategoryRail` → `usePagedRail`) renders every curated Mart +
   Pharma chip (unbounded, any tree level, FOOD excluded) in a horizontal ScrollView. It pages in more
   chips as the strip nears its right edge **and** whenever a page does not fill the viewport width,
   so nothing past page 1 is stranded. Tapping a chip pushes `CategoryDrillIn` for that category's
   app; a child chip opens that node's subtree. A standalone `MAIN_APP_HEADER` chip (e.g.
   "Electronics") carries `treeApp: 'MAIN_APP_HEADER'`: the drill-in walks that header's own
   sub-categories while the vendor body searches the Mart pool. Header-only sub-categories are never
   chips themselves — they are reached through the parent's drill-in.
7. The Home header is a collapsing overlay: while the feed scrolls, the **Mart/Food/Pharma sector
   row, the search bar and the category rail stay pinned**; only the logo/location row (and the
   location nudge) above them slide up and fade out. The Mart sub-app header pins its rail the same
   way. On the same gesture the floating **bottom nav slides down on scroll-down and back in on
   scroll-up** (`hooks/useAutoHideNavBar.ts`); the sub-app (Mart/Pharma/Food) navs do the same, and
   every nav re-shows on mount/focus/tab change.
8. The rail's slot is **not** reserved when the superadmin has curated zero chips: after the first
   fetch settles with no chips, `HeaderCategoryRail` renders nothing and reports
   `onAvailabilityChange(false)`, so the Home header (and the Mart sub-app header) closes the rail
   band instead of leaving a blank strip. During the first fetch the slot is reserved to avoid a
   layout jump when chips arrive.
9. Pull-to-refresh (`AppRefreshControl`) on the body re-fetches the feed and bumps the shared
   `refreshStore` `home` counter, which also re-fetches the sibling header category rail
   (`HeaderCategoryRail` → `usePagedRail`). Stale rows stay visible while the spinner runs; a failed
   rail fetch keeps the already-loaded chips (only an `app` scope change clears them) and logs the
   failure in dev.
10. If the rail has never loaded and the fetch fails, `HeaderCategoryRail` renders a single **Retry**
    chip (instead of a silent blank strip) that re-runs `usePagedRail().refresh`; the rail slot stays
    reserved while the retry affordance is shown.

## State

- `useLocationStore` — nearby origin for geo rails.
- Home product cards in the 3-up grids mount the shared `AddToCartControl`. Card body order:
  the pack size/unit sits on the left directly below the image, the **Add** pill on the right,
  the price row below those two, and the product name last.
- Every non-ad Home item card (3-up grids and horizontal rails alike) mounts the card-level
  **Add** control; the card body stays unit → **Add** on one line, price, then name. Paid
  placements (`AdProductCard`, sponsored rail) are the only Home cards without the shopper add
  action.
- Home grids (Men/Women/Kids, Hair & Skin Care, Discover) render as a compact **3-column** layout
  with square images; every Home section uses two-line product names (`nameLines={2}`) and hides
  the card rating (`showRating={false}`).
- `useRefreshStore` — cross-component pull signal (`home` counter) shared by the feed and the
  header rail, which are siblings in the collapsing header.
- `useHomeFeed` returns `{ feed, loading, error, refreshing, refresh, reload }`; `refresh` sets
  `refreshing` and bumps the store, `reload` retries from the empty/error state.
- Local section state for carousels and pagination.

## Vertical rhythm

- **One owner per boundary.** A `SectionHeader` owns its top gap (`SPACE.SECTION`, 16) and its gap
  to its own content (`SPACE.BLOCK`, 8); no section adds its own `paddingTop`/`marginTop` for the
  same boundary and no grid adds a trailing `paddingBottom`.
- **Rail cards carry no vertical margin.** `ProductCardBase` sets `marginBottom: 0` for
  `variant="rail"`/`"flash"` and keeps `vs(12)` only for grid cards, so a horizontal rail's height is
  the card itself instead of card + 12dp of empty tail.
- **Section headers are 32dp rows**, not 44 — the "View all" control keeps a 44dp target via
  `hitSlop` instead of inflating the row and pushing the whole feed apart.
- Net effect: the gap between two rails is ~24dp (`SECTION` + `BLOCK`) rather than ~36dp, so the
  viewport stays filled on the Y axis without scrolling through dead space.

## Data path

- `gateway.getHomeFeed()` → `GET /sdui/home` → Mongo `sdui_layouts` + Postgres `catalog.products`,
  `directory.stores`.
- Cache: `faazio:v1:gateway:sdui:{locale}:/home` (300 s), purged on SDUI publish.
- Supporting: `getProductsByIds` (`POST /products/batch`), `getActiveDiscounts`
  (`GET /promo/active-discounts`), `fetchCategoryRail` (`GET /categories/rail` — active rows tagged
  `MAIN_APP_HEADER` in `taxonomy.category_headers` (`0115`), with the legacy `show_on_home_rail`
  column still honoured as a fallback; unbounded Mart + Pharma combined, any tree level; FOOD is
  not eligible). The rail endpoint sits behind the same `auth.Require` middleware as the rest of the
  app, so an unauthenticated/expired session gets a `401 authentication required` (surfaced by the
  Retry chip), not an empty server list.
- Offline shell: `@data/home/sections` registry + section fixtures, used only when the gateway is
  disabled. Online rails render server rows or an honest empty/error state.

## Success / error / empty

- **Success:** server section order and joined rows.
- **Loading:** honest "Loading your feed..." until the SDUI read answers.
- **Refreshing:** `refreshing` true drives the branded spinner; existing rows stay on screen. A
  failed pull keeps the rows, stops the spinner and flips `error` — it never blanks or fabricates.
- **Error/offline:** online error → retry; gateway disabled → static registry + fixtures.
- **Rail error:** the header rail never silently blanks. On failure it keeps the chips already
  loaded for the current scope (the shared `home` pull does not clear them) and, when it has no
  chips, renders a Retry chip. The failure is logged in dev with the error (e.g.
  `GatewayHttpError 401 unauthorized`).
- **Rail empty:** zero curated chips (superadmin deactivated every rail category) collapse the rail
  slot entirely — the header shrinks and no blank band/margin is left. Only a failed fetch keeps the
  slot (Retry chip).
- **Empty:** a section with no rows is omitted or shows an honest empty note.

## Known gaps

- A pull re-reads the same 300 s Valkey-cached SDUI doc, so it can return identical content until
  the key lapses — see [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md). No fixture substitution.

## Linked docs

- `docs/architecture/data-layer-sdui.md`
- `docs/architecture/monolith-breakdown.md` (recommendations/SDUI row)
- `data/DATA_CONTROL.md` (`@data/home`)
