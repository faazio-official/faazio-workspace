# Mobile App Architecture Deep-Dive

> **Status:** LIVE · **Scope:** `client/mobile/` — the bare React Native SuperApp.

## Stack

| Layer | Choice |
|---|---|
| Framework | **Bare React Native** (committed `android/` + `ios/`) |
| React Native | **0.86.3** (New Architecture, Hermes) |
| React | **19.2.3** |
| State | **Zustand** (`src/state/`) |
| Navigation | React Navigation — Native Stack + Bottom Tabs |
| Lists | `@shopify/flash-list` |
| Data | `@data/*` (root `data/`, see `data-layer-sdui.md`) |

## Why this exists

This is the **only live runtime**. The root Vite web app was removed (see git history);
all active product work ships through this app. It is a multi-sector "superapp":
mart (which now includes the former grocery catalog), food, pharma, plus
cross-cutting home/search/cart/profile.

## Module map (`src/`)

```
src/
├── App.tsx                     # root — providers + AppNavigator
├── components/                 # global atomic UI (AppText, FaazioLogo, shared/, …)
│   # FaazioLogo: `default` = 2171×724 vector badge (Home/Splash); `welcome` = 855×292
│   # raster wordmark (onboarding header). `welcome` ships as a PNG extracted from
│   # the designer SVG (source at assets/brand/logo-welcomepage.svg) to avoid the
│   # fragile react-native-svg `<Image>` + base64 data-URI path; size is applied to
│   # the visible glyph box (829×227) so both variants share one optical scale.
│   └── shared/                 # 15 reusable primitives (ProductCardBase, StoreCardBase, Screen, AdBannerCarousel, …)
├── features/                   # vertical feature modules (16)
├── navigation/                 # AppNavigator, MainTabs, FoodStack, types
├── services/                   # GatewayClient, logout, secureSession, categoryVendors, homeFeed, pricing
├── state/                      # Zustand stores (15)
├── theme/                      # brandTokens, spacing (SPACE tokens), fonts, sectorVisuals
└── utils/                      # responsive (hs/vs/ms/wp/hp)
```

### Features (`src/features/`)

`auth` · `cart` · `catalog` · `delivery-partner` · `ecommerce` · `favourites` · `food` · `home` ·
`onboarding` · `pharma` · `product` · `profile` · `rewards` · `search` · `seller-partner` · `sub-app`

`delivery-partner` is the **standalone Delivery Partner app** (not a customer route): see
"Delivery Partner app" below.

The former `grocery` sub-app was removed: grocery products/stores merged into Mart
(`ecommerce`), the `GROCERY` `SubAppId` was dropped, and the `grocery-home/` components,
`GroceryScreen`, `GroceryProductCard`, `SearchGroceryProductCard`, `grocerySearchConfig`
and the `grocery` search/favourites toggles were deleted. Grocery categories now surface
under the Mart rail chips (merged into the `FA_MART` category tree).

The Mart home feed's **"Local Vendors Near You"** rail now renders the richer `martStores`
(`StoreProfile[]`) instead of the retired `MART_LOCAL_VENDORS` mock, with an empty state. The
in-section **search bar** and **category pill filter** (`VendorCategoryPills`) were removed (the
Mart header search + header category rail are untouched); the section shows the full vendor list.
Tapping a store opens the
vendor drill-in, whose inventory is served by the gateway
(`GatewayClient.getStoreProducts` → `GET /stores/{id}/products`, `catalog.products` filtered by
`store_id` + `status = 'ACTIVE'`, replacing the local `martProducts` filter / old `lv-*` product
map). The local `catalogIndex`/`getCatalogEntriesByStore` mirror is the offline fallback. The vendor
drill-in's **"Discounted Products" rail** lists the vendor's own on-offer products (authored MRP or
an active festival opt-in) and is **unlabelled** — it is organic merchandising, not paid placement
(only genuinely sponsored surfaces carry the shared 'AD' pill via `showAdLabel`). The **"All
Products"** grid below is a
viewable `FlatList`, so its cards emit passive `view` impressions (deduped per session by
`trackProductView`), the same as the Mart feed rails and search grid. The vendor header **trust
rail** (`VendorHighlights`) derives its badges from the store row (`deliveryTime`, `rating`) instead
of a hardcoded claim.

The Mart feed **search mode** (header searchbar query) now calls `GatewayClient.searchProducts(q, 'MART')`
— the server FTS index (`GET /search`) — with the local filter as the offline fallback, so results are
no longer limited to the local `@data` fixture pool. A `search` behavior event is emitted for the top
result (mirrors `SearchScreen`). This in-wrapper filter is a **distinct, lightweight path** from the
pushed `Search` route (`search/configs/martSearchConfig`, `subApp: 'FA_MART'`): both hit the same server
FTS, but only the pushed route carries facets + sort. QA should exercise both.

The **category drill-in** (`CategoryDrillInPanel`, route `CategoryDrillIn`) groups its store body from
the server: products come from `GET /search?q=&app=` grouped by `storeId` and joined to
`GET /stores?app=`, with the local token-containment grouping (`getVendorsWithProducts`) as the
offline authority / multi-word safety net, and approved festival discounts overlaid on the whole pool.
New seller `ACTIVE` rows therefore appear in the drill-in and its price matches checkout. The single
store inventory used by the in-wrapper vendor drill-in (`VendorProfileView`) and the pushed vendor page
(`VendorDetailScreen`) is shared through **`features/catalog/hooks/useVendorProducts`** (server
`GET /stores/{id}/products` + festival overlay), so the two surfaces can never diverge.

The Mart feed **hero** is a **paid `MART_HERO` placement** (`CampaignHero`; see the paid-hero
campaigns note below) — the old organic `MartHeroCarousel` and its `MART_HERO_BANNERS` fixture are
retired. Its house fallback is the remote SDUI `martHero.banners` (`MartHouseHero`), shown only when
there is no LIVE fill and collapsed to nothing when empty. The **"Deals of the Day"** and **"Daily
Essentials"** rails (`DealsOfDayRail`/`DailyEssentialsRail`) are **server-controlled** through the same
Mongo SDUI home doc (`martService.fetchMartFeed` → `gateway.getMartFeed()`, `GET /sdui/mart`):
`martDeals.productIds` / `martEssentials.productIds` are edited from the portal's *App content (SDUI)*
page, so rail membership and rotation change with no app release. Both rails now have a **"View All"**
that opens `DealsLanding` in a catalog-resolved list mode (`martDeals`/`martEssentials`), and a tap
resolves the canonical catalog row (`openCatalogTarget` → `getProduct`) before the PDP, so a renamed /
redacted product never opens a stale copy. The `mocks/martHomeFeed.ts` fixtures (`MART_DAILY_ESSENTIALS`,
`@data/mart/deals`) are the offline first-paint fallback only; a present-but-empty SDUI section renders
empty (a portal typo stays visible). `fetchMartFeed` degrades each leg independently (`Promise.all` +
body guard) so a failing `GET /stores` or SDUI poll renders the remaining rails instead of a
never-ending skeleton. One batched `useActiveDiscounts` covers the Deals rail + Daily Essentials and is
shared with the paid shelf (`SponsoredRail` accepts a `discounts` prop); the vendor drill-in pool
overlays its own batch inside `useVendorProducts` (only while a vendor is open), so the shopper price is
identical on every surface with no duplicate request while the feed is on screen — a discount is never
synthesized. `useMartFeed` exposes a `refresh` (pull-to-refresh / retry); the offline body falls back to
the `martStores` fixture so the "Local Vendors" footer never blanks. The `DealsLanding` **`discounts`**-mode
grid also reads the vendor pool from the server (`getStoreProducts`), matching the vendor drill-in and
showing a loading/error state instead of a silent empty grid; `campaign` mode stays on the Home-owned
`@data` campaigns (only reachable from Home, not Mart). The feed's paid/organic section order + placement
is codified in `features/ecommerce/services/martFeedSections.ts` (`MART_FEED_SECTIONS`, consumed by
`FaMartScreen`); the full RN route registry is `PAGE_CATALOG.md` §2.

**Paid-ad measurement is auth-gated.** `POST /ads/events` sits behind `auth.Require`, satisfied by
the real Firebase phone-OTP session (configured builds); local dev can still use `AUTH_DISABLED=true`
+ `user-1`. `recordAdEvent` returns `boolean` (confirmed-only, no fabricated fallback) and logs a
dev warning with the HTTP + auth status, so an unreported event is never mistaken for a delivered
one. No anon event path is opened (avoids KPI poisoning).

Pharma's home feed ends with a pharma-local **"Local Medicals Near You"** rail backed by
`@data/pharma/stores`. Each stacked card shows distance, rating, delivery time, offer and a
**Visit Store** CTA that opens `MedicalShopDetails`; the rail has an empty state and intentionally
does not render a "View all" action. **(W50)** the "Popular Medicines" and "Health Essentials"
product rails and the house `PharmaHeroBanner` are now server-backed: `fetchPharmaFeed` reads the
Pharma-only `GET /sdui/pharma` projection (`GatewayClient.getPharmaFeed`, allowlisted
`pharmaHero`/`pharmaPopular`/`pharmaEssentials`, own compiled cache/ETag), joined to the catalog;
the paid `PHARMA_HERO` slot wins over `pharmaHero.banners` and the `@data`/feature fixtures remain
the offline fallback. Rx-gated products are never referenced. **(W53)** the feed overlays approved
festival discounts on the Popular Medicines rail (`services/pricing`, same pipeline as Mart), the
**Quick Reorder** shelf now carries real `ph-*` catalog ids (server-resolved via `getProductsByIds`)
so a tap opens a canonical PDP and an add-to-cart id checkout can price, and **Top Offers** are
filtered to live `GET /coupons?app=PHARMA` codes when online (never advertises a code checkout
can't settle). The header search bar is server-backed (`searchProducts`, `withActiveDiscounts`),
matching Mart and the first-class Search tab. The dead `DealsLanding` `app:'PHARMA'` param was
removed — Pharma rails' "View all" opens the first-class Search route, not the Mart deals landing. `MedicalShopDetails` keeps the pharmacy boundary local
while using `useVendorProducts` (`GET /stores/{id}/products`, festival-overlaid) and
`SearchPharmaProductCard` for its live product list.
Its shop info block includes the cover, contact details, hours and pickup address, and its
`UploadPrescriptionFAB` opens `PrescriptionFlow` with the pharmacy preselected.
**(W59)** Pharma residual honesty + routing closure: the `PharmaHeroBanner` coupon pill now renders
**only** when `feed.heroCouponCode` resolves — the **first Top Offer's** code (`PharmaFeed.heroCouponCode`;
the editorial fixture in mock, the top server-honoured `GET /coupons?app=PHARMA` code when online, else
`null`) — and the fabricated "UP TO 50% OFF" badge was deleted, so the hero never advertises a code
checkout can't settle; the **History** tab reads real
`useOrdersStore` orders (newest-first, `PHARMA_RECENT_ORDERS` is the mock-mode first paint only, with
an honest empty state when remote returns none) and tapping an order opens `MyOrders`
(`highlightOrderId`); the **Health Corner** card is now a static `View` (no dead "Read More" tap) when
it has no handler; PH7 Featured Brands / PH8 Health Corner stay intentional **static-editorial** (the
portal SDUI editor cannot author new sections — promotion deferred). Routing: `CategoryDrillInScreen`
sends `app='PHARMA'` vendors to `MedicalShopDetails` (defensive single `STORE_TOP` host), and the
shared PDP resolves PHARMA stores (`pharmaStores`), pulls PHARMA related products, renders the store's
real address/hours, tags its "More from store" grid `appBrand='PHARMA'`, and **View Vendor** → `MedicalShopDetails`.
Blood donor: `BloodRequestDescription` gained an optional `source` provenance param and `useBloodRequests`
now returns `settled` — a **cold deep link** waits for the live board before judging a `requestId`
missing (a fixture id is never rendered as a server row), and `NearbyRequestCard` no longer prints
"0 km away" for live rows that carry no geo (distance is omitted when unknown).

**Home "Deals of the day" vendor-campaign zone** (`features/home/sections/BrandCampaignsSection.tsx`,
section id `hotBrandDeals`): the renamed section (was "Hot Brand Deals") renders **two stacked,
auto-playing paging carousels** on the purple `#EDE9FE` container. Each carousel item is a white
`BrandCampaignCard` (`features/home/cards/BrandCampaignCard.tsx`) — a bold **vendor-name title**
with a "View all →" action, a computed **"Up to X% off"** discount label below (derived from the
campaign products' max discount — no `offerTag`/EMI text), and a 2-product row of bigger minimal ad
cards (`features/home/cards/AdProductCard.tsx`: a large **square** image with an `AdLabelBadge`
'AD' pill bottom-right, a bigger 2-line title, slashed grey MRP + bold black price — no
plus/badge/rating; laid out flexibly to fill the row). Carousels auto-play every ~4.5s (pattern lifted from `AdBannerSection`) with
paging dots, manually swipeable; timers clear on unmount and re-anchor on `width`. The campaign
defs are now **server-owned (W50)**: the super-admin SDUI editor publishes the ID-only
`{id,storeId,productIds,carousel}` list on the `hotBrandDeals.campaigns[]` leaf, `HomeView` threads
it into `BrandCampaignsSection`, and the gateway compiles it into the anon
`GET /home/campaigns(/{id})` projection (`GatewayClient.getHomeCampaigns`/`getHomeCampaign`).
`@data/home/campaigns.ts` (`adCampaigns`, each referencing a **real Mart vendor by `storeId`** plus
catalog products **by id only**) stays the offline fixture / pre-load fallback, and
`BrandCampaignCard` still resolves store + products locally via
`getCampaignStore`/`getCampaignProducts` so the carousels never blank offline. The "View all" opens
the **`DealsLanding`** route in `campaign` mode, which reads the server-joined store + products
(fixture fallback) — see nav graph. The sibling `DealsOfDaySection` (title
"Daily Essentials") is a display-only rename — its section id `dealsOfDay` is unchanged; it now
loads its products from the catalog (`getProductsByIds`) with the `MART_DEALS` fixture as the
offline first-paint/fallback.

**Home sponsored rail** (`features/home/sections/SponsoredRailSection.tsx`, section id
`sponsoredRail`, titled "Sponsored picks", placed after `dealsOfDay`): a **paid, separately-labelled**
rail fed by the ad-server (`GatewayClient.getSponsoredProducts('HOME_TOP')` → `getLiveAds` +
`getProductsByIds` catalog join) — deliberately not the editorial `BrandCampaignsSection`, so paid and
organic never share a ranked shelf. Renders a horizontal `UniversalFeedCard variant="rail"` with the
shared `showAdLabel` AD pill; the header (i) opens a "Why sponsored?" `SlideUpSheet`. Fill-rate
contract: no LIVE rows, offline, or error → renders `null` (the feed collapses seamlessly), never an
empty shelf. Editorial `hotBrandDeals` is served from the SDUI doc (`campaigns[]`, W50) with the
`@data` fixture as the offline fallback.

The rail itself lives in the boundary-safe **`components/shared/SponsoredRail.tsx`** (placement fill +
`POST /ads/events` impression/click + last-click attribution + AD disclosure), with each sub-app
supplying its own card. It is consumed at three placements: `HOME_TOP` (Home, above),
`SPONSORED_SHOWCASE` (Mart home feed, `FaMartScreen`), and `SECTOR_RAIL` (vendor "Discounted Products"
landing, `DealsLandingScreen`). See `caching-cloudflare-valkey.md` §5a.

**Paid hero campaigns** (`components/shared/CampaignHero.tsx` + `hooks/useCampaignHero.ts`, **W41**;
self-serve hosts **W42**): the top-of-surface counterpart to the rail — a labelled 16:9 carousel fed by
`GatewayClient.getHeroAds` (`GET /ads/hero?placement=…`, Valkey 300 s) whose deep-link target
(`PRODUCT`/`DISH` → PDP, `STORE`/`VENUE` → vendor page, dish-without-catalog-row → its restaurant page)
is resolved server-side (`services/adsTarget.ts`), rendered through the shared `AdBannerCarousel`
(`accessibilityLabel="Sponsored"`, one guarded impression per creative). Every hero surface is now a
paid placement — the organic `MartHeroCarousel` and the Home `topAdSlides` fixture are retired: all six
placements (`HOME_HERO` @ Home hub, `MART_HERO` @ Mart, `FOOD_HERO` @ Food feed, `PHARMA_HERO` @ Pharma,
`CATEGORY_TOP` @ category drill-in scoped by `category`, `STORE_TOP` @ Mart vendor / Pharma medical
shop / restaurant profile scoped by `storeId`). Fill-rate contract: no LIVE fill → `null` (the hero
collapses), never a fabricated ad; the same `POST /ads/events` impression + click + last-click
attribution pipeline applies. Users can flag a bad ad via `GatewayClient.reportHeroAd`
(`POST /ads/campaigns/{id}/report`) — a human admin performs any takedown.

**Home "Today's Special" randomized rails** (`features/home/sections/TodaysSpecialsSection.tsx`,
section id `diningSpecials`, titled "Today's Special"): renders **two stacked, independent
horizontal rails** of randomized cards drawn from a combined pool of **Food + Mart + Pharma**
products (`TODAYS_SPECIALS` via `dishToProduct`, `recentlyViewedMart`, `hotBrandDeals`,
`recentlyViewedPharma`). Each rail scrolls horizontally on its own (no shared scroll state); the
mix is sampled once per mount so re-renders don't reshuffle. When the SDUI doc supplies rows
(`products` prop, W35) those replace the fixture pool. Cards are the shared
`UniversalFeedCard` (`variant="rail"`, `hs(116)` wide, **square 1:1** image with **rounded
corners**) — the same styling as the "Daily Essentials" (Deals of the day) rail. Rating, price,
badges and the add-to-cart control are hidden (`showRating`/`showPrice`/`showBadge`/`showAddButton`
off); taps open the shared `CommonProductDetailView`. Each rail samples up to `CARDS_PER_RAIL`
(10) items.

**Food "Today's Special Near You"** (`features/food/components/SpecialDishCard.tsx`, consumed only
by `FeaturedDishCarousel` ← `FoodHomeScreen`): a thin adapter over the Food sub-app's
`FoodProductCard` (→ shared `ProductCardBase`) passing the Home rail's exact props (`variant="rail"`,
`hs(116)` wide, `aspectRatio: 1` rounded image, name-only body with rating/price/badge/heart/add
hidden) — so the Food card is pixel-identical to the Home "Today's Special" card and the two can't
drift. Food renders a single rail of all diet-filtered specials (Home stacks two).

The **shared `AdBannerCarousel`** (`components/shared/AdBannerCarousel.tsx`) is the extracted Home
top-ad banner — a **16:9 full-width rounded card** (`AppImage` bg + overlay + badge + title/tagline)
that auto-advances every 4.5s with paging dots, manually swipeable, timer cleared on unmount and
re-anchored on `width` (skipped when there are fewer than 2 slides). It is presentation-only:
spacing comes from the caller via `style`, taps via an optional `onSlidePress` (no handler → the tap
is a no-op), an optional `showAdLabel` overlays the shared "AD" pill for genuinely paid placements, and
an optional `accessibilityLabel` (e.g. "Sponsored") labels each slide for screen readers. It is the
render layer for every paid hero, driven by `components/shared/CampaignHero`. Pharma's
`PharmaHeroBanner` stays a **16:9** house band below the `PHARMA_HERO` paid slot (single source of ratio
for the one-card-per-row banners).

The **Mart Product Detail** (`CommonProductDetailView`) renders a store section below the
"Product Details" block for any MART product with a resolvable `storeId`: a store card
(cover thumb + rating chip, name + verified badge, location line, open/closes row), a
**"More from {store.name}"** 2-column related-products grid (same-store catalog rows served by
`GatewayClient.getStoreProducts` → `GET /stores/{id}/products`, with the local `martProducts` filter
kept as the offline fallback; rendered with the shared `ProductCardBase` so the ecommerce-cards
boundary stays green — only Add / quantity steppers are interactive, card press is disabled), and a
**"View Vendor"**
button. "View Vendor" pushes `SubApp` with `subAppId: 'FA_MART'` plus the optional
`initialVendorStoreId` param, which `SubAppWrapper` uses to open the vendor drill-in directly
(header/tab-bar auto-hide for free). FOOD/PHARMA products, deals and products without a
`storeId` render no store section.

The shared **Product Detail** (`CommonProductDetailView`) also renders a FOOD vendor card for
any FOOD product (below "Product Details") resolved by `product.shop` against `@data/food/stores`
`foodStores` (name + verified badge, desc, open/distance/delivery row; name-only header when the
restaurant isn't in `foodStores`), plus a **"More from {restaurant}"** 2-column grid of the
restaurant's other `TODAYS_SPECIALS` (via `dishToProduct`). Card tap pushes another `ProductDetail`
(`onOpenProduct`); grid + footer adds for FOOD are **direct** (the fulfilment gate was
removed — the mode is chosen later on the cart BAG step). The old "Free Delivery / COD /
10-Day Return / Assured" trust block was removed from the shared view (applies to MART/PHARMA
too — one component).

`seller-partner` is the **standalone Seller Partner app** (not a customer route). Sellers log in
with the same email/password as the web portal (gateway HS256 portal JWT; roles SELLER /
DISTRICT_ADMIN / SUPER_ADMIN), then accept incoming NEW orders (→ PACKED, auto-dispatch) or reject
them (→ REJECTED, captured payment marked REFUNDED and the customer notified). Delivery riders keep
their separate `delivery-partner` app.

Pharma hosts the **Blood Donor** feature (`pharma/blood-donor/`) — a 5-step registration
wizard (persistent draft/registration via AsyncStorage; the wizard closes permanently on
submit) + a registered-donor dashboard (`DonorDashboard` — targeted "Requests for You"
section plus the hospital request feed with filter chips + search; rendered inside the
Pharma wrapper with the navbar kept and the gradient header hidden), entered via the
`Droplet` tab in the Pharma navbar. Both the wizard and dashboard host a floating
**"Ask Blood"** action (`AskBloodSheet` on the shared `SlideUpSheet`) that collects only
city and blood group, then resolves matching donors through the async
`services/donorDirectory.ts` repository seam. **(W53)** the seam is **remote-first**: it reads the
consented, auth-scoped `GET /donors` (`blood.donor_directory`, `consent AND available` only) and
falls back to the `@data` fixtures only offline/mock — health PII is never served outside the
consent gate. Selecting a donor opens `BloodDonorDetails`,
where the user can send one targeted `DonorMatchRequest` (durable via `POST /donor-match-requests`).
**(W53)** the wizard registration (`PUT /donors/me`), the "interested"/"accepted" toggles
(`PUT /blood-requests/{id}/interest`) and the targeted match are written to the server as
**outcome-returning** calls (`saveDonorProfile`/`setBloodInterest`/`createDonorMatch` →
`synced`/`offline`/`signed-out`, mirroring `submitVendorRating`), not `void …catch`. The store
commits optimistically to AsyncStorage, tags the row `pendingSync`, and queues a `PendingDonorOp`
in the same `faazio/bloodDonor/v1` blob when the write is non-durable; the outbox is flushed on
hydration and on app foreground, and `hydrateFromServer` reconciles the server rows over the local
mirrors (server wins by id, local-only preserved) — a silent failure can no longer look like
success. Mock mode (remote disabled) keeps the device mirror as the final home (no pointless queue).

**(W54)** the targeted-match loop is now closed and recipient-scoped on the server. `DonorDashboard`
renders **Requests for You** from the server's incoming list (`GatewayClient.getIncomingDonorMatches`
→ `GET /donor-match-requests/incoming`, `blood.match_requests.donor_user_id = caller`), so a targeted
ask arrives on the recipient's device instead of only the device that created it. `IncomingDonorRequestCard`
gains **Accept**/**Decline** actions while a request is `pending` and shows the live status pill
otherwise; `bloodDonorStore.respondToMatch` writes `PUT /donor-match-requests/{id}/status`
(recipient-only, pending-only) as an outcome-returning call, optimistically updates the local mirror,
and queues a `match-status` outbox op when non-durable (reconciled on foreground; a queued response is
never reverted by a stale server read). The server enqueues a PII-free `MATCH_ACCEPTED`/`MATCH_DECLINED`
notification to the requester; the requester's outgoing row
(`getDonorMatches`) carries the real status, so `BloodDonorDetails` shows "Donor Accepted" / allows a
re-request after a decline. Contact is still not disclosed on acceptance (reveal-gated sharing remains
future). `AskBloodSheet` gains a **Post to the public board** action (search + results stages) that
writes `POST /blood-requests` via the outcome-returning `createBloodRequest` and reloads the board;
it never fabricates a local row. The dashboard bell is now a non-interactive, **honest** indicator
(live server notification count + pending incoming — no seed, no dead tap) and the funnel opens a
`FilterSheet` (blood group / urgency / city) over the existing board filters.

The dashboard hospital-request feed is **server-backed** (`hooks/useBloodRequests` →
`GatewayClient.fetchBloodRequests()` → `blood.requests`, a no-fallback read that throws
`GatewayOfflineError` instead of fabricating rows). Server rows are mapped onto the app's
`BloodRequest` card/detail shape; display-only extras the server does not carry
(`imageUrl`, `purposeDescription`, patient age/gender, `distanceKm`) are borrowed from the
`@data/pharma/bloodRequests.ts` fixture when the id matches and otherwise rendered as graceful
"not provided" (the detail screen conditionally hides the photo, age/gender, contact and location
rows). `contact`/`address` come from the server (present for an authenticated caller, redacted for
anon) — no PII is widened in the projection, and **(W53)** a redacted/absent server value is
rendered blank, never backfilled with a fixture lookalike. **(W53)** the hook returns
`{ requests, source }` (`live` | `empty-authoritative` | `offline-fallback` | `cache-stale`): a live
`200 []` renders an honest empty card, while a fetch failure shows the fixture/cache with a
"Showing saved requests — offline" chip — never blank, never lie. A module-level cache of the
resolved feed means the detail screen (which resolves by `requestId`) renders instantly after the
dashboard has loaded. The same `{ … , source }` provenance is exposed by `usePharmaStores`
(`fetchStores('PHARMA')`) and `pharmaService.fetchPharmaFeed` (`fetchPharmaSections`), which show a
"sample pharmacies — offline" chip when the live rails are unavailable.

Targeted donor discovery (`services/donorDirectory.ts`) is equally provenance-aware: `findMatchingDonors`
reads `GET /donors` through the no-fallback `GatewayClient.fetchBloodDonors` and returns
`{ donors, source }`. A live `200 []` is an honest `empty-authoritative` ("no consented donors right
now" — the fixture is **not** substituted, since a health-PII directory must never show fixture donors
as if consented), while a fetch failure returns the `@data` fixture filtered to the query with
`offline-fallback`, shown behind a "Showing saved donors — offline" chip in `AskBloodSheet`. The
selected donor's `source` rides the `BloodDonorDetails` route so `getDonorById(id, source)` resolves
only from server rows for a live/empty search (an unknown id = the honest "no longer available"
screen), and from the fixture only for an offline/fallback search. Un-tapping "Interested" now
propagates: `bloodDonorStore.toggleInterested` calls `clearBloodInterest` (`DELETE
/blood-requests/{id}/interest`) and queues an `interest-remove` outbox op when offline — no longer
device-local only.

`search` hosts the shared `SearchScreen` shell (`features/search/SearchScreen.tsx`) plus
per-sub-app configs (`configs/*`). Product search (Mart / Pharma / Home Hub)
renders **one dense row per result** via the shared `SearchProductRowCard`
(`components/shared/`) — a slim one-line **vendor header** (small bold store name +
tiny Store icon, hairline divider) above a row layout with a contain image, 1-line
title/description and a `price` line (seller resolved from the `@data/directory/stores`
table via `storeId`, else `shop`, else the app's single outlet, else category) plus a
compact Add to Cart / quantity stepper. `showStoreHeader` can hide the header (the
single-store `VendorDetails` page passes `false`). Food search is dishes-only: it renders
one row per result via `SearchDishCard` (edge-to-edge, no horizontal gutter) with no
Restaurants mode and no toggle rail (`showToggles: false`, single seeded "Dishes" toggle).
No config uses a 2-column grid anymore.

Product card images on the Mart / Pharma / Food pages (and the Home rails that reuse the
same wrapper cards) are **1:1 square** (`imageAspect = 1` on `ProductCardBase` and the
Mart / Pharma / Food wrappers, plus the standalone `MartDealCard`); the shared base
defaults to 3:4 so the product-detail "More from store" grid and search-result rows keep
portrait images.

**Flipkart-style type-ahead suggestions** (`features/search/suggestions.ts` +
`SearchSuggestions.tsx`): while the user types but has not committed, the shell swaps
everything below the header for a suggestion list. `buildProductSuggestions()` is a pure
engine ranking products by name prefix > name substring > category match (dedupe by id,
cap 8), each row a thumbnail · name · blue "In \<category\>" subtitle · ↖ ArrowUpLeft; a
"Search for '\<query\>'" row covers zero matches. Tapping a row commits the term, records it
in recents and blurs. Wired via the optional `buildSuggestions` on `SearchScreenConfig`
(Mart / Pharma / Home-Hub use `buildProductSuggestions`; Food is deferred — different item
shape). Recent searches still show on empty query; seeded deep-links (`initialQuery`)
commit immediately so they skip suggestions and show results as before.

**Category drill-in + vendor details** (`features/catalog/`): a rail chip (Home hub or Mart
sub-app header) opens `CategoryDrillInScreen` (route `CategoryDrillIn`, params `tabId`/`title`/
`app`). `CategoryDrillInPanel` resolves the tab from `MASTER_CATEGORIES[app]` (falling back to the
first tab) and flattens `subgroups → items` into a **flat, unbounded pill rail** of every
sub-category title (`CategoryTitleRail` — first auto-selected; inactive chips transparent with dark
text, the active one filled with the **Faazio-blue** page accent; no grouping). The page is a brand
surface, so it uses `#1162D3` rather than the per-app `MART_ACCENT`/`PHARMA_ACCENT`. For the selected
title it renders a **store-grouped body**: the paid **`CATEGORY_TOP` hero carousel** (ad-server fill;
AD-labelled, tap → its server-resolved product/store; collapses when unfilled), then one
`StoreProductSection` per matching store — a **store-name heading** (tap → vendor page; rating ·
distance, no chevron) over a **continuous vertical list of one-per-row `ProductRowCard`s** (96px square
image left; name/desc/price + discount and the add/stepper on the right; cart wired via
`useCartProductActions`, card tap → `ProductDetail`). Only this one hero is shown per page; it is real
paid inventory (the old store-derived ad slides with a fake `SPONSORED` badge were removed). An
**inline searchbar** (this page only) live-filters the store list by name/locality; a title with no
matching stores shows a subtle "No vendors yet" row. Selecting a different rail chip resets the
search query **and** snaps the body back to the top. Every one of the 112 `MASTER_CATEGORIES` titles
is seeded to resolve ≥1 vendor (guarded by `npm run check:drillin`), so the page never opens empty.
Vendors/products are grouped by `storeId` via the repository seam `services/categoryVendors.ts`
(`getVendorsForApp` + `getVendorsWithProducts` — per-token match over the same `searchableText` as
the search configs, grouped per store, sorted by match count then rating; `getVendorProducts`).
Tapping a store pushes `VendorDetailScreen` (route
`VendorDetails`, params `storeId`/`app`/`initialQuery`) — a back arrow with an **inline searchbar to
its right** (auto-focused, title query pre-applied), a compact profile block, and a one-per-row
product list reusing `SearchMartProductCard`/`SearchPharmaProductCard` (per-app), plus a
results-count line and a "No matches" empty state.

The Home hub header (`features/home/HomeTabScreen.tsx` + `hubHeader.ts`) is a **fixed-height
 overlay that collapses via transform only**. `headerOuter` is `position:absolute` with a static
 `height = expandedHeaderH(top)` and is never animated; the inner `headerSlid` stack slides up with
 a `translateY` (`headerSlideStyle`), so the header never triggers a per-frame layout pass. The
 list container is full-screen with `contentContainerStyle.paddingTop = expandedHeaderH(top)`, so at
 rest the first section sits flush below the expanded header and, as the header slides up, the
  freed area simply reveals already-laid-out content. It pins a compact **category rail**
  (`components/shared/HeaderCategoryRail.tsx`) below the search bar, fed by `usePagedRail` over
   `@data/categories/railFeed` (derived from the merged Mart category tree). The same rail is reused
   by the Mart sub-app header (pinned below its searchbar). Tapping a chip opens the **category
   drill-in page** (`features/catalog/CategoryDrillInScreen.tsx`, route `CategoryDrillIn`) scoped to
   that tab (see below). On scroll the header
 **shrinks**: the `headerSlid` stack translates up by `min(clamp, collapseCap)`, and the two blocks
 that would otherwise be hard-clipped fade out **on the UI thread** (Reanimated, reading only
 shared values — no JS work per frame):
 - **Top block** (logo/location row + sectors row) — `fadeTopBlockStyle`, opacity `1 → 0` across
   `clampProgress 0 → 0.5·cap`. Fading (not clipping) is what hides this block cleanly and also
   removes the clipped sectors-row remnant that would otherwise poke under the status bar at full
   collapse.
 - **Top block** fades (see above); the **rail block does not** — the category rail stays fully
   visible and interactive on collapse, mirroring the search bar. It renders at constant opacity
   (plain `View`, no `useAnimatedStyle`, no ghost-touch guard) so the chips remain tappable at all
   times. The collapsed header's reserved height (`collapsedVisibleHeaderH`) already keeps the
   search bar + rail zone on-screen, so the rail persists without any geometry change.
 The top block uses `renderToHardwareTextureAndroid` (safe because the elevated search-bar shadow
 was removed). `clampProgress = clamp / collapseCap` (guarded when the measured cap is `0`);
 scroll-up reverses the same curve for automatic fade-in. All `useAnimatedStyle` closures read
 only shared values (`clamp`, `collapseCap`, derived `clampProgress`) + primitives, which keeps
 reanimated stable on Fabric. The rail height is captured in `HEADER_RAIL_H`.

The rail itself is a **plain horizontal `ScrollView`** (not a FlashList) — this region animates
 every frame, and the FlashList virtualization machinery (measure/recycle/commit) would otherwise
 re-rasterize inside the sliding overlay. The data is tiny and static (paged slices of a fixed
 array), so a `ScrollView` with a right-edge `loadMore` scroll handler is sufficient; the same
 pattern lives in `features/home/cards/FilterChipsRail.tsx`.

Visually, the header blends into the `#f1f5f9` content below: the **gradient is fully opaque**
 (`HubGradient` — all stops `stopOpacity: 1`; no 15% bleed-through that would ghost scrolling
 content under the overlay), has a square bottom edge (no rounded corners) and no drop shadow, the
 rail renders as plain inline black text chips (no pill background/border), and a soft band
 feathers from the vertical middle of the search bar into the `#f1f5f9` background, completing
 just below the search bar (`HEADER_BOTTOM_PAD` under it) — everything below reads as slate
 padding that merges with the list background, so the collapsed header shows only the search
 bar + padding rather than a tall blue slab. The search bar is **de-elevated**: no `shadow*`/`elevation`, replaced with a
 `borderWidth: 1` + `borderColor: rgba(0,0,0,0.05)` — elevation inside a clipped, transformed,
 opacity-animated overlay is a documented Android artifact source (RN issues #32078 / #25093 /
 #23090), so it must not coexist with the fades.

**Top-inset convention:** one canonical source of truth — `useSafeAreaInsets().top`. The Home
header and every sub-app header (`SubAppHeader` via `subAppHeaderH(topInset, compact, withRail?)`) read the
same measured inset; never use `StatusBar.currentHeight` (a static module constant that is `0`
on iOS and stale on Android edge-to-edge). The optional `withRail` adds the pinned rail slot
(`SUB_HEADER_RAIL_H`, mirroring the Home `HEADER_RAIL_H`) — passed for the Mart sub-app header.

**Bottom-inset convention:** reserved **once, centrally** by `App.tsx`'s `AppLayout`, which pads the
whole app with `useBottomInset()` (`src/utils/responsive.ts`, i.e.
`Math.max(useSafeAreaInsets().bottom, vs(8))`). It exists because the app is edge-to-edge at the
native level (`android:navigationBarColor` is transparent), so the window draws behind the system
gesture pill / 3-button bar (`insets.bottom` ≈24 dp gesture, ≈48 dp 3-button, ≈34 dp iOS home
indicator) and every bottom edge must stay clear. Reserving it at the root keeps the top full-bleed
(per-screen `insets.top` still applies) while bottom navbars, sticky footers/pills and scroll
`contentContainerStyle`s use their **base** heights with no inset math — e.g.
`features/food/components/FoodBottomNav`, `navigation/MainTabs` (`HubTabBar`),
`components/SubAppWrapper`, the `ViewCartPill`, and the pharma prescription/donor screens. Modals
render in separate native windows, so those keep their own insets.

**Sub-app header (Mart / Pharma):** `components/shared/SubAppHeader.tsx` renders a compact header
for Mart & Pharma — back button + a **white live searchbar** (no address pill anymore) that filters
the in-place feed via `searchQuery`. When `hideBrandRow` is set the brand row is dropped. Mart's
header additionally pins the shared `HeaderCategoryRail` below the searchbar (via `belowSearchSlot`),
so the category rail stays visible while the feed scrolls beneath it — the same pattern as the Home
hub header. The wrapper (`components/SubAppWrapper.tsx`) passes `compactHeader` (renamed from the old
`hasAddressBar`) to toggle the compact layout and supplies the rail for `FA_MART`.

Every visible bottom navbar also exposes the shared `components/shared/NavbarHomeShortcut`: a
Faazio-blue circular Home button centered over the first tab, with three quarters of the circle
above the bar. It appears on Favourites/You in `MainTabs`, on Mart/Pharma wrapper tabs, and on both
Food tabs; it is hidden on the main Home tab and when Mart's vendor drill-in hides its chrome.
`barHeight` is the bar's own measured height (its base height, since the bottom inset is reserved
centrally — see "Bottom-inset convention" above).

**Home feed performance:** the home feed (`HomeView`) runs on an **`Animated.FlatList`**
(reanimated-wrapped `FlatList`; migrating to `@shopify/flash-list` v2 is tracked in
`PENDING_WORK.md`) and never mirrors scroll position into JS state: `scrollY`/`viewportH` are
Reanimated `SharedValue`s, so `renderItem` is a stable identity and mounted cards do not
re-render while scrolling.
`FilterFeedSection` (the Discover grid) auto-loads its next batch via an **edge-triggered
UI-thread worklet** (`useDerivedValue` + `runOnJS`) that fires once when the user crosses ~60% of
the visible grid, and **prefetches** the next batch's image URLs (`Image.prefetch` via `AppImage`)
so cards decode ahead of the fold. The header collapse is **1:1** with the finger
(`DAMPING = 1.0`). Flat-list tuning uses `initialNumToRender=2`, `maxToRenderPerBatch=6`,
`windowSize=5`, `updateCellsBatchingPeriod=50`, `scrollEventThrottle=16`; no `removeClippedSubviews`
(redundant with virtualization, a known blank/flicker source on Fabric). Network images use
`AppImage` (RN `Image`, `resizeMode="cover"`, native HTTP cache) via the shared
`ProductCardBase` — never plain RN `Image` (no cache control / raw pop-in). A **repository seam**
(`src/services/homeFeed.ts`:
`getHomeSections` / `getFilterFeedPage(chip, page)` / `getFilterChips`) exposes promise-based,
paginated reads from `@data/*` — the contract the future Go Chi gateway will fulfil. Startup
 defers non-initial routes with `React.lazy` (kept eager: `Onboarding`, `Login`,
 `LanguageSelection`, `Location`, `MainTabs`/`Home`) and loads only the used Roboto weights
 (`400`–`900`), gated to Android (iOS uses `System`). The whole `Stack.Navigator` is wrapped in one
 `<Suspense fallback={<SplashFallback />}>`, so the first-run auth chain is intentionally eager:
 a lazy push there would swap the entire native screen tree for the splash mid-navigation instead of
 sliding a screen in. Since Metro ships a single bundle, `React.lazy` only defers module evaluation
 (no download saved).

#### Startup resilience & crash visibility (`App.tsx`)

- **Global error handler** — `ErrorUtils.setGlobalHandler` is installed at module scope so
  synchronous JS/render errors are not silently swallowed in release builds (where `babel` strips
  all `console.*`). Logs via `[Faazio:global-error]` in dev; production telemetry is a backlog item.
- **Error boundaries & recovery** — `components/ErrorBoundary.tsx` shows a recoverable card that
  always renders the thrown `message` (plus the first stack frame in dev) — release builds strip
  `console.*`, so this is the only in-app signal. The root boundary in `AppNavigator` (`scope="App"`)
  wraps the whole navigator and offers **"Go to Home"**; `SubAppScreen` adds a **scoped**
  `scope="SubApp"` boundary so a Mart/Pharma render failure degrades inside the sub-app instead of
  blanking the app. Recovery resets navigation via `navigationRef`
  (`src/navigation/navigationRef.ts`, wired as `ref` on `NavigationContainer`).
- **Splash failsafe** — the native launch theme hands off on first render; the JS `SplashFallback`
  is dismissed after `SPLASH_TIMEOUT_MS` (10 s) even if fonts/hydration stall, preventing a stuck
  splash that would trigger an ANR.
- **Branded splash minimum** — the cold-start splash (`SplashFallback` `royal` variant) shows the
  wide `logo.png` centered on Faazio blue (`#4250FF`) with no spinner, and stays up for at least
  `SPLASH_MIN_DISPLAY_MS` (5 s) via `App.tsx` before the app UI renders.
- **Hydration timeout** — `hydrateAuth()` / `hydrateLanguage()` run under a 4 s `withTimeout`
  guard; a hanging or failing storage module no longer blocks startup (defaults to unauthenticated)
  and can't become a silent unhandled rejection.


### Vertical rhythm (`src/theme/spacing.ts`)

Vertical gaps use a single canonical scale instead of per-screen magic numbers.
`SPACE` (all `vs()`-scaled) owns the four rhythm values:

| Token | Base | Owns |
|---|---|---|
| `SPACE.SECTION` | `vs(14)` | Gap between two major sections — the **one** owner of a section boundary |
| `SPACE.BLOCK` | `vs(8)` | Section header → its own content |
| `SPACE.ITEM` | `vs(6)` | Rows/cards inside a block |
| `SPACE.LIST_BOTTOM` | `vs(24)` | Scroll tail at the bottom of a list |

Ownership rule: a boundary has exactly one owner of its gap. A section header (e.g.
`features/home/sections/common.tsx` `SectionHeader`, or the food/mart/pharma
`*SectionHeader`s) owns its top gap (`SPACE.SECTION`); parents must not also add
`paddingTop`/`marginTop` for the same boundary, and headers do not own a bottom gap
beyond `SPACE.BLOCK`. Skeletons mirror the tightened real layout so loading → loaded
does not jump vertically. The five visually-parallel `SectionHeader` components are
still separate files; consolidating them is tracked in `client/mobile/PENDING_WORK.md`.

### State (`src/state/`)

| Store | Purpose |
|---|---|
| `authStore` | Session, login payload, auth state. `AuthUser` carries the decoded partner role/state claims (`role`, `stateCode`) read from the Firebase ID token (`lib/tokenClaims.ts`) so admin UI can gate client-side — the gateway re-verifies the token on every call |
| `cartStore` | Cart items, quantity, totals; `addToCart(id, name, price, emoji, restaurantId?)` — the optional 5th arg tags a line to a restaurant (adopts an untagged line on re-add); `clearRestaurantCart(id)` removes only that restaurant's lines. Fulfilment is chosen order-level on the cart, not per item. The local cart is the optimistic UI model; every mutation mirrors best-effort to the durable `inventory.carts` row (`gateway.addToCart`/`updateCartItem`/`removeCartItem`) and `hydrate()` pulls + rejoins catalog details at startup (remote mode only); the first empty remote hydrate clears the local `seedCartItems` |
| `favoriteStore` | Favourites (ids) |
| `pharmaStore` | Prescriptions |
| `bloodDonorStore` | Blood Donor wizard draft + committed registration + outgoing targeted requests (`donorMatchRequests`) + server-hydrated incoming requests (`incomingMatchRequests`; recipient-scoped, `respondToMatch` accept/decline) + the offline write outbox (`pendingOps`; register/interest/match/match-status/request; flushed on hydration/foreground, server-wins reconcile) |
| `searchStore` | Search state/history |
| `languageStore` | Selected language |
| `uiStore` | Sub-app id (`FA_MART`/`FOOD`/`PHARMA`), tab name |
| `foodFilterStore` | Food sub-app Veg / Non-Veg diet filter (`all`/`veg`/`nonveg`), session-scoped |
| `rewardsStore` | FaazioCoins balance, order streak, discount card + activity ledger (persisted AsyncStorage `faazio/rewards/v1`, reset on logout) |
| `ordersStore` | In-session placed orders (`PlacedOrder`: items or prescription kind) + a durable `serverOrders` slice hydrated from `gateway.getOrders()` at startup (remote mode); `recordOrder` / `hydrateServerOrders` / `getOrderById` (server history wins); `storeIds` vendor-identity snapshot captured at placement |
| `vendorRatingStore` | The signed-in user's live vendor ratings (one per `(user, vendor)`, latest wins) + verified-purchase `orderIds`; persisted AsyncStorage `faazio/vendor-ratings/v1`, reset on logout |
| `deliveryPartnerStore` | Partner-app only: verified application phone + the rider/detail projection from `GET /delivery/me`. The Firebase session itself stays in `authStore`/Keychain and is never duplicated here |

### Services (`src/services/`)

- `api/GatewayClient.ts` — single data surface; **wired** to the production gateway (`GATEWAY_URL` + `USE_GATEWAY`) and **server-only** (no `@data/*` fallback on a failed/disabled read). Migration (W22) done so far: mart feed (`martService` → `getStores('MART')`), catalog vendor detail (`VendorDetailScreen` → `getStore`), favourites (`getProductsByIds`), product search (`SearchModeConfig.fetch` → `searchProducts`), the Home SDUI registry + recently-viewed rails (`useHomeFeed` → `getHomeFeed`, static `@data/home/sections` fallback), the **cart/checkout** path (see below), the **Pharma Rx** capture/upload/create path, the **orders history** (`ordersStore` ← `getOrders`), **vendor reviews** (`useVendorReviews` ← `getVendorReviews` + `getVendorReviewSummary`) and the `search` analytics event. **(W25)** pharma store rails/vendor picker (`usePharmaStores` → `getStores('PHARMA')`), `getVenues` + `getNotifications` added; `getMenu` now carries `description`. **(W26)** food restaurant menus (`useRestaurantMenu` → server-only `fetchMenu`, then `getMenu` for mock-mode) and the FoodHome restaurant grid (`restaurantFeedService` → `getVenues('FOOD')`, fixture-enriched); saved-address add/edit/delete (`saveAddress`/`deleteAddress`). **(W27)** blood donor dashboard feed (`useBloodRequests` → `getBloodRequests`, server-backed, fixture-enriched display extras; detail renders redacted rows gracefully). **(W29)** `getCoupons` feeds the cart coupon sheet; money/Rx/address writes honour `STRICT=true` (no silent fixture success). **(W30)** Home sponsored rail (`SponsoredRailSection` → `getLiveAds`/`getSponsoredProducts`, `HOME_TOP`, paid placements collapse on empty — no fixture fallback) and the Home SDUI `sponsoredRail` section. **(W31)** shopper pricing: `getActiveDiscounts` + `services/pricing.ts` (`effectivePrice`/`applyActiveDiscount`/`applyActiveDiscounts`/`useActiveDiscounts`/`fetchActiveDiscounts`/`withActiveDiscounts`) overlay approved festival discounts across every product surface — Mart vendor rail + `DealsLanding` (`discounts`), search (`SearchModeConfig.fetch` → `withActiveDiscounts`), vendor drill-in (`VendorDetailScreen`), PDP (`ProductDetailScreen` re-resolves the canonical row before overlaying once), favourites, and the Home rails (`usePricedProducts`); the Food offers rail uses authored `SpecialDish.mrp` (no more `price × 1.2`); the Home `DealsOfDaySection` resolves `md-*` through the catalog. **(W32)** coupon validate/settle at checkout (`validateCoupon` → `POST /checkout/validate-coupon`; `POST /orders` settles server-side) and closed-loop ads (shared `components/shared/SponsoredRail` reports impression/click via `recordAdEvent`, last-click attribution via `services/adsAttribution.ts`; `SPONSORED_SHOWCASE`/`SECTOR_RAIL` consumed). **(W33)** Mart home deals de-mock (`martService.fetchMartFeed` resolves `md-*` through `getProductsByIds`, overlaying server name/price/MRP/rating/image onto the `@static-editorial` row) and Food **delivery-store menus** (`data/food/menus.ts` `storeMenus` derived from `foodProducts` by `storeId`; `menuForVenueName` resolver; 12 `store-f*` kitchens seeded into `directory.menus` — 88 dishes / 30 venues). **(W35)** Home SDUI cutover: the feed now drives every data-backed rail — `HomeView` threads `products`/`stores`/`chips[].productIds` into `NearbyOffersSection`, `Mens`/`Womens`/`Childrens`, `HairSkinCare`, `MostRatedRestaurants` (server-joined `directory.stores` via the new `sdui` store join + `directory.Repo.ByIDs`), `TodaysSpecials` and `FilterFeed` (active-chip ids resolved through `getProductsByIds`); each fixture stays the offline first-paint. `adBanner` (`HOME_HERO` slot) remains fixture-owned; `hotBrandDeals` (vendor campaigns) stayed fixture-owned until **(W50)**. **(W38)** Mart hero + Daily Essentials de-mock: `martService.fetchMartFeed` now reads the `martHero.banners` / `martEssentials.productIds` sections from `getHomeFeed()` (portal-editable, `mocks/martHomeFeed.ts` = offline fallback; `mf-*` retired for real `gr-*` ids), the `DealsLanding` `discounts` grid uses `getStoreProducts`, and Mart search emits the `search` behavior event. **(W39)** Mart monitoring + cart gate: `services/productViews.trackProductView` emits a session-deduped `view` impression (reset on logout) via `hooks/useViewableTracking` on the Mart search grid + both feed rails (`DealsOfDayRail`/`DailyEssentialsRail` `onItemView`); `cartStore.hydrate()` clears the local `seedCartItems` on the first empty remote pull. **(W40)** Mart residual de-mock: the PDP "More from store" grid reads `getStoreProducts` (local filter fallback), `VendorHighlights` derives its badges from the store row (`deliveryTime`/`rating`) instead of a hardcoded const, the organic "Discounted Products" rail no longer carries the 'AD' pill, and checkout now settles approved festival discounts server-side (`contracts.DiscountReader`) so the charged price matches the overlaid one. Remaining: Mart media path (R2 backfill blocked on creds); Mart campaign-`DealsLanding` mode stays Home-owned fixture. **(W41)** seller-run paid hero campaigns: `GatewayClient.getHeroAds` (`GET /ads/hero`) feeds the shared `components/shared/CampaignHero` (via `hooks/useCampaignHero`) at `MART_HERO`/`CATEGORY_TOP`/`STORE_TOP`, closing the loop into the seller Ads console; the category drill-in's fake store-derived `SPONSORED` ad slides (`getAdsForQuery`/`VendorAdSlide`) were deleted. **(W42)** self-serve heroes: every hero surface is now a paid placement (no organic hero) — `HOME_HERO` replaces the Home `topAdSlides` fixture, `FOOD_HERO`/`PHARMA_HERO` are new hosts, `STORE_TOP` covers the restaurant profile, and the Mart `MartHeroCarousel`+`MART_HERO_BANNERS` are retired; `CampaignHero` gains a one-impression guard + `accessibilityLabel="Sponsored"`; `GatewayClient.reportHeroAd` (`POST /ads/campaigns/{id}/report`) wires the user abuse report. **(W43)** Mart ads/offers hardening: `martService.fetchMartFeed` renders partial (per-leg catch + body guard) and reads `martHero.banners` as the `CampaignHero` house fallback, Deals/Essentials overlay `useActiveDiscounts` for price parity, and `SubAppWrapper` resolves the deep-linked vendor via `getStore` (local fixture fallback). **(W44)** Mart merchandising unification: the Deals rail moved onto SDUI (`martDeals.productIds`, same owner as Essentials; `@data/mart/deals` + `mocks/martHomeFeed.ts` are offline fallbacks), `fetchMartFeed` now reads the Mart-only `GET /sdui/mart` (`GatewayClient.getMartFeed`) instead of the full Home feed, the whole Mart feed shares one `useActiveDiscounts` batch (paid shelf gets a `discounts` prop; `SponsoredRail` impression guard), deal/essential taps resolve the canonical row via `openCatalogTarget`, the Mart rails gained a "View All" that opens `DealsLanding` in catalog-resolved `martDeals`/`martEssentials` modes, and the seed fills three `SPONSORED_SHOWCASE` slots. **(W45)** Food sub-app ads/offers rebuild: the "Recommended & Offers" rail/page lists only MRP-struck dishes (`getOfferDishes`, shared) and drops the false `AD` pill on organic food; the profile offer slot surfaces the live Food coupon (`useBestCoupon`); the `FOOD_HERO`/`STORE_TOP` hero gained a house fallback and full-band collapse, and `openVenue` now resolves delivery kitchens via `getStore` (no dead taps); Food gained its own `GET /sdui/food` projection (`GatewayClient.getFoodFeed`, `foodHero`/`foodSpecials`/`mostRatedDining`) driving the hero fallback, the "Today's Special" order + Top Rated staleness filter; and `useRestaurantMenu`/`menuForVenueName` no longer pad an unseeded venue with other restaurants' dishes. **(W50)** Campaign + Pharma merchandising de-mock: the Home "Deals of the day" campaign defs are now server-owned — `hotBrandDeals.campaigns[]` on the SDUI doc compiles into the anon `GatewayClient.getHomeCampaigns`/`getHomeCampaign` (`GET /home/campaigns(/{id})`, store + products joined), `BrandCampaignsSection` renders the feed defs and the `DealsLanding` `campaign` drill-in reads the server join (fixture fallback); Pharma gained its own `GET /sdui/pharma` projection (`GatewayClient.getPharmaFeed`, `pharmaHero`/`pharmaPopular`/`pharmaEssentials`) backing the `PharmaHeroBanner` house fallback + the "Popular Medicines"/"Health Essentials" rails (`fetchPharmaFeed`, fixture fallback); the super-admin SDUI editor edits the campaign leaf and the Pharma sections off the same Home doc.
- `firebaseAuth.ts` — native Firebase phone-OTP client (`sendOtp` → `signInWithPhoneNumber`,
  `verifyOtp` → `ConfirmationResult.confirm`, `refreshIdToken` → `getIdToken(true)`, `signOutRemote`).
  Returns the Firebase ID token (RS256 JWT) the gateway verifies; tokens are handed to
  `secureSession` (never logged). The public native config lives in
  `android/app/google-services.json` + `ios/Faazio/GoogleService-Info.plist`.
- `secureSession.ts` — tokens via `react-native-keychain` (Android Keystore / iOS Keychain; never AsyncStorage for secrets). Single owner of the session with an in-memory mirror so `GatewayClient` can read `getAccessToken()` per request without a Keychain round-trip; `updateSessionTokens()` persists a rotated pair, and `getRefreshToken()` returns the portal refresh token for seller/admin sessions.
- `logout.ts` — clears auth + cart + favourites + search + pharma + blood donor + rewards + vendor-rating stores + the session impression set.
- `productViews.ts` — `trackProductView(id)`: emits a `view` behavior event **at most once per product per session** (`user_events` has no dedupe), reset on logout; consumed by `hooks/useViewableTracking` on the Mart search grid, the vendor drill-in "All Products" grid, and the feed rails.
- `vendorRatings.ts` — single owner of the vendor rating gate: `canRateVendor(vendorId)`
  (derived from fixture orders via `hasPurchasedFromVendor` + in-session `ordersStore.orders`
  + durable `ordersStore.serverOrders`), `getUserVendorRating`, `submitVendorRating` (async;
  re-checks eligibility, always writes the device store, then mirrors to the server and resolves
  `{ ok, status }` — `synced`/`offline`/`signed-out`/`not-verified`/`invalid`; W49), `getVendorReviews`
  / `getVendorReviewSummary` (seeded `@data` reviews merged with the user's own — the offline
  fallback for the remote `useVendorReviews`). Reused by all five entry points.
- `orderHistory.ts` — projects a durable `checkout.orders` row (`OrderRow`) onto the app's
  `PlacedOrder` view model (status map: `NEW`/`PACKED`→`Processing`, `RETURNED`→`Cancelled`,
  vendor name resolved from the store snapshot). Used by the `ordersStore` hydration.
- `categoryVendors.ts` — repository seam for the category drill-in: `getVendorsForApp(app, q)`
  (per-token match over the search configs' `searchableText`, grouped per `storeId`, sorted by
  match count then rating), `getVendorsWithProducts(app, q)` (adds each store's matching product
  rows for the rails), `getVendorProducts(storeId, app)`, `matchesQuery`, `productSearchableText`,
  `isDiscounted(product)` (the single "on offer" predicate — `originalPrice > price` — shared by the
  Mart vendor rail and `DealsLanding` after any server discount is overlaid).
- `pricing.ts` — shopper pricing overlay: `effectivePrice(basePrice, discountPercent)`,
  `listPrice(product)`, `applyActiveDiscount(product, discount)` / `applyActiveDiscounts(products, map)`
  and the `useActiveDiscounts(ids)` hook backed by `GatewayClient.getActiveDiscounts`
  (`GET /promo/active-discounts`); `fetchActiveDiscounts(ids)` / `withActiveDiscounts(products)` are
  the non-hook counterparts for async sources (search `fetch`). Server-owned discounts are overlaid
  on base prices; mock/offline returns none (never synthesized).
- `homeFeed.ts` — repository seam: `getHomeSections` / `getFilterFeedPage(chip, page)` /
  `getFilterChips` (promise-based, paginated reads from `@data/*`; future Go gateway contract).

### Cart / checkout → gateway (W22)

- **Cart durability:** `cartStore` mutations optimistically update local state, then mirror
  best-effort to `inventory.carts` (`gateway.addToCart`/`updateCartItem`/`removeCartItem`/
  `clearCart`). No-op in mock mode. `hydrate()` runs once at startup (remote mode only): it pulls
  the durable cart, resolves `productId`s via `getProductsByIds`, and replaces local state. On the
  **first** remote hydrate an empty server cart clears the local `seedCartItems` (no fixture lines
  the server lacks); later empty responses leave local state untouched.
- **Order placement:** `CartView.handlePlaceOrder` calls `gateway.placeOrder({ items, addressId,
  fulfillment, idempotencyKey, pickup, pickups, coinsRedeemed })`; the **server is the money/stock
  authority** (prices, decrements stock, holds the idempotency lock) and returns the durable order
  `id`, now used as the `ordersStore` key (fallback `FZ-*` only if the call fails). The chosen
  `paymentMethod` (`UPI | CARD`) is sent so the durable payment ledger reflects it; payment capture
  itself stays deferred. The **delivery fee is dynamic**: `CartView` quotes it on the FULFILLMENT
  step via `gateway.fetchDeliveryFee` (`GET /checkout/delivery-fee`, store pin + live drop), falling
  back to a Haversine estimate when the gateway is unreachable — the server settles the same math.
  On success the purchased lines are removed from the
  durable server cart; rewards (`recordOrder`) stay local-first. A 1.2s minimum delay preserves the
  processing spinner.
- **Pharma Rx:** `PrescriptionFlowScreen.handleConfirm` uploads each captured photo to the private
  `prescriptions` bucket via a signed URL (`gateway.uploadPrescriptionImage` → object **key**, never
  a URL/logged), then calls `gateway.createPrescription({ vendorId, fulfillment, pages, note,
  imagePaths, addressId })`. **(W29)** the delivery `addressId` is resolved from
  `gateway.getAddresses()` (server-owned) rather than the `@data/cart/addresses` fixture, so a
  `DELIVERY` Rx never stores a phantom fixture FK. The Rx is keyed by the **server-owned id** so My
  Orders can poll it;
  failed photo uploads drop that page but never block the Rx. Seller quote/READY reveal + outbox
  notifications are served by the gateway (see `mvp-backend.md`). The customer sees the quote in
  **Order Details**: `usePrescriptionDetail` (`features/pharma/prescription/`) polls the durable Rx
  in remote mode and renders the seller's line items + total, a customer-facing status label
  (Awaiting quote / Quote ready / Ready / Fulfilled / Cancelled) and the recent status history,
  stopping on a terminal status.

## Navigation graph

```
AppNavigator (root native stack)
├── Onboarding ── Login ── LanguageSelection ── Location
├── MainTabs (bottom tabs)
│   ├── Home · Favourites · You   (+ central Cart pill)
├── SubApp (generic sub-app wrapper; optional `initialVendorStoreId` opens the Mart vendor drill-in)
│   (Mart tabs: Home · Search · You · Cart — "You" pushes the account page)
│   (Mart in-wrapper drill-in = `VendorProfileView`: All Products + unlabelled "Discounted Products"
│    rail + "View All" → DealsLanding{discounts}; distinct from the pushed `VendorDetails` screen —
│    both read GET /stores/{id}/products)
│   (Pharma tabs: Home · Search · Cart · History · Donor)
├── FoodApp (FoodStack — FoodHome restaurant-first → Search → RestaurantProfile → RestaurantMenu / RestaurantOffers; 2-tab bottom nav Home/Search + You/Cart)
├── ProductDetail · Search · Cart (`{ restaurantId?, restaurantName? }`) · PaymentOptions · AddCard
├── CategoryDrillIn (category drill-in page from the Home/Mart rail) ── VendorDetails (single-store search)
├── DealsLanding (deals page — four modes: `campaign` from the Home "Deals of the day" carousel
│   (Home-owned `@data`), `discounts` from the Mart vendor profile "View All" (server pool),
│   `martDeals`/`martEssentials` from the Mart rail "View All" (catalog-resolved `productIds`); the
│   last three carry the paid `SECTOR_RAIL` header shelf)
├── You · UserDetails · SavedAddresses · MyOrders · Favourites · OrderDetails · FaazioRewards · SellWithUs
│   └── SellerRequests (admin application queue, role-gated) ── SellerRequestDetail (`{ sellerId }`; KYC verify/activate/reject)
├── RateVendor (verified-buyer rating form; every vendor surface + order screens link here)
├── BloodDonor (Pharma blood-donor wizard/dashboard)
├── BloodDonorDetails (selected matching donor profile + targeted request)
├── BloodRequestDescription (`{ requestId; source? }` — donor request details + nearby requests;
│    a cold deep link with no `source` waits for the live board before showing "no longer available")
├── MedicalShopDetails (pharma store profile + live store inventory)
├── PrescriptionFlow (full-bleed pharma prescription capture → note → vendor → confirmed;
│   optional `presetVendorId` skips the vendor step and opens fulfilment for that pharmacy)
```

Entry is `Onboarding` (or `MainTabs` when authenticated) — decided in `AppNavigator.tsx`
from `useAuthStore.isAuthenticated`.

## Delivery Partner app (separate product)

The partner experience is a **separate product root and bundle**, not a tab or a deep link in the
customer SuperApp. `index.js` is the customer entry; `index.delivery.js` mounts
`src/DeliveryPartnerApp.tsx` (its own `NavigationContainer` + `DeliveryPartnerNavigator`) and
registers the `FaazioDeliveryHeartbeat` headless task. `MainApplication`/`AppDelegate` select the
partner root for the delivery flavor/configuration, and the Gradle/Xcode bundle steps use the
delivery entry, so neither APK ships the other product's screens, stores or customer modules.

```
DeliveryPartnerNavigator (native stack, no customer screens)
├── PhoneEntry   — 10-digit entry → Firebase phone OTP; resumes an existing session via GET /delivery/me
├── OtpVerify    — 6-digit code → authStore Keychain session
├── Register     — KYC application: profile, live Aadhaar/selfie/PAN + motor DL/RC/insurance capture,
│                  vehicle-capped capacity, bank details (private R2 uploads → POST /delivery/register)
├── SubmissionSuccess — applied / pending / verified / rejected / suspended state + rejection reason
├── Dashboard    — Go Online toggle (PUT /delivery/availability), Valkey heartbeat every 120 s
│                  (foreground + Android foreground service headless task + iOS background watch),
│                  45 s offer cards, active multi-stop jobs, Earnings link
├── AcceptReject — deep-link/push offer: store/customer, payout, route context, 45 s countdown,
│                  Accept / Reject (expiry = implicit reject) → Route
├── Route        — one merged route across all ACCEPTED jobs: stops sorted by the server's global
│                  sequence, one polyline, Arrived/Picked Up/Delivered transitions, customer-OTP
│                  handover (document re-upload is admin-side; the app has no re-upload screen)
└── Payouts      — earnings history from GET /delivery/payouts: pending/paid totals and each job's
                   distance, base/extra-km, surge reason and settlement status
```

**Push offer deep link.** `src/services/deliveryPush.ts` registers the FCM token, routes a foreground
message or notification tap to `AcceptRejectScreen`, and `src/services/deliveryLinks.ts` also accepts
`faazio-delivery://accept-reject?orderId=…` (`Linking` warm/cold start). The screen loads the offer
from `GET /delivery/route/{id}` so a cold start needs only the order id; the server's `expiresAt`
drives the countdown.

**Native identity.** One committed RN shell, three products: the Android `customer`/`delivery`/`seller`
product flavors (`com.faazio.customer` / `com.faazio.deliverypartner` / `com.faazio.seller`) and the
iOS `Debug`/`Release` plus `Delivery-*`/`Seller-*` configurations (same bundle split).
The partner build needs its own Firebase Android app + iOS plist; `APP_VARIANT=delivery` selects
that config in `configure.js` (the iOS bundle phase hard-fails otherwise). CI builds them explicitly
(`assembleCustomerDebug` / `assembleDeliveryDebug`); see `docs/RUNBOOKS/RELEASE.md`.

**Background tracking.** While online, Android runs `DeliveryTrackingService` with
`foregroundServiceType="location"` and a persistent low-importance notification, waking
`DeliveryHeartbeatTaskService` every 120 s. The headless JS task reads the Keychain session, takes
one coarse fix and posts the same heartbeat as the foreground loop; the service stops when the
rider goes offline/signs out. On iOS, `DeliveryBackgroundLocation` keeps a background-enabled
CoreLocation watch (`UIBackgroundModes: location`, explicit consent) and posts a heartbeat throttled
to 120 s only while `AppState` is not active; the foreground interval owns heartbeats while the app
is open. The watch uses coarse continuous updates (no distance filter) so a rider waiting at a store
keeps refreshing the 300 s Valkey key instead of silently dropping out of dispatch. The in-app
consent flag is persisted so a cold start while already online resumes the watch without
re-prompting; sign-out clears it. iOS still ends the watch when the app is force-quit from the app
switcher.

**Known production limits** (tracked in `client/mobile/PENDING_WORK.md`): force-quit iOS background
location (plus OEM battery whitelisting) and the `PUSH_WEBHOOK_URL` bridge is an ops step. Dispatch
runs a global Held-Karp VRP across all accepted stops (insertion fallback above 15 open stops).
Reject re-offers the job to the next candidate up to 5 attempts. Payout splits (Phase 5) are
intentionally not built.

## Seller Partner app (separate product)

`index.seller.js` mounts `src/SellerPartnerApp.tsx` (its own `NavigationContainer` +
`SellerPartnerNavigator`); the `seller` flavor/configuration selects it. The seller product is a
**WebView shell over the web partner portal** (`client/web/platform`): one native route loads
`${WEB_PORTAL_URL}/seller` and the portal owns every seller screen — dashboard, the orders Kanban
(`/seller/orders`), order detail with accept/reject (`/seller/orders/[id]`), products, inventory,
menus, stores, payments, promotions and settings.

```
SellerPartnerNavigator (native stack, no customer/delivery screens)
└── Portal — full-screen react-native-webview at WEB_PORTAL_URL/seller
```

**Session (Option A).** The portal's `/login` page authenticates against the gateway
(`POST /auth/portal/login`) and keeps the access/refresh pair in HttpOnly cookies. Native stores no
seller token, calls no `GatewayClient` portal endpoint, and cannot read the cookies; the WebView
cookie store persists the session across app restarts. Portal sign-out clears the cookies; the shell
also clears the WebView cache when it navigates back to `/login`. Hardware back walks the WebView
history, then exits.

**Native responsibilities only:** safe-area/status-bar chrome, external links (anything outside the
portal origin opens in the system browser), FCM token registration, foreground order beep, and
notification-tap navigation (`window.location.assign('/seller/orders/{id}')`).
`react-native-webview` is pinned to `14.0.1`; `react-native-sound` plays the bundled
`src/assets/orderBeep.wav`. The portal registers the injected FCM token through its authenticated
`/api/gateway` proxy (`POST /notifications/register`), so native never needs a portal bearer token.
On the gateway, `POST /orders` fans the new-order notification out to every active seller portal
user owning a store in the order (`contracts.Notifier.EnqueueSeller`); the outbox payload is
PII-free (`orderId`, `kind`). The seller Android channel (`seller_orders`) uses the bundled beep;
the seller-only manifest sets it as the FCM default channel.

Mobile shell adaptations in the portal: a touch-friendly drawer navigation below `lg` (the desktop
sidebar stays unchanged), `viewport-fit=cover`, and the seller orders page hydrates real gateway
rows (accept/reject call the seller decision endpoints). Other seller console pages keep their
existing seed/hydration behaviour — completing that data cutover is tracked in
`client/mobile/PENDING_WORK.md`.

Native config: the seller build needs its own Android Firebase app + `GoogleService-Info-Seller.plist`
(CI secret `GOOGLE_SERVICES_SELLER_JSON`; `APP_VARIANT=seller` selects `src/seller/google-services.json`
and the Seller plist in `configure.js`). FCM is required for push; the seller app itself
authenticates through the portal, not Firebase. `WEB_PORTAL_URL` is a build-time public config
(release requires https); a seller build without it shows a configuration error inside the shell.

### Phone-auth flow (Login)

`LoginScreen` is a two-phase screen (phone → OTP). Phone entry auto-advances 150 ms after the
10th digit, calling `firebaseAuth.sendOtp()` (native Firebase) first; a failed send shows an alert
and stays on phone entry. Android auto-retrieves the SMS when Play Integrity succeeds; iOS falls
back to reCAPTCHA until APNs is configured (see `docs/RUNBOOKS/FIREBASE_AUTH.md`). OTP submission is an explicit state machine, **not** a side effect of the 6th
keystroke: a `useEffect` keyed on `otpCode` calls `submitOtp()` whenever the code reaches 6
digits (covers typing, paste, and re-render races), guarded by a `submitRef` so it fires once.
`submitOtp` dismisses the keyboard, **awaits** `firebaseAuth.verifyOtp()` → `authStore.login()`
(Keychain), and only then `navigation.replace('LanguageSelection')` (guarded by
`navigationRef.isReady()`). Without the native Firebase config a dev build keeps the offline mock
login; release builds reject that at configure time. A
failure sets `otpError`, which drives the shake + "Verification Failed" toast; `submitRef` resets
so the user can retry. A always-present **Verify** CTA (enabled at 6 digits, spinner while
awaiting) is the manual fallback, so the user can never be stranded. Back is two-step and wired to
both the chevron and Android hardware back (`BackHandler` via `useFocusEffect`): first press closes
the keyboard, second returns to phone entry with the typed number preserved; on phone entry the
hardware back pops to Welcome. `replace` deliberately removes the consumed OTP screen so back from
Choose-language lands on Welcome, not a filled OTP form.

## Account navigation groups

The "You" page (`features/profile/AccountView.tsx`) renders its nav list from the
`@data/account/accountNav.ts` fixture (`accountNavGroups`), which is grouped and titled
via `AccountNavGroup.title`. Six groups render in order: `profile` (Profile settings),
`payments` (Payments and credits), `privacy` (Privacy and security), `earn` (Earn with us),
`legal` (Terms and policies), and `support` (Help & Support). The `privacy` and `legal`
groups are `comingSoon` — they render a single non-tappable "Coming soon" row in place of
real nav rows. The `earn` group is active and carries a `sell-with-us` row ("Sell with us")
that pushes the `SellWithUs` screen. Orders / Details / Addresses / Favourites / Sell-with-us
navigate today; Favourites opens the search-results-style `Favourites` root route (see below).
The `payments` group now holds only the `payments` row ("Payments") — the old
`coupons` "Coupons & Offers" stub row was removed. The remaining rows (Recently Viewed,
Customer Support, Payments) are placeholders (TODO stub in `AccountView.handleRowPress`).
A FaazioCoins streak card (title + balance + a row of 7 flame icons, filled per
`streakCount`) sits above the nav groups and pushes the `FaazioRewards` screen.

## Favourites page (from My Account)

`FavouritesScreen` (root route `Favourites`) wraps the presentational `FavouritesPageView`,
a search-results-style page reached from the "Favourites" row in My Account. It mirrors the
search shell: a static header (back chevron + "Favourites (N)" title pill), a
`SegmentedToggle` (All / Mart / Food / Pharma), a sort-only `FilterChipsRail`, and a
`FlatList` of favourite items resolved via `getCatalogEntriesByIds(useFavoriteStore.favorites)`
rendered with the shared `SearchProductRowCard` (each heart toggles the favourite off/on
live). Tapping an item pushes `ProductDetail`. The store reads `seedFavorites`
(`@data/home/seeds.ts`) on first launch.

## Saved addresses (edit / delete)

`SavedAddressesScreen` (root route `SavedAddresses`) hydrates the caller's durable addresses from
`GatewayClient.getAddresses()` (keeping the `@data/account/addresses.ts` fixtures on mock/empty/error)
and now owns the full lifecycle through a bottom-sheet `AddressEditor` (tag chips, name, phone,
address, default switch): **Add New** opens a blank draft, **Edit** seeds it from the card, and both
save via `GatewayClient.saveAddress()` → `PUT /profile/addresses` (upsert; the server mints the id for
a new address and clears the caller's other defaults when one is set default). **Delete** (card or
sheet) calls `GatewayClient.deleteAddress()` → `DELETE /profile/addresses/{id}`; a cross-user or
unknown id is a 404 and still drops the row locally so the list stays consistent. Money/PII stay on
the server — the screen only ever sends `{tag, name, phone, address, isDefault}`.

## Sell with us (seller onboarding)

`SellerRegistrationScreen` (`features/seller-onboarding/`, route `SellWithUs`) replaced the old
minimal form and is reached from the Account `earn` group. One wizard collects business identity
(name, owner, category `MART`/`FOOD`/`PHARMA`, GSTIN, PAN, address, contact phone/email), a
location-derived 2-letter state (GPS → state code; manual entry is the fallback) plus a required
**district** picker for TN/PY (`DISTRICTS` from `@data/districts`; the gateway rejects a district that
does not belong to the state), platform fee %,
payout account (bank name, account number, IFSC, beneficiary), a **mandatory bank passbook** photo
and — for FOOD only — the FSSAI number + certificate. All fields are mandatory. Labels/placeholders
still come from `SELLER_SETUP_FIELDS` (`@data/seller/sellerSetup.ts`).

Documents are captured with `DocumentCapture` (Vision Camera, consent-gated), uploaded straight to
the private R2 bucket through `GatewayClient.uploadSellerDocument` (`/media/upload-url` presigned
PUT → `/media/confirm`), and only the object key + asset id reach the application. Submission is
blocked until both documents and the OTP digital signature are complete; the OTP runs on a
disposable secondary Firebase app (`services/firebaseAuth.ts`) so the shopper's primary session is
never swapped. `GatewayClient.submitSellerApplication` (`POST /sellers`, audited) creates the
`PENDING_REVIEW` seller, bank account and KYC rows in one transaction. The server treats the OTP as
a **digital signature**: it requires a Firebase ID token whose `phone_number` claim matches the
application's `contactPhone` (`auth.OTPSigned`, dev-mode X-Dev-* headers are the only exception) —
a client-asserted `otpVerified: true` alone is rejected with `401 otp_unverified`. The success state
shows the `sellerId`, status and platform fee. In mock mode the client returns a local
`PENDING_REVIEW` row so the flow completes offline.

Admin review ships on **both surfaces** — the web portal (`admin/district/sellers[/[id]]`,
SUPER_ADMIN reaches every district) and the mobile app:
- `SellerRequestsScreen` (route `SellerRequests`) — the application queue scoped by the server to the
  district admin's district (SUPER_ADMIN sees all districts), with All/Pending/Rejected tabs.
  Reachable from the Account page through a role-gated "Seller applications" card (`AccountView`,
  shown only for `DISTRICT_ADMIN`/`SUPER_ADMIN`).
- `SellerRequestDetailScreen` (route `SellerRequestDetail`, `{ sellerId }`) — full registration +
  masked payout account, a platform-fee editor, per-document verify actions (PASSBOOK / FSSAI / PAN /
  GSTIN), **Verify KYC** (attaches the Razorpay Route linked account and activates the seller) and
  reject-with-reason. KYC images are rendered live through `GatewayClient.getPrivateMediaUrl`
  (`GET /media/private/{assetId}` — a short-lived presigned GET that only the creator or an admin
  may mint). Rejected sellers may edit and resubmit; changed fields are recorded until approval
  clears the trail.
- `FeeChangeRequestsScreen` (route `FeeChangeRequests`) — the platform-fee review queue, server-scoped
  to the district admin's district / every district for SUPER_ADMIN, with Pending/Approved/Rejected/All
  filters and approve / reject-with-reason actions. Reachable from the Account "Fee change requests"
  card.

Sellers never edit the live fee directly. `SellerPlatformFeeRequestScreen` (route
`SellerPlatformFeeRequest`, opened from the Account "Request a fee change" card for `SELLER` sessions)
loads the current fee via `GET /sellers/{id}`, shows request history
(`GET /sellers/{id}/platform-fee-requests`) and files a `PENDING` request
(`POST /sellers/{id}/platform-fee-request`). Only an admin approval mutates `platformFeePct`; one
pending request per seller is enforced by the server.

## FaazioRewards (coins + streak)

The `rewards` module (`src/features/rewards/`) implements a lightweight FaazioCoins
loyalty loop that is entirely device-local (no backend yet — see `PENDING_WORK.md`):

- **Earn:** `rewardsStore.recordOrder(paidTotal, coinsRedeemed, orderId)` runs on order
  placement in `CartView.handlePlaceOrder`. Coins are earned at `COIN_EARN_RATE` (₹1000/coin)
  on the **paid** amount (post coupon + coin redemption), so users can't farm coins by paying
  with coins. Pure math lives in `features/rewards/rewardsLogic.ts` (`evaluateStreak`,
  `coinsEarnedFor`, `computeRedeemableRupees`, `isCardActive`, …) — unit-testable with no store.
- **Streak:** calendar-date based (`lastOrderDay` vs today, local). Same-day orders count once;
  a missed day hard-resets to 1. At `STREAK_TARGET_DAYS` (7) a `DISCOUNT_CARD_PERCENT` (10%)
  card is granted (`grantedAt` + `expiresAt` 5 days out) and the streak resets to 0.
- **Redeem:** the payment step shows an opt-in `CoinsRedeemRow` (only when balance ≥
  `COIN_REDEEM_MIN`) that redeems whole rupees of coins and lowers the pay total.
- **Streak card in cart:** an active card is listed first in the Bag coupon sheet as
  "Faazio Streak — 10% OFF" and reuses the existing `appliedDiscount` machinery (opt-in).
- **Card expiry:** `expireStaleCard()` is invoked at hydration and read time; no timers.
- **Visibility:** the Account page (`AccountView`) shows a FaazioCoins streak card (title +
  balance + 7 flame icons filled per `streakCount`); `FaazioRewardsScreen` (route
  `FaazioRewards`) shows the balance card, 7-dot streak strip, active discount card, and the
  activity ledger.
- **Persistence:** hand-rolled AsyncStorage (`faazio/rewards/v1`, `bloodDonorStore` pattern),
  `reset()` wired into `logout.ts`. All rules come from `@data/rewards/rewards.ts`
  (enterprise-controlled constants — see `data/DATA_CONTROL.md`).
- **Mock seed:** on a fresh install the store starts at `coinBalance = 245` /
  `streakCount = 5` (demo values) until real orders override them; `reset()` on logout zeroes
  the balance and streak.

## Food diet filter

The Food sub-app exposes a Zomato-style **All / Veg / Non-Veg** toggle (`DietToggle` in the
Food home header + Search headers) backed by the session-scoped `foodFilterStore`. One store
drives every Food screen + food search at once. The Food home header (`FoodHeader`) is now a
back chevron with the toggle centered in the row (the old address block — area + "Delivering to
Home" — was removed); the toggle is uncontrolled, so it writes the shared store like the rest of
the home. Venues are classified by `dietType`
(`veg`/`nonveg`/`both`); dishes by `isVeg?`. Pure-veg venues drop in Non-Veg mode and
pure-non-veg venues drop in Veg mode; `both` venues stay in both. Unclassifiable dishes
(`isVeg` undefined) are hidden while a filter is active. Match semantics live in
`features/food/utils/dietFilter.ts` (`venueMatches` / `dishMatches`).

The restaurant grid ("Restaurants") is driven by the durable
`directory.dining_venues` list — `restaurantFeedService.fetchRestaurantFeed` calls the server-only
`GatewayClient.fetchVenues('FOOD')` and merges the result with the feature fixture by id
(known venues keep their rich distance/price-for-two copy; server-only venues get neutral
defaults). Because `fetchVenues` throws instead of silently falling back, the feed distinguishes a
real failure (network/HTTP → `@data` venue identity table + fixture, grid never blank) from an
**authoritative empty** list (server returns `[]`): on an authoritative empty the grid, the Top Rated
rail and the fixture venues are all dropped and the screen renders an honest
"No restaurants available right now" empty state — so an all-delisted / state-filtered catalog never
lingers as stale, openable profiles. The Top Rated rail
(`TOP_RATED_RESTAURANTS`) also drops venues the server no longer lists (so a delisted `tr-*`
row never opens a stale profile) and honours `mostRatedDining.storeIds` ordering — those ids are
`directory.dining_venues` ids (`tr-*`), read raw from the section (the server's store join cannot
resolve them), so a stale/delivery-kitchen id would make the curation a silent no-op. Server-only
venues carry neutral presentation defaults (`distance`/`priceForTwo`/`rating` 0); the restaurant cards and
the Top Rated hero drop the `0.0 km` metric, the `₹0 for two` copy and the blank address, and show a
**"New"** chip in place of the rating badge rather than printing a fake figure. The house hero banners come from the Food-only SDUI projection
(`GET /sdui/food` → `foodHero.banners`, via `GatewayClient.getFoodFeed`) and the "Today's Special"
rail order from `foodSpecials.productIds` (unknown ids ignored, the rest keep fixture order); the
mind / snack rails stay fixture-owned.

> **No dining/table-booking feature exists.** The Food workflow is discover → menu → cart → checkout,
> with only two fulfillment modes: `FulfillmentMode = 'DELIVERY' | 'PICKUP'`. There is no
> "book a table"/reservation branch, no `bookTable`/`reserveTable`/`dineIn`/`tableBooking` code, and
> `directory.dining_venues` is restaurant identity only. Restaurant cards/headers also no longer show
> cosmetic delivery-time ETA text; distance (km) is retained.

The filter is threaded explicitly rather than read from the store inside a predicate:
each Food screen subscribes to `foodFilterStore` and passes the value into its pure
helpers (`venueMatches` / `dishMatches`). Food search follows the same pattern —
`FoodSearchScreen` reads `dietFilter` and passes it into `createFoodSearchConfig`, which
captures it in the (pure) dish predicate, so the config stays deterministic and rebuilds
when the filter changes.

`DietToggle` is **optionally controlled**: with no props it reads/writes the shared store
(home + Search headers, unchanged), while passing `value` + `onChange` drives a screen-local
override without touching the store. `RestaurantProfileScreen` and `RestaurantMenuScreen` both use
the controlled form: they seed a screen-local `dietFilter` once from
`foodFilterStore.getState()` and never write back, so each restaurant screen's toggle follows home
by default (re-seeded on each open because the screen is popped), overrides only that restaurant's
menu/rail, and leaves home/search untouched. On the profile the toggle sits between the back button
and the search/share actions in the pinned top toolbar; on the full menu it is the toolbar's
trailing node (via `FoodDetailTopBar.right`). The profile's in-menu **"Search in menu"** button and
its toolbar Search icon both push the **`RestaurantMenu`** page (threading the current
`dietFilter`), which owns the real, autofocused full-width search bar — the profile no longer hosts
a live `TextInput` or the old `onLayout` scroll-and-focus jump.

## Food — Restaurant profile vs full menu

`RestaurantProfileScreen` is the restaurant's landing page (ad-banner hero band, info card,
Recommended & Offers rail, category chips, menu preview) and `RestaurantMenuScreen` is the dedicated
full-menu page.

The profile hero is a solid light-gray `#F3F4F6` band (padded clear of the pinned toolbar) holding the
paid **`STORE_TOP`** `CampaignHero` (ad-server fill, scoped to this restaurant's `storeId`) — the old
restaurant `RemoteImage` + dark overlay and the static `topAdSlides` banner were dropped. Tap resolves
the hero's deep-link target (product/dish → PDP; a different venue is a no-op here). The whole band
**drops entirely when there is no LIVE fill** (the screen reads `useCampaignHero('STORE_TOP', …)` so
the grey slab and the overlap are removed, not left as an empty band). The pinned back/search
toolbar (the dead Share button was removed — W58), the white board, menu, offers rail and cart pill are unchanged.

The **"Recommended & Offers"** rail/page shows only dishes actually on offer — an authored
`SpecialDish.mrp` above the selling price (`getOfferDishes` in `features/food/utils/menu.ts`, shared by
`RestaurantProfileScreen` and `RestaurantOffersScreen`) — and the rail is hidden when there is nothing
on offer. Organic dishes no longer appear under the offers title and no longer carry the misleading
`AdLabelBadge` (the rail is unpaid; the `RestaurantOffersScreen` "View All" page never had a pill).
The profile offer slot shows the **authoritative live Food coupon** (`useBestCoupon('FOOD')` →
`GET /coupons?app=FOOD`, strict) as `CODE · value/min-order`; tapping opens the restaurant-scoped cart
with the code **pre-loaded** (`Cart` route param `couponCode` → `CartView` auto-applies once the coupon
list contains it, re-validating server-side and surfacing the real `invalid_coupon`/`min_order` error),
so the banner no longer promises a code the shopper has to re-enter. The decorative store `offerTag`
is a fallback only (no price promise) when no coupon exists.

- Both render identical dish rows via the shared `features/food/components/MenuItemRow` (thumb,
  name/description/price, outlined **Add** → **− qty +** stepper) and the same restaurant-scoped
  white `ViewCartPill`. `MenuItemRow` shows the authored **MRP strike** (`₹price ~~₹mrp~~`) when the
  dish's `mrp > price`, matching the offers page/search card — the same `directory.menus.mrp_paisa`
  the seller authors. Both read the menu through `features/food/hooks/useRestaurantMenu`, which is
  **remote-first**: it seeds from the `@data/food/menus.ts` fixture (via
  `features/food/utils/menu.ts` `getMenuForRestaurant` → `menuForVenueName`, extracted from the
  profile so the two can't drift), then swaps in the durable `directory.menus` dishes from the
  server-only `GatewayClient.fetchMenu(venueId)` once they arrive (mapping the gateway `MenuDish`
  onto `SpecialDish`). The server list is trusted as the venue's own (no name re-filter, so a rename
  can't drop rows). The remote result is **authoritative**: a live `[]` (the seller has no public
  `ACTIVE` dishes) clears the seed and shows the honest empty menu, so a delisted/emptied venue never
  lingers as stale fixture rows; only a real failure (offline / HTTP error) keeps the seed, so the
  profile is never blank offline. `menuForVenueName` returns the authored restaurant menu or the `storeMenus` delivery menu
  (derived from `foodProducts` by `storeId`) for the 12 `store-f*` kitchens; an unseeded venue shows
  an **honest empty menu** — the old `TODAYS_SPECIALS` cuisine-match padding (which could leak other
  restaurants' dishes into a profile) was removed. Festival
  discounts are **deliberately not** overlaid on menu rows: `promo.festival_optins` keys on
  `catalog.products.product_id` and the checkout `DiscountReader` ignores `directory.menus`, so a
  menu-dish discount would be display-only (a price the cart can't settle). A discounted menu dish
  instead carries the seller's authored `mrp_paisa > price_paisa` strike (migration `0022`; authored
  through the portal `seller/menus` MRP field — W58); the old
  per-open `GET /promo/active-discounts` call was removed. `getMenuCategories` operates on the resolved list unchanged.
  The hook returns `{ menu, loading }`; `loading` is set **only when the fixture seed is empty** (a
  server-only venue), so the profile/menu show an inline spinner instead of flashing the honest
  "no dishes" empty state before the server replies — a seeded venue keeps its first paint and never
  shows the spinner.
- Both category rails are the shared `features/food/components/MenuCategoryRail` (pill chips,
  `hs/vs/ms` metrics, gap-based content container). **Layout contract:** the rail is a **fixed,
  non-flexing** sibling — `flexGrow: 0` / `flexShrink: 0`. RN injects `flexGrow: 1, flexShrink: 1`
  into every ScrollView; on the full menu the tall vertical list used to win the flex competition and
  squeeze the rail into a clipped sliver (half-cut glyphs). The full-menu list ScrollView now owns
  `flex: 1`, so exactly one child takes the leftover space and the rail's height stays padding + chip
  (font-scale-proof — no fixed rail height). Both hosts pass only a box override (menu: vertical
  padding; profile: `marginBottom`). Do not drop the two flex styles.
- Both screens' category chips are derived from the **actual menu's dish cuisines**
  (`getMenuCategories`) rather than the venue-level `restaurant.cuisines` labels, so every chip maps
  to at least one dish under the exact-equality `dish.cuisine` filter; the selected chip falls back
  to `Bestsellers` if the active diet filter removes its dishes.
- `RestaurantMenuScreen` shows the restaurant name below the `FoodDetailTopBar` (whose title is now
  just **"Menu"**) and above the full-width search bar, so long names get a full-width two-line
  heading instead of being truncated in the toolbar. It adds the full-width search bar (filters on
  dish name/description), the `Bestsellers` + cuisine category chips and the diet toggle; the shared
  chip rail sets `keyboardShouldPersistTaps="handled"` so the first chip tap isn't swallowed by the
  autofocused search keyboard. It adds/steppers through the same restaurant-scoped cart slice as the
  profile, so the **View Cart** count stays in sync between both.
- `RestaurantMenu` is typed as `{ restaurant: FoodRestaurant; dietFilter: DietFilter }` in
  `FoodStackParamList`.

## Food add-to-cart — direct adds, fulfilment on the cart

Every add of a dish in the Food sub-app is **direct** — `addToCart(id, name, price, emoji)` with
no popup. The old `FoodAddModeSheet` (Dining / Food order → Delivery / Self pickup) was **deleted**;
fulfilment is no longer captured per item (`CartItem.fulfilment` and the `CartFulfilment` type were
removed). Instead the **order-level** Delivery / Self Pickup choice is made on a dedicated cart
FULFILLMENT step (BAG → Place order → FULFILLMENT → Proceed to pay → PAYMENT).
This applies everywhere: the dishes-only search results, the restaurant offers page, the restaurant
profile menu "Add", and the FOOD product-detail footer + related-dish grid adds. A FOOD PDP add
(footer or related-dish card) is **tagged to the product's restaurant** (`getFoodRestaurantForProduct`
→ `restaurantId`), so it lands in the restaurant-isolated slice and is counted by the restaurant cart
pill; Mart/Pharma PDP adds stay untagged. Qty steppers (+/−)
stay direct everywhere. Food home promo/Top-of-Week add buttons were already direct (unchanged).

The **RestaurantProfile "Recommended & Offers" rail** (`features/food/screens/RestaurantProfileScreen.tsx`)
is **organic (unpaid)**: it lists only the venue's MRP-struck dishes (`getOfferDishes`) and carries
**no** `AdLabelBadge` — the old 'AD' pill on every own dish was a false disclosure and was removed
(W45). The "View All" page (`RestaurantOffersScreen`) shares `getOfferDishes` and is likewise
unlabelled, so the rail and page can't disagree.

## Restaurant-isolated cart (one cart, scoped by ownership)

There is still **one `cartStore`**; a `CartItem.restaurantId` (optional) tags lines added from a
restaurant page (the profile menu and its offers page, via `SearchDishCard.restaurantId`) **and from
a FOOD product-detail page** (the PDP resolves the owning restaurant and threads its id into
`addToCart`). Lines added elsewhere — food search, Mart/Pharma product detail, seeds — stay
**untagged** and belong to the common cart only. Re-adding an untagged dish from a restaurant page
**adopts** it (backfills `restaurantId`).

- **RestaurantProfile / RestaurantMenu** show only their own lines: the white **View Cart** pill (no
  orange card, no ₹ amount — just icon + "View Cart" + item count + arrow) and the menu **− qty +**
  stepper both derive from `cart.filter(i => i.restaurantId === restaurant.id)`, so other
  restaurants'/common lines never show. Its "View Cart" pushes `Cart` with
  `{ restaurantId, restaurantName }`.
- **Cart (`CartScreen`)** reads those params: scoped mode shows **only** that restaurant's lines,
  with a scoped title, a red **Clear** action (`clearRestaurantCart`) and a per-row **trash**
  delete (`removeFromCart`); the common cart (no params) shows everything with no Clear/trash.
  Writes are **scope-aware** — `setCartItems` replaces only the scoped slice, so checkout/clear
  can never wipe other restaurants'/common items. `CartView` gates the scoped chrome purely on the
  presence of `onClearItems`/`onDeleteItem` (presentational, no cart imports added).

## Cart (BAG) item selection

The cart BAG step (`features/cart/CartView.tsx`) lets the user tick/untick items per row
before paying. Selection is screen-scoped checkout UI, held in `CartView` local state as a
**deselection set** (`deselectedIds`) so new items are ticked by default with no sync
effects. A shared `Checkbox` primitive (`components/shared/Checkbox.tsx`) renders the
22px rounded square (grey border → green `#118C4F` with white check) used by both item
rows and category-group headers. Each category header (Mart/Food/Pharma) shows a
tri-state **group checkbox** (all-ticked / partial `indeterminate` / none) that checks or
unchecks the whole category; unticked categories stay visible but dimmed so items can be
re-ticked.

Every downstream money number is driven by the **selected subset** only — `computeTotals`
(To Pay), savings/`originalTotal`, coins estimate, `pickupPointList`, and the payment-step
item count. Placing an order (`handlePlaceOrder`) snapshots only the selected items onto
the receipt, and **keeps unticked items in the cart** (only the selected items are paid for
and wiped). When zero items are ticked the Place order button is disabled — it advances to the
FULFILLMENT step. The 3 category cards
are now **full-bleed** (edge-to-edge, no side gutters/borders) with a larger 64px item
thumbnail; the savings/coupon card keeps its 16px inset.

## Live location — foreground-only nearby retrieval

Every commerce surface sorts from one live origin. `src/state/locationStore.ts` owns the fix
(`idle | loading | ready | denied`), persists only the last coordinate + permission flag under
`faazio:location:last` (never the address), and exposes `selectOrigin`. `src/hooks/useLiveLocation.ts`
is mounted once in `App.tsx`: it hydrates the cache, then polls a coarse fix every 10 s **only while
`AppState` is `active`**, reverse-geocodes only after ~50 m of movement, and never shows the OS prompt
on launch. Consent is explicit: `LocationScreen` "ALLOW LOCATION ACCESS" calls
`requestAndRefreshLocation()` (high accuracy + address); manual search uses the Places API (New)
autocomplete when `GOOGLE_PLACES_API_KEY` is configured, otherwise the existing static results.

Consumers enrich rows locally with `src/utils/distance.ts` (Haversine + `formatDistanceKm`):
Mart local vendors, Pharma outlets, Food top-rated/restaurants, category drill-in vendors, and search
results (Relevance order, via `features/search/storeDistance.ts`) are nearest-first and re-sort as
the poll lands without refetching. Explicit search sorts (price/popularity) stay authoritative. Server-backed nearby reads
(`GatewayClient.getStoresNearby`/`getProductsNearby`) return `distanceKm` computed by the gateway
(`GET /stores/nearby`, `GET /products/nearby`), cached in Valkey for 120 s.

Seller onboarding adds a foreground `SellerLocationPicker` (native `react-native-maps` modal) and
submits `latitude`/`longitude` with the application; the shop pin is stored on `sellers.sellers` and
is public business data. Maps keys come from `GOOGLE_MAPS_API_KEY_ANDROID` (manifest resource generated
by `scripts/configure.js`) and `GOOGLE_MAPS_API_KEY_IOS`; no key ⇒ the map renders blank, no crash.
The customer product itself never requests background location. The shared iOS plist declares
`UIBackgroundModes: location` for the delivery entry (the partner app is the only caller of the
background watch); Android keeps background location scoped to the delivery flavor manifest.

## Cart checkout — BAG → FULFILLMENT → PAYMENT → RECEIPT

The checkout wizard (`features/cart/CartView.tsx`) is now **BAG → FULFILLMENT → PAYMENT →
RECEIPT** (`CheckoutStep`). The order-level **Delivery ⇄ Self Pickup** choice moved off BAG onto a
dedicated **FULFILLMENT** step. `fulfillment` (`'DELIVERY' | 'PICKUP'`) is a single
`CartView`-scoped state; it drives `computeTotals` (pickup waives the delivery fee),
`PaymentOptionsScreen`, and the receipt timeline.

- **BAG:** item list + pricing + savings/coupon card, with a prominent full-width **Place order**
  button (disabled with no ticked items). No fulfilment UI here.
- **FULFILLMENT:** a "to pay:" pale-blue total card (`BreakdownCard`) at top, then
  **"How do you want your order?"** — a Delivery / Self Pickup segment — then **"Choose pickup or
  delivery"**: Delivery shows the default address card (live `useLiveAddress` fix or the saved
  primary address, with a **Change** link into `SavedAddresses`); Self Pickup lists the
  `getPickupPointsForItems` pickup points (per vendor, name/address/hours/contact). A fixed bottom
  **Proceed to pay** button is disabled until a mode is chosen. The **delivery fee is dynamic**:
  on entering Delivery with a live fix, `CartView` fetches a server quote
  (`gateway.fetchDeliveryFee`, `GET /checkout/delivery-fee`, typed `DeliveryFeeBreakdown`) and falls
  back to an honest base + distance estimate (`estimateDeliveryBreakdown`, `utils.ts`: ≤3 km → ₹35,
  then ₹7 per extra km) when the gateway is unreachable. The quote carries the server zone and any
  active night/rain/festival surge; `BreakdownCard` itemises those rows so the bill is explainable.
  A FREE-Delivery coupon discounts the **live** quote (including a surge that arrives after the code
  was applied), not a frozen fee, and the gateway settles the same zero delivery line.
- **PAYMENT:** the reworked `PaymentOptionsScreen` (below); its back button returns to FULFILLMENT.
- **Order placement:** for Delivery, the live fix (or fallback) is the delivery address and
  the GPS coordinates are captured on the order (`PlacedOrder.location`) and sent as
  `deliveryLocation`, so the gateway can auto-dispatch when the seller marks the order PACKED.
  For Self Pickup,
  `getPickupPointsForItems` auto-derives **one pickup point per distinct vendor** and all of
  them are snapshotted as `PlacedOrder.pickups` (with `pickups[0]` also kept in `pickup` for
  the My Orders chip + prescription flow).

### Payment step (`PaymentOptionsScreen`, `features/cart/payment/`)

- A pale-blue **BreakdownCard** sits at top: "to pay:" total plus **Ordered value** and the server
  delivery quote itemised into base (first 3 km), extra distance, and any active night / rain /
  festival surge (hidden for Self Pickup). There is **no tax row**: catalog prices are GST-inclusive
  so the customer total is `subtotal + deliveryFee − discount`, matching the server invoice. The old Preferred-Payment card, CVV pay bar, and Net Banking / Wallet / COD
  options are removed.
- **UPI:** `src/services/upi.ts` probes the `UPI_APP_PACKAGES` list (`paymentData.ts`: GPay, PhonePe,
  Paytm, Amazon Pay, BHIM) via `Linking.canOpenURL` (Android `<queries>` + iOS
  `LSApplicationQueriesSchemes`), rendering installed apps as `UpiAppRow` selectable rows. Selecting a
  UPI app shows the fixed floating **BottomPayBar** ("Pay ₹X").
- **Cards:** saved cards come from the device Keychain (`payment/cardStorage.ts`, service
  `FaazioCardToken`) — only a token + last4 + expiry + network, never a PAN/CVV. **Add New Card**
  opens the real `AddCardScreen` (`AddCard` route), where the 16-digit/MM-YY/CVV/name form is
  validated, a token is minted and stored in the Keychain, and the card appears on return (a
  `useFocusEffect` reload). Selecting a saved card also shows the pay bar.
- `onPlaceOrder` fires with `{ method: 'UPI' | 'CARD', upiLabel?, cardLast4?, coinsRedeemed? }`;
  `CartView.handlePlaceOrder` sends `paymentMethod` and renders the receipt payment line. The
  `CoinsRedeemRow` (only when balance ≥ `COIN_REDEEM_MIN`) is unchanged.

The **My Orders → Order Details** page resolves an order via `ordersStore.getOrderById` first
(durable server history, then in-session placed orders), falling back to `@data getMyOrderById`
for fixtures — fixing the placed-order "not found" gap — and renders a **"Pickup From" card per vendor** (name, address,
`Open {hours}`, contact) for `PICKUP` orders. The FOOD product-detail store section
(`CommonProductDetailView`) now exposes a tappable restaurant row + a "View Restaurant" button
(`onViewRestaurant`) that deep-links into the nested `FoodApp → RestaurantProfile` via
`getFoodRestaurantForProduct` (`features/food/utils/restaurantForProduct.ts`).

## Order receipt — unified tracking

The receipt (`CartView`) shows a **single unified Real-Time Tracking Status** box for every
order: a pulsing "Order has been placed" row (no ETA badge, no two-step variants). For
PICKUP it additionally renders a "Pickup from: {store} +N more, {address}" line and a
**"Pickup From" section listing one card per vendor** (name, address, hours, contact).
`handlePlaceOrder` also writes to `ordersStore.recordOrder` (items kind) so the order is real
in My Orders. A primary **Track My Order** button (optional `onTrackOrder` prop, wired in
`CartScreen` to `navigation.navigate('MyOrders', { highlightOrderId })`) sits in the receipt
actions. "Items Purchased" rows no longer show an icon: the name is ¾-width ellipsized
(`maxWidth: '75%'`) with a grey "x {qty}" and right-aligned price.

## Prescription flow (pharma)

`PrescriptionFlowScreen` (root route `PrescriptionFlow`, full-bleed — the camera can't live
in the sub-app wrapper) runs a step machine `CAPTURE → NOTE → VENDORS → CONFIRMED` for the
normal entry:
- **CAPTURE** (`PrescriptionCameraStep`) — full-screen `CameraView` with a consent dialog
  (`requestCameraPermissionsAsync`) before mount, shutter, flash toggle, thumbnail strip with
  per-photo delete, "n/10" counter, `Confirm (n)` enabled at ≥1 and hard-capped at 10 pages.
- **NOTE** (`PrescriptionNoteStep`) — thumbnail recap + optional multiline pharmacist note.
- **VENDORS** (`PharmaVendorList` + `PharmaVendorCard`) — mirrors Mart's local-vendor rail but
  the CTA is an "Order" pill; search filters name/categories/desc/offerTag. Built pharma-local
  (cannot import `features/ecommerce`).
- **CONFIRMED** (`PrescriptionOrderConfirmedView`) — check + "Order Confirmed!" + order ID +
  the unified tracking box (pickup line for PICKUP) + prescription-details card (vendor, mode,
  pages, note) instead of an items list + **Track My Order** / Done. Nothing touches `cartStore`.
- Fulfilment choice (`PharmaFulfilmentSheet` on `SlideUpSheet`, Delivery/Self-Pickup rows,
  subtitle = vendor name) gates the direct order — not persisted to the cart. Placing the
  order calls `ordersStore.recordOrder` (prescription kind) and shows in My Orders with a
  📄 "Prescription order" card ("N pages • {vendor}", Delivery/Self-Pickup chip, Processing).
  When opened from `MedicalShopDetails` with `presetVendorId`, the flow stores that pharmacy after
  NOTE, skips `VENDORS`, and shows the same fulfilment sheet in the flow screen; dismissing it
  returns to NOTE.

## My Orders — merged list + prescription cards

`MyOrdersScreen` merges `ordersStore.orders` (in-session, newest first) above the durable
history; the history is the hydrated `ordersStore.serverOrders` when the gateway read settled,
else the `@data myOrders` fixtures. Rows already present as an in-session placement are dropped
(deduped by order id) and the placed card renders the order's real status (server status wins).
The sub-app rail counts recompute from the merged list. Prescription placed orders render a
distinct 📄 card, and a `highlightOrderId` route param auto-selects that order's sub-app in the
rail and rings its card.

## Vendor ratings & reviews (phase 1)

Verified buyers can rate a vendor from five entry points, all gated by the same derived rule.
The rating form is the root `RateVendor` route (`features/profile/RateVendorScreen.tsx`), not a
sheet.

- **Gate (single owner, `services/vendorRatings.ts`):** `canRateVendor(vendorId)` is derived from
  `hasPurchasedFromVendor` (`@data/checkout/orders.ts`) plus in-session `ordersStore` — true iff a
  non-cancelled order resolves to the vendor; the server later tightens to `DELIVERED`, and it stays
  true for the `(user, vendor)` pair once earned. The screen re-checks it on open.
- **Identity:** `resolveVendorForProduct` (`data/directory/vendors.ts`) resolves once at placement;
  the order snapshots `storeIds` (`ordersStore`), so old orders keep the ability.
- **Rating:** one live rating per `(user, vendor)`, latest wins; stars + optional ≤280-char comment;
  resubmitting shows "Update your rating". Public display is full name only — no id, phone, order
  id, or avatar — and nothing rating-related is logged.
- **Entry points:** My Orders card CTA, Order Details "Rate your purchase" card, the Mart vendor
  profile (`VendorProfileView`), the Pharma shop (`MedicalShopDetailsScreen`), and the Food
  restaurant profile (`RestaurantProfileScreen`) — each renders the shared `VendorReviewsSection` +
  `VendorRateButton`.
- **Shared widgets** (`src/components/shared/`): `StarRatingInput`, `VendorRatingSummaryBar`,
  `VendorReviewsSection`, `VendorRateButton`; hook `useVendorRating` re-derives on store changes.

## Boundary enforcement

- **Home is the sanctioned cross-sub-app consumer** — only Home may import another sub-app's
  `cards/*` or `@data/<other>/*`.
- Sub-app screens may import only their own domain + shared primitives/theme/state.
- Enforced by `dependency-cruiser` via `npm run check:boundaries` (config:
  `.dependency-cruiser.cjs`). A violation fails the check.

## Build & patch system

- `patch-package` (`postinstall`) applies the `@shopify/react-native-skia` patch — mandatory.
- `react-native-svg-transformer` + `sharp` for asset optimization.
- `babel-plugin-transform-remove-console` trims logs in production builds.

## Size & delivery strategy

The "lightweight, fast, secure" mandate (AGENTS.md) is enforced at build and delivery time:

- **Hermes + New Architecture** (RN 0.86.3) — precompiled bytecode, lower memory, faster cold start.
- **R8 minify + resource shrinking ON for release** — `-Pandroid.enableMinifyInReleaseBuilds=true`
  and `-Pandroid.enableShrinkResourcesInReleaseBuilds=true`; `mapping.txt` kept as a **private**
  artifact for crash retracing, behind a mandatory device smoke test. See `docs/RUNBOOKS/RELEASE.md`.
- **2-ABI build** (`arm64-v8a,armeabi-v7a`, ~95% device coverage) — roughly halves native `.so`
  payload and C++ build work vs the old 4-ABI universal build (APK download ~−50%).
- **Asset + console trimming** — `react-native-svg-transformer` + `sharp` for assets;
  `babel-plugin-transform-remove-console` strips `console.*` from production. Images go through
  the shared `AppImage` wrapper (RN `Image`, platform-native decoders/caches).
- **Startup deferral** — non-initial routes use `React.lazy`; only the used Roboto weights
  (`400`–`900`) load, gated to Android. **Honest caveat:** Metro still ships **one bundle**, so
  `React.lazy` defers module *evaluation*, not download size (`PENDING_WORK.md`).
- **OTA / differential delivery — not implemented.** There is no OTA provider wiring
  (CodePush or self-hosted) in `package.json`; `React.lazy` is startup deferral, not per-feature
  delivery. Adding JS-bundle OTA later means integrating a provider such as CodePush
  (whole-bundle, no store resubmit for JS-only changes); true Flipkart-style per-feature
  delivery is custom infrastructure and **out of scope**. Decision tracked in `PENDING_WORK.md`.
- **Server-driven content reduces how often native layouts must ship** — data/content changes are
  server-side once the gateway exists (`server-gateway-plan.md`), the lever that keeps an RN
  superapp light.

## Honest limitations

- **Screen data is server-backed** — `GatewayClient` is server-only (no `@data/*` fallback on a
  failed/disabled read), backed by the production gateway (Go monolith over Supabase + Mongo + Valkey).
  Fixtures remain for types, seed/editorial input and offline first paint; the per-screen `@mock` →
  `@server` migration is complete and recorded in `client/mobile/PENDING_WORK.md`. Auth uses real Firebase phone
  OTP (`firebaseAuth.ts`) for shoppers and the gateway-native portal HS256 session for the seller
  app; `AUTH_DISABLED=true` remains a local-dev-only mode (see `data-layer-sdui.md`).
- **Duplicated mock data** in a few screens (`PharmaScreen`,
  `ProductDetailView`) — canonical copies exist under `@data/` marked `@unused`; de-dup is
  a tracked priority (see `data/DATA_CONTROL.md` "Known Gaps").
- **Shared vendor inventory hook (W48, resolved)** — the Mart in-wrapper drill-in (`VendorProfileView`,
  wired by `FaMartScreen`) and the pushed `VendorDetails` screen (`VendorDetailScreen`) now share
  `features/catalog/hooks/useVendorProducts` (server `GET /stores/{id}/products` + festival overlay +
  offline fallback), so the two surfaces cannot diverge. The category drill-in groups the same server
  catalog via `useCategoryVendors`.
- **Vendor ratings are device-local on display** — `RateVendorScreen` writes through
  `services/vendorRatings` (device store) and mirrors to the server `PUT /vendors/{id}/rating`, whose
  outcome is now surfaced (`synced`/`offline`/`signed-out`/`not-verified`) with an inline error and a
  "Saving…" state instead of a silent best-effort (W49). Under a production `AUTH_DISABLED=false`
  gateway the mirror is inert (mocked token), so a displayed rating can diverge from the server
  summary until a real session exists — a documented deferral, not a hidden failure.
- **Pharma home rails are server-backed (W50)** — stores are server-backed (`getStores('PHARMA')`)
  and the "Popular Medicines"/"Health Essentials" rails + house hero now read the Pharma-only
  `GET /sdui/pharma` projection (allowlist `pharmaHero`/`pharmaPopular`/`pharmaEssentials`, joined to
  the catalog), with the `@data` fixture as the offline fallback. The section ids reference real,
  non-Rx `ph-*` catalog rows (asserted by the seed generator), close to the Mart/Food symmetry
  (`pharmaService.ts`, `PENDING_WORK.md` W50).
- `ts:check` currently requires `--ignoreDeprecations 6.0` due to a pre-existing `baseUrl`
  deprecation in `tsconfig.json` (unrelated to feature work).

## Verification workflow

```bash
cd client/mobile
npm run ts:check            # typecheck
npm run check:boundaries    # dependency-cruiser
# Android build is CI-only (never local Gradle):
gh workflow run android-debug.yml && gh run watch
```
