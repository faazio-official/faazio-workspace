# Web Portal (Next.js) — architecture deep dive

The Faazio Partner Portal is the seller / state-admin / super-admin console. It
renders from a Zustand store that is seeded from `client/web/platform/src/data/**` and, when
`NEXT_PUBLIC_GATEWAY_URL` is set, hydrated from the Go Chi gateway
(`client/web/platform/src/lib/api/sync.ts`). **Auth is mocked by default** — the portal signs
in against the built-in demo directory even when Supabase credentials are present;
set `NEXT_PUBLIC_AUTH_MODE=supabase` to opt into GoTrue. The session persists in
`localStorage` under `faazio.portal.v1`. See "Data + auth" below.

## Locations

| Path | Role |
| --- | --- |
| `client/web/platform/` | **Shipping app** — Next.js App Router. All future portal work lands here. |
| `client/web/vite-reference/` | Original Vite + TanStack Start app, kept read-only as a visual diff baseline. `MIGRATION_NEXTJS.md` there is the hand-off contract. |
| `client/web/landingpage/` | Marketing landing page (TanStack Start + Nitro, deployed on Vercel). Separate app; see its own README/AGENTS. |

## Stack

Next.js (App Router) + React 19, Tailwind CSS v4 via `@tailwindcss/postcss`, the
same shadcn/ui (new-york, slate) components, Zustand, TanStack Query provider,
Recharts, Zod, react-hook-form, sonner, lucide-react.

## Routing contract

Every console page lives under `client/web/platform/app/**` (one `page.tsx` per route). The full
map is grouped below; `(sector)` marks pages that only make sense for one sub-app. URLs extend the
Vite reference (all 3 consoles).

**Root + auth**

| Route | Page |
| --- | --- |
| `/` | root redirect/landing → `app/page.tsx` |
| `/login` | mock directory sign-in (GoTrue only when `NEXT_PUBLIC_AUTH_MODE=supabase`) |

**Seller console — own data (`app/seller/**`)** — ads, catalog, pricing, promotions, stores,
menus, orders, bookings, prescriptions, returns, reviews, payments, analytics, support, settings,
onboarding. This is where paid hero campaigns (`seller/ads` wizard) and organic offers are authored.
The campaign wizard's **what→where** placements map 1:1 to the paid mobile surfaces documented in
`PAGE_CATALOG.md` §2.5/§2.6: `MART_HERO`/`FOOD_HERO` (house hero carousels) and `STORE_TOP`
(restaurant profile band), so a seller target resolves to the same slot the shopper sees.

| Route | Page | Sector |
| --- | --- | --- |
| `seller` | dashboard | all |
| `seller/ads` | hero CampaignWizard (what→where→creative→when→review) + campaign list/KPIs | all |
| `seller/products` | catalog list | all |
| `seller/products/new` | create listing | all |
| `seller/products/[id]/edit` | listing editor (name/desc/photos + `upsertPrice`) | all |
| `seller/inventory` | stock | all |
| `seller/pricing` | price/MRP | all |
| `seller/promotions` | festival opt-ins + live price | all |
| `seller/stores` | store profile | all |
| `seller/menus` | dish menus | FOOD |
| `seller/orders` · `seller/orders/[id]` | order queue + detail | all |
| `seller/bookings` · `seller/bookings/settings` | seat accept/reject/vacate + config | FOOD |
| `seller/prescriptions` | Rx quote → READY reveal | PHARMA |
| `seller/returns` · `seller/reviews` · `seller/payments` | after-sales | all |
| `seller/analytics` · `seller/support` · `seller/settings` · `seller/onboarding` | console | all |

**State admin console (`app/admin/state/**`)** — state-scoped oversight.

| Route | Page |
| --- | --- |
| `admin/state` | dashboard |
| `admin/state/products` · `admin/state/products/queue` | catalog + review queue |
| `admin/state/sellers` · `admin/state/sellers/[id]` | seller directory + detail |
| `admin/state/orders` · `admin/state/bookings` | order/booking oversight |
| `admin/state/blood` | blood requests (PHARMA) |
| `admin/state/customers` | customer list + activity trail |
| `admin/state/coupons` · `admin/state/festival` | promo |
| `admin/state/pricing-audit` | price integrity |
| `admin/state/analytics` · `admin/state/content` · `admin/state/support` · `admin/state/audit` | console |

**Super admin console (`app/admin/super/**`)** — global control plane.

| Route | Page |
| --- | --- |
| `admin/super` | dashboard |
| `admin/super/ads` | live ad monitor (Live/Reported/CTR; Takedown/Restore) |
| `admin/super/sdui` | Home/Mart/Food SDUI layout editor (sections, productIds, hero banners) |
| `admin/super/festival` · `admin/super/coupons` | promo authority |
| `admin/super/products` · `admin/super/sellers` | catalog/seller authority |
| `admin/super/sectors` · `admin/super/coverage` | taxonomy + coverage |
| `admin/super/rewards` · `admin/super/users` · `admin/super/state-admins` · `admin/super/states` | platform |
| `admin/super/analytics` · `admin/super/audit` · `admin/super/settings` | console |

Every route is an interactive dashboard, so each route is split:

- `app/**/page.tsx` — **server** component. Exports `metadata` (from
  `pageMetadata()` in `src/lib/seo.ts`) and renders the client sibling.
- `app/**/page.client.tsx` — `"use client"` component holding the real UI, a
  byte-for-byte copy of the old route component with the TanStack wrapper removed.

Dynamic segments rename `$id` → `[id]` and read params via `useParams()` from
`next/navigation`. `__root.tsx` becomes `app/layout.tsx` (html/body + root
metadata + `src/styles.css`) plus `app/providers.tsx`
(QueryClientProvider + TooltipProvider + Toaster). `notFoundComponent` /
`errorComponent` become `app/not-found.tsx` / `app/error.tsx`.

## Migration decisions (the "ditto UI" fixes)

1. **Images stay plain `<img>`.** Vite resolves image imports to a URL string;
   Next resolves them to `{ src, width, height }`. `src/lib/media/productImages.ts`
   normalises every import through `toUrl()` so seeded product photos keep
   working. `next/image` is deliberately not used (`images.unoptimized: true`).
2. **One stylesheet, one location.** `src/styles.css` stays put (Tailwind v4
   `@theme` + tokens + utilities) and is imported from `app/layout.tsx`. It
   declares `@source "../src"` **and** `@source "../app"` so utilities used in
   `app/**` are scanned. Tailwind runs through `@tailwindcss/postcss`
   (`postcss.config.mjs`); the Vite plugin is gone.
3. **Hydration.** The Zustand store keeps its SSR-safe storage shim. A local
   `src/lib/hooks/useHydrated.ts` replaces the TanStack hook; shells and
   `RoleGate` render skeletons until hydrated, so no empty flash.
4. **Charts are client-only.** `src/components/patterns/Charts.tsx` exports
   `next/dynamic(..., { ssr: false })` wrappers around `ChartsImpl.tsx` so
   Recharts never runs during `next build` prerender; pages import the same
   named exports unchanged.
5. **Router API swap.** `Link to=` → `next/link` `href=`, `useNavigate()` →
   `useRouter().push()`, `useRouterState(pathname)` → `usePathname()`, in the
   shells (`SellerShell`, `AdminShell`), `RoleGate` and `PageHeader` only.
   Active-nav highlighting is computed manually (`pathname === item.to` /
   `startsWith(item.to + "/")`).

## Data ownership

The portal reads records from `src/data/**` through `src/lib/api/*`
(`hooks.ts` reactive reads, `index.ts` mutations). Pages never import
`src/data/**` directly. This is the same seam as the mobile `GatewayClient`.

Mutations write optimistically to the store first, then push the change to the
gateway through `pushWrite()` (`src/lib/api/index.ts` → `writeAwaited` in `src/lib/api/http.ts`)
when configured. Every money/status/Rx/menu/booking/rewards write is **awaited with rollback**:
on a rejected write the pre-mutation snapshot is restored and a toast surfaces the error, so a
change that did not persist can never linger on screen. (`writeBehind` remains the offline no-op
used when `NEXT_PUBLIC_GATEWAY_URL` is unset; seed mode reconciles on the next hydrate.)
Write bodies send **whole rupee** integers (the mapper divides paisa by 100). The seller listing
editor (`seller/products/[id]/edit`) persists name/description/photos through `updateProduct` but
routes **price/MRP through `upsertPrice`** (`PUT /seller/products/{id}`) so money edits reach
`catalog.products` + `inventory.stock` instead of staying local-only.

A production build with `NEXT_PUBLIC_GATEWAY_URL` unset renders a fixed
`SEED MODE — not connected to gateway` badge (`SeedModeBanner`), so seed data can
never masquerade as live data. Dev builds stay quiet.

### Home SDUI publish (`admin/super/sdui`)

The **App content (SDUI)** page is the control surface for the Home feed. It hydrates the raw
ID-only layout from `GET /admin/sdui/home` (super-admin only) and publishes edits through
`saveSduiLayoutHome` → `PUT /admin/sdui/home` (`pushWrite`, optimistic with rollback). The gateway
(`internal/sdui` → `reco.Repo.SaveHome`) bumps `sdui_layouts.version`, purges the compiled-feed
cache and audits `SDUI_PUBLISH`, so the mobile `GET /sdui/home` recompiles on its next poll with no
app release. The page edits section titles and `productIds` (id-only refs to `catalog.products`);
`storeIds`/`chips` are shown read-only. Sections that carry editorial hero `banners` (the Mart
`martHero` and Food `foodHero` rails) render an inline banner editor (title/subtitle/image per
banner) — images are display copy only, never money. Each banner image accepts a hosted URL or a direct upload, stored as
the **resolved public Storage URL** (`uploadProductImage` → `resolveImage`) because the mobile app
renders the doc value directly; in seed mode (no Supabase Storage) the data-URL fallback is rejected
so the bounded ID-only doc never bloats. The portal's `SduiSection`/`SduiBanner`/`SduiLayout` types
mirror the gateway `contracts` doc so a published layout round-trips without remapping.

### Seller hero campaigns (`seller/ads`, `admin/super/ads`)

The seller **Ads** page owns the **self-serve** hero creative surface (`ads.campaigns`, `0027`/`0028`):
a five-step `CampaignWizard` (**what → where → creative → when → review**) replaces the old
approval-gated flow. Step 1 picks a target scoped to the seller (Products / Dishes / My Stores, read
from the hydrated `useProducts`/`useMenus`/`useStores` slices — the full catalog is never hydrated for
this). The target's sub-app + type drive the allowed placements
(`src/data/ads/placements.ts` `eligiblePlacementsFor` over `PLACEMENTS_BY_APP`), so a Mart item can
only be bought on Mart surfaces + the cross-app `HOME_HERO` (Food/Pharma get their own hosts); each
option shows a `PLACEMENT_REACH_NOTE`, `CATEGORY_TOP` adds a category picker (`MASTER_CATEGORIES` tab
ids) and `STORE_TOP` auto-scopes to the target's store. Step 3 edits title (≤40), subtitle (≤60), a 16:9
poster (hosted URL or upload, stored as the **resolved public URL** — same rule as the SDUI banner
leaf; the gateway rejects external hosts) and a CTA, with a phone-frame preview. Step 5 posts
`requestHeroCampaign` → `POST /ads/campaigns` (`pushWrite`, optimistic **`LIVE`** one-row-per-placement
with rollback — no admin approval; the server machine-checks ownership/placement/creative/cap).
"My campaigns" and the rail "Product rails" tables read `useHeroCampaigns`/`useAdSlots` with rolled-up
KPIs. `admin/super/ads` is now a **live monitor** (no approval queue): KPIs Live / Reported / CTR, and
per row either **Takedown** (`setHeroCampaignStatus` → `PUT /ads/campaigns/{id}/status` with a reason)
or **Restore**. `sync.ts` hydrates the `heroCampaigns` slice from `GET /ads/campaigns` (auth-scoped);
`reportHeroAd` posts a user abuse report.

### Pharma quote → READY reveal (`seller/prescriptions`)

The prescriptions page is the control surface for the W24 quote workflow
(`db-schema.md` §12.12). Opening a row shows a drawer with the seller-safe header
(name only until READY), the Rx image keys resolved on demand via
`fetchPrescriptionImages` (short-lived signed URLs — the private bucket is never
public), a quote editor (name/qty/MRP/price/discount, live total), and an audit
trail. `savePrescriptionQuote` replaces the priced lines (→ `QUOTED`);
`setPrescriptionReady` is gated on ≥1 line and a positive total, matching the
server, and flips the Rx to `READY` — after which the customer's phone/address
appear under an amber "PII revealed — audited" banner and the customer is
notified. `Fulfil`/`Cancel` follow the same optimistic + write-behind path.

## Data + auth

`src/lib/config.ts` is the only module that reads env. Two integrations are
env-gated and degrade to local seed mode when unset:

- **Gateway reads** — `src/lib/api/http.ts` is the single fetch seam (bearer auth,
  query builder, error envelope, defensive snake→camel). `src/lib/api/sync.ts`
  implements `hydrateFromGateway()`: it best-effort fetches the gateway-owned
  slices (sellers, promo, ads, settlement, admins, prescriptions, bookings, blood,
  SDUI, reviews, and — partner completion — customers, menus, support tickets,
  rewards rates/ledger) and writes them into the store. Prescription rows carry
the quote lines, `quotedTotal`, reveal fields and status history; the seller
projection is name-only until `READY`/`FULFILLED`. Booking rows carry `seats`,
`fee` (rupees) and `paymentStatus`, and the queue issues accept/reject/vacate
decisions through awaited writes with rollback (`PUT /bookings/{id}/status`, `POST /bookings/{id}/vacate`).
  The `seller/bookings/settings` form is prefilled from `GET /seller/booking-config?vendorId=…`
  (`refreshBookingConfig`, best-effort; seed mode keeps the local default).
  In **development** an empty remote slice keeps the seeded rows (demo fallback); in
  **production** (`NODE_ENV=production`) an empty but successfully-fetched slice clears the local
  slice, so sellers/admins never see phantom demo rows. The gateway speaks **whole
  rupees**; the portal stores **paisa**, so the mapper multiplies by 100.
  The `admin/state/customers` page adds an on-demand **activity trail** panel per selected customer
  (`useUserTrail` → admin-only `GET /admin/user-trail?userId=`, ID-only `user_events`).
- **Auth (mocked by default)** — `src/lib/api/index.ts` `signIn` authenticates against
  the built-in demo directory (`src/data/auth/users.ts`) and never calls Supabase unless
  `NEXT_PUBLIC_AUTH_MODE=supabase`. `src/lib/supabase/auth.ts` is the dormant GoTrue REST
  seam (no `supabase-js` dependency): password sign-in, refresh, role-claim decode
  (`app_role`/`seller_id`/`state_code`, top-level or `app_metadata`). When Supabase mode is
  on, its bearer token is attached to every gateway call. In mock mode the calls carry no token
  and rely on the gateway's `AUTH_DISABLED=true` dev setting plus the **dev-only** `NEXT_PUBLIC_DEV_ROLE`
  / `NEXT_PUBLIC_DEV_SELLER` / `NEXT_PUBLIC_DEV_STATE` values (mapped to the gateway's `X-Dev-Role` /
  `X-Dev-Seller` / `X-Dev-State` headers; sent only when `NODE_ENV !== "production"`). Without a
  `DEV_ROLE` the mocked portal can read public data but role-gated routes reject it — set
  `NEXT_PUBLIC_DEV_ROLE=SUPER_ADMIN` to exercise the full control plane against the dev stack. The
  gateway CORS allow-list includes these `X-Dev-*` headers for `http://localhost:3000`.
- **Supabase Storage** — `src/lib/media/productImages.ts` stores a **Storage object
  key**, never a URL, and derives the public object URL at render (`PRODUCT_BUCKET`
  = `product-images`). `uploadProductImage()` uploads the session-authenticated
  compressed JPEG, falling back to a data URL when unconfigured.

Bootstrap (`app/providers.tsx`) restores the session then hydrates. Copy
`client/web/platform/.env.example` to `.env.local`:

```bash
NEXT_PUBLIC_GATEWAY_URL=        # e.g. http://localhost:8080
NEXT_PUBLIC_AUTH_MODE=mock      # "mock" (default) | "supabase" (GoTrue)
NEXT_PUBLIC_SUPABASE_URL=       # Storage always; Auth only when AUTH_MODE=supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_DEV_ROLE=           # dev-only X-Dev-Role override (e.g. SUPER_ADMIN); ignored in prod builds
NEXT_PUBLIC_DEV_SELLER=         # dev-only X-Dev-Seller (seller scope)
NEXT_PUBLIC_DEV_STATE=          # dev-only X-Dev-State (state scope)
```

## Verify

Run from `client/web/platform/`:

```bash
npm run ts:check   # tsc --noEmit
npm run build      # next build (must prerender all routes with no errors)
npm run lint       # eslint (prettier is `npm run format`, not a lint error)
```

## Deployment (Vercel)

The portal is a standard Next.js App Router app and deploys **zero-config** on
Vercel — set the project **Root Directory** to `client/web/platform`, framework
preset **Next.js**, build `next build`, and it produces the standard `.next`
output. There is no custom server and no build output API bundle.

Readiness config that ships with the app:

- **`vercel.json`** — security headers on every route (`X-Content-Type-Options`,
  `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`),
  mirroring the landing page. No rewrites/redirects/regions.
- **`package.json` `engines.node`** (`>=22.12.0`) — pins the Vercel build Node
  runtime (matches `client/web/landingpage`).
- **`public/robots.txt`** — `Disallow: /`; the console is private and every route
  also carries `metadata.robots: { index: false, follow: false }`.
- **Brand assets** — `src/components/brand/FaazioMark.tsx` exports `FaazioMark`
  (the Faazio knot glyph, contours copied from the mobile brand asset
  `client/mobile/src/assets/logo.svg`) and `BrandTile` (the glyph on the
  brand-gradient tile), used by `SellerShell`, `AdminShell` and the login
  screen. `public/` carries the generated icon set — `favicon.svg`,
  `favicon.ico`, `favicon-16x16`/`favicon-32x32`, `apple-touch-icon.png`,
  `android-chrome-192x192`/`android-chrome-512x512` — wired via
  `app/layout.tsx` `metadata.icons` + `metadata.manifest`
  (`/site.webmanifest`), plus `viewport.themeColor` (`#1162D3`).

No secrets are baked into the build: `NEXT_PUBLIC_*` values are read at build
time, so a demo deployment that leaves them unset renders in seed mode and
shows the `SEED MODE — not connected to gateway` badge. Set them in the Vercel
project's Environment Variables for a live deployment.