# Web Portal (Next.js) — architecture deep dive

The Faazio Partner Portal is the seller / state-admin / super-admin console. It
renders from a Zustand store that is seeded from `client/web/platform/src/data/**` and, when
`NEXT_PUBLIC_GATEWAY_URL` is set, hydrated from the Go Chi gateway
(`client/web/platform/src/lib/api/sync.ts`). **Portal auth is the only auth mode** — the
portal signs in against gateway-native credentials (HttpOnly cookies, no token in
`localStorage`). A superadmin issues seller and state-admin logins from
`/admin/super/credentials`; both carry a scope (`seller_id` or `state_code`) that the
gateway enforces on every request. The session projection is never persisted and is
re-fetched from the cookie on load. See "Data + auth" and "Portal auth" below.

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
| `/login` | gateway-native portal sign-in (any role) |
| `/security` | password rotation for any portal role (forced when `mustChange`, i.e. scoped roles only) |
| `/admin/super/security` | superadmin shortcut to the same password rotation |
| `/admin/super/credentials` | superadmin issues/disables every login and resets any role's password |

**Seller console — own data (`app/seller/**`)** — ads, catalog, pricing, promotions, stores,
menus, orders, bookings, prescriptions, returns, reviews, payments, analytics, support, settings,
onboarding. This is where paid hero campaigns (`seller/ads` wizard) and organic offers are authored.
The campaign wizard's **what→where** placements map 1:1 to the paid mobile surfaces documented in
`PAGE_CATALOG.md` §2.5/§2.6: `MART_HERO`/`FOOD_HERO` (house hero carousels) and `STORE_TOP`
(restaurant profile band), so a seller target resolves to the same slot the shopper sees.

| Route | Page | Sector |
| --- | --- | --- |
| `seller` | dashboard | all |
| `seller/ads` | hero CampaignWizard (what→where→creative→when→review) + campaign list/KPIs — includes the `PHARMA_HERO` (Pharma home), `CATEGORY_TOP` (Pharma/mart category drill-in) and `STORE_TOP` (Pharma medical shop / mart vendor) placements | all |
| `seller/products` | catalog list | all |
| `seller/products/new` | create listing | all |
| `seller/products/[id]/edit` | listing editor (name/desc/photos + `upsertPrice`) | all |
| `seller/inventory` | stock | all |
| `seller/pricing` | price/MRP | all |
| `seller/promotions` | festival opt-ins + live price | all |
| `seller/stores` | store profile | all |
| `seller/menus` | dish menus (+ authoritative MRP strike) | FOOD |
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
| `admin/state/blood` | blood requests board (PHARMA) — server `blood.requests` with `contact`/`address` redacted for anon; moderation (`DELETE /blood-requests/{id}`) |
| `admin/state/customers` | customer list + activity trail |
| `admin/state/coupons` · `admin/state/festival` | promo |
| `admin/state/pricing-audit` | price integrity |
| `admin/state/analytics` · `admin/state/content` · `admin/state/support` · `admin/state/audit` | console |

**Super admin console (`app/admin/super/**`)** — global control plane.

| Route | Page |
| --- | --- |
| `admin/super` | dashboard |
| `admin/super/ads` | live ad monitor (Live/Reported/CTR; Takedown/Restore) |
| `admin/super/sdui` | Home/Mart/Food/Pharma SDUI layout editor (sections, productIds, hero banners incl. `pharmaHero`/`pharmaPopular`/`pharmaEssentials`) |
| `admin/super/festival` · `admin/super/coupons` | promo authority |
| `admin/super/products` · `admin/super/sellers` | catalog/seller authority |
| `admin/super/sectors` · `admin/super/coverage` | taxonomy + coverage |
| `admin/super/rewards` · `admin/super/users` · `admin/super/states` | platform |
| `admin/super/state-admins` | state-admin directory — all 36 ISO 3166-2:IN states/UTs; coverage summary (X / 36) + progress bar + grouped uncovered chips |
| `admin/super/credentials` | issue/disable seller and state-admin portal logins (role + seller/state scope) |
| `admin/super/security` | superadmin password rotation (same component as `/security`) |
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
`catalog.products` + `inventory.stock` instead of staying local-only. The Food menu editor
(`seller/menus`) likewise writes an optional **MRP** (list price, rupees) alongside the selling price
through `upsertMenu` → `POST`/`PUT /seller/menus/{venueId}/{dishId}`; the gateway rejects `mrp < price`
(400) so the authored strike is always `mrp_paisa > price_paisa` and the mobile "Recommended & Offers"
rail can trust it. A menu with no MRP shows no strike (honest, never synthesized).

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
renders the doc value directly; in seed mode (no R2) the data-URL fallback is rejected
so the bounded ID-only doc never bloats. The portal's `SduiSection`/`SduiBanner`/`SduiLayout` types
mirror the gateway `contracts` doc so a published layout round-trips without remapping.

### Seller hero campaigns (`seller/ads`, `admin/super/ads`)

The seller **Ads** page owns the **self-serve** hero creative surface (`ads.campaigns`, `0027`/`0028`):
a five-step `CampaignWizard` (**what → where → creative → when → review**) replaces the old
approval-gated flow. Step 1 picks a target scoped to the seller (Products / Dishes / My Stores, read
from the hydrated `useProducts`/`useMenus`/`useStores` slices — the full catalog is never hydrated for
this). The target's sub-app + type drive the allowed placements
(`src/data/ads/placements.ts` `eligiblePlacementsFor` over `PLACEMENTS_BY_APP`), so a Mart item can
only be bought on Mart surfaces + the cross-app `HOME_HERO` (Food/Pharma get their own hosts). A Pharma
seller targets their `sector='PHARMA'` products/stores the same way — the app is read **per selected
row**, not per tab, so no separate "Pharma" tab is needed and `PHARMA_HERO`/`CATEGORY_TOP`/`STORE_TOP`
appear for them; each
option shows a `PLACEMENT_REACH_NOTE`, `CATEGORY_TOP` adds a category picker (`MASTER_CATEGORIES` tab
ids) and `STORE_TOP` auto-scopes to the target's store (for a FOOD **Dish** target the gateway
resolves the dish's `venueId` as a dining venue via `ResolveOwnedTarget(..., "VENUE", …)`, so a
restaurant header is reachable from the Dish tab — there is no separate VENUE target tab). Step 3 edits title (≤40), subtitle (≤60), a 16:9
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
- **Auth (portal-only)** — `src/lib/api/index.ts` `signIn` calls
  `src/lib/portal/auth.ts`, which talks only to same-origin `/api/auth/portal/*` route
  handlers. The tokens live in HttpOnly cookies and every data call goes through
  `/api/gateway/*`, so no bearer token is readable by JavaScript (see the next section).
  There is no demo directory, no GoTrue/Supabase Auth client and no `X-Dev-*` override.
- **Media** — `src/lib/media/productImages.ts` uploads through the gateway media registry to
  Cloudflare R2 and stores an `r2:<key>` reference, resolving it to the CDN origin at render.
  Without a configured gateway it falls back to a compressed data URL for local development.

Bootstrap (`app/providers.tsx`) restores the session then hydrates. Copy
`client/web/platform/.env.example` to `.env.local` (gitignored — the real local value lives there;
`.env.example` is the committed template and must never be edited with a real origin):

```bash
NEXT_PUBLIC_GATEWAY_URL=        # e.g. http://localhost:8080 (server-side upstream)
NEXT_PUBLIC_MEDIA_CDN_BASE=     # optional R2 CDN origin (defaults to the gateway's /assets path)
```

`NEXT_PUBLIC_*` is inlined by `next build`, not read at request time: after changing it you must
**rebuild/redeploy** the portal. `scripts/check-env.mjs` (wired to `predev`/`prebuild`) warns in dev
and fails the build when `NEXT_PUBLIC_GATEWAY_URL` is unset, so a build can never ship with every
auth route returning `503 not_configured`.

## Portal auth (gateway-native)

The portal is the only auth mode. There is **no new IdP**: the gateway already owns
`RequireRole` and `admins.audit_logs`, so it also stores the credentials
(`admins.portal_users`, migrations `0032` + `0033` + `0034`) and mints the tokens. Three roles are
issued: `SUPER_ADMIN` (seeded operationally, global), `STATE_ADMIN` (a 2-letter
`state_code`), and `SELLER` (a `seller_id`). The superadmin issues the scoped logins from
`/admin/super/credentials`; the token claims (`app_role`, `seller_id`, `state_code`) are
re-validated by `auth.PortalVerifier` on every request.

```
browser                        Next.js route handlers                 Go gateway
  |  POST /api/auth/portal/login   |                                      |
  |------------------------------->|  POST /auth/portal/login             |
  |                                |------------------------------------->| Argon2id verify + lockout
  |                                |<-------------------------------------| access JWT (15 m) + refresh (30 d)
  |  Set-Cookie faazio_pat/prt     |  (HttpOnly, Secure, SameSite=Lax)    |
  |<-------------------------------|                                      |
  |  GET /api/gateway/<path>       |  Authorization: Bearer <cookie>      |
  |------------------------------->|------------------------------------->| RequireRole + scope check
  |                                |  401 -> rotate refresh once, retry   |
```

- **Endpoints** (all gateway-native, see `docs/architecture/monolith-breakdown.md` §1):
  `POST /auth/portal/{login,refresh,logout}`, `GET /auth/portal/me`, `PUT /auth/portal/password`
  (any role), plus the superadmin credential surface
  `GET|POST /admin/portal-users`, `PUT /admin/portal-users/{id}`,
  `PUT /admin/portal-users/{id}/password`. Creating/resetting a scoped credential defaults to
  `must_change=true` (`forceChange:false` opts out) and revokes that user's refresh sessions; a
  superadmin is reset with the password active immediately (`must_change=false`).
- **Cookie proxy** — `app/api/auth/portal/{login,refresh,me,logout,password}/route.ts` set the
  `faazio_pat` (access, 15 min) and `faazio_prt` (refresh, 30 d) HttpOnly/SameSite=Lax cookies;
  `app/api/gateway/[...path]/route.ts` injects the bearer server-side and rotates the refresh
  token on a 401. This is the XSS win: an injected script cannot read the token.
- **First-login confinement** — the access token carries `must_change`. Until the password is
  rotated, the gateway refuses every path outside `/auth/portal/*` (`403 password_change_required`)
  and the shell redirects to `/security`, so a temporary password cannot reach the control plane.
  `SUPER_ADMIN` is exempt (the claim is never set for it): a superadmin password is always active,
  and any active superadmin can reset any role's password from `/admin/super/credentials`.
- **Refresh rotation** — opaque `faazio_pr_*` tokens are stored only as SHA-256 hashes
  (`admins.portal_sessions`), single-use per rotation; replaying a used token revokes the whole
  family. `POST /auth/portal/logout` also denylists the access `jti` in Valkey until it expires.
- **Password policy** — Argon2id (t=3, m=64 MiB, p=1) with a 16-byte salt and the
  `PORTAL_PEPPER` HMAC; at most 4 derivations run concurrently per instance so a public
  login spray cannot exhaust container memory. Newly-issued scoped credentials start with
  `must_change=true`; the portal forces `/security`, which rotates the password and revokes every
  existing session. Seeded superadmins start with `must_change=false` (never confined) and may
  rotate voluntarily from `/security`.
- **Throttling** — per-IP (10/min) + per-email (5/min) Valkey counters (hashed keys) plus a
  durable 5-failure → 15-minute `locked_until`; failures return a generic
  `invalid_credentials` (no user enumeration). Cloudflare adds an edge WAF rule on
  `POST /auth/portal/*` (see the portal-auth runbook).
- **Secrets** — `PORTAL_JWT_SECRET` and `PORTAL_PEPPER` are Render env vars (never committed);
  provisioning/rotation/unlock steps live in `docs/RUNBOOKS/PORTAL_AUTH.md`.
- **Diagnostics** — `GET /api/auth/portal/status` is an unauthenticated, rate-limited probe that joins
  the two dashboards: it reports `portalEnabled` (Vercel build-time `NEXT_PUBLIC_GATEWAY_URL`),
  `gatewayBaseHost` (hostname only), `gatewayReachable` (`GET /health`) and `gatewayAuth`
  (`ok` | `portal_auth_unavailable` | `unreachable`, from a zero-credential `POST /auth/portal/login`
  dry-run). The login page calls it on mount and shows a pre-submit banner, so the three distinct
  `503` origins are distinguishable without DevTools. Every route echoes an `X-Request-Id` (propagated
  to the gateway as `X-Request-Id`), so one Vercel log line correlates with the Render request log.
- **Error codes** — `src/lib/portal/auth.ts` preserves the gateway/route `code` on a `PortalError`.
  The login page renders code-specific copy: `not_configured` (build has no gateway URL),
  `gateway_unavailable` (gateway unreachable), `portal_auth_unavailable` (Render secret missing),
  `portal_unavailable` (credential tables/migration missing); `invalid_credentials` stays generic
  (no enumeration).

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

Set `NEXT_PUBLIC_GATEWAY_URL` to the gateway origin. Those route handlers run on
Vercel's Node runtime and call the gateway server-side, so the gateway's
`ALLOWED_ORIGINS` can stay exact (the browser only ever talks to the portal
origin). The gateway still needs `PORTAL_JWT_SECRET` + `PORTAL_PEPPER` and
migrations `0032` + `0033` + `0034` applied before the first login (deploy order in
`docs/RUNBOOKS/PORTAL_AUTH.md`).