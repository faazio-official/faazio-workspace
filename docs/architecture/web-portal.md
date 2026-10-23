# Web Portal (Next.js) — architecture deep dive

The Faazio Partner Portal is the seller / district-admin / super-admin console. It
renders from a Zustand store that is seeded from `client/web/platform/src/data/**` and, when
`NEXT_PUBLIC_GATEWAY_URL` is set, hydrated from the Go Chi gateway
(`client/web/platform/src/lib/api/sync.ts`). **Portal auth is the only auth mode** — the
portal signs in against gateway-native credentials (HttpOnly cookies, no token in
`localStorage`). A superadmin issues seller and district-admin logins from
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

**District admin console (`app/admin/district/**`)** — district-scoped oversight (campaigns, coupons, ads and delivery read models remain state-level).

| Route | Page |
| --- | --- |
| `admin/district` | dashboard |
| `admin/district/products` · `admin/district/products/queue` | catalog + review queue |
| `admin/district/sellers` · `admin/district/sellers/[id]` | seller directory + KYC review: full registration, masked payout account, private-bucket passbook/FSSAI links, platform-fee editor, per-document verify (PAN/GSTIN/FSSAI/passbook), reject with reason, **Verify KYC** (Razorpay Route linked account → ACTIVE). SUPER_ADMIN reaches the same detail page from `admin/super/sellers`. |
| `admin/district/orders` · `admin/district/bookings` | order/booking oversight |
| `admin/district/blood` | blood requests board (PHARMA) — server `blood.requests` with `contact`/`address` redacted for anon; moderation (`DELETE /blood-requests/{id}`) |
| `admin/district/customers` | customer list + activity trail |
| `admin/district/delivery-boys` | delivery-partner control plane (state-scoped): pending KYC queue, per-document verify and admin-side replacement upload (private R2 → `PUT /delivery/register/{id}/documents/{docType}/reupload`; the rider app has no re-upload screen), profile approve → super-admin activation, active-rider list (load/capacity) with on-demand Valkey location, suspend |
| `admin/district/coupons` · `admin/district/festival` | promo |
| `admin/district/pricing-audit` | price integrity |
| `admin/district/analytics` · `admin/district/content` · `admin/district/support` · `admin/district/audit` | console |

**Super admin console (`app/admin/super/**`)** — global control plane.

| Route | Page |
| --- | --- |
| `admin/super` | global dashboard — KPI strip + **district matrix** (sellers and active-admin coverage for all 42 TN/PY districts, uncovered-only filter) |
| `admin/super/ads` | live ad monitor (Live/Reported/CTR; Takedown/Restore) |
| `admin/super/sdui` | Home/Mart/Food/Pharma SDUI layout editor (sections, productIds, hero banners incl. `pharmaHero`/`pharmaPopular`/`pharmaEssentials`) |
| `admin/super/festival` · `admin/super/coupons` | promo authority |
| `admin/super/products` · `admin/super/sellers` | catalog/seller authority — the seller list links into the shared KYC review detail and shows the platform fee |
| `admin/super/sectors` · `admin/super/coverage` | taxonomy + coverage |
| `admin/super/rewards` · `admin/super/users` · `admin/super/districts` | platform — `districts` is the per-district drill-down (supply, campaigns, roster) |
| `admin/{district,super}/fee-change-requests` | seller-initiated platform-fee change review — district admins see their district, super admins every district; approve applies the fee, reject requires a reason (server-enforced one pending request per seller) |
| `admin/super/district-admins` | district-admin directory — all 42 TN/PY districts; coverage summary (X / 42) + progress bar + grouped uncovered chips. **Unified creation:** one form creates the roster + (optionally, `issueLogin` default ON) the portal login + temporary password atomically; duplicate email blocked on/off-server, duplicate phone soft-warned |
| `admin/super/credentials` | issue/disable seller and district-admin portal logins (role + seller/district scope) |
| `admin/super/security` | superadmin password rotation (same component as `/security`) |
| `admin/super/delivery-boys` | all-India delivery-partner console — same review board, super-only activation and suspend/blacklist |
| `admin/super/analytics` · `admin/super/audit` · `admin/super/settings` | console |

> **Audit log retention (`0037`):** both audit pages (`admin/district/audit`, `admin/super/audit`) stay
> **read-only** — no UI edit/delete and no RLS delete policy. Rows are now a rolling **7-day window**:
> a gateway worker on Render purges `admins.audit_logs` older than 7 days nightly at **00:00 IST** (for
> all roles — SELLER, DISTRICT_ADMIN, SUPER_ADMIN), recording a surviving `AUDIT_PURGE` row. Copy reflects
> this ("Read-only, retained 7 days…"); a SUPER_ADMIN-only `POST /audit-logs/purge` manual trigger
> exists for staging/ops parity (same endpoint shape as `POST /media/gc`). No archive — purged rows are
> unrecoverable.

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
  The `admin/district/customers` page adds an on-demand **activity trail** panel per selected customer
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
(`admins.portal_users`, migrations `0032` + `0033` + `0034` + `0038`) and mints the tokens. Three roles are
issued: `SUPER_ADMIN` (seeded operationally, global), `DISTRICT_ADMIN` (a 3-letter district
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
- **Unified district-admin creation (`/admin/super/district-admins`, `0036`)** — `POST /district-admins` is the
  single form: `issueLogin:true` (default) mints the roster **and** the `DISTRICT_ADMIN` portal login
  (temporary password, `must_change` locked `true`) in one atomic server call and returns both; the
  page shows the copyable temporary password once. `issueLogin:false` pre-provisions a roster-only row
  (No login badge + one-click issue). Duplicate **email** (portal-email/roster-email, case-normalized)
  is hard-blocked with role-specific `409` codes and the client mirrors the check pre-submit (red
  inline error, form kept). Duplicate **phone** (seller/roster, digit-normalized) is a **soft
  warning** — amber pre-submit hint + `201 warnings[]` after create; shared lines are allowed by
  policy, so it never blocks.
- **Cookie proxy** — `app/api/auth/portal/{login,refresh,me,logout,password}/route.ts` set the
  `faazio_pat` (access, 15 min) and `faazio_prt` (refresh, 30 d idle) HttpOnly/SameSite=Lax cookies;
  `app/api/gateway/[...path]/route.ts` injects the bearer server-side and rotates the refresh
  token on a 401. This is the XSS win: an injected script cannot read the token. A third,
  non-secret `faazio_remember` cookie records the login form's "Stay signed in" checkbox: absent or
  `1` → persistent 30-day refresh cookie; `0` → the refresh cookie is browser-session-only (shared
  PCs), and every rotation route (`me`/`refresh`/`gateway/[...path]`) preserves that choice.
- **Session lifetimes (GCP model, `0038`)** — refresh families behave like `accounts.google.com`
  sessions: a 15-minute access token, a **30-day sliding idle** (`refresh`/`me` rotate on every
  request that touches the gateway), a **hard 180-day absolute cap** set once at login and never
  extended (an abandoned family dies even when a thief keeps refreshing it), and a **30-second
  reuse grace** that makes a concurrent two-tab / gateway-proxy rotation idempotent instead of a
  "theft". `rotated_to_hash` links each rotation to its child, so a replayed token inside the grace
  window gets a fresh sibling pair (`PORTAL_REFRESH_GRACE`, response header `X-Refresh-Reused`),
  never a family nuke. True replay *outside* the window still revokes the family
  (`invalid_refresh_reuse`). Policy lives in `server/gateway/internal/portal/tokens.go`:

  | Lifetime | Value | Notes |
  |---|---|---|
  | Access | 15 min | HS256 JWT, `jti` denylisted on logout |
  | Idle (sliding) | 30 d | reset on every rotation |
  | Absolute (hard cap) | 180 d | fixed at login, never extended |
  | Reuse grace | 30 s | tunable 10–60 s; replay inside = idempotent, after = theft |
- **Transient vs terminal refresh** — `refreshTokens()` (in `src/lib/portal/server.ts`) classifies
  every refresh failure: only gateway `401`/`400` are `terminal` (the refresh really died → the
  route clears the cookies); network errors, timeouts (5 s AbortSignal), `5xx` and malformed
  bodies are `transient`. All three restore routes (`me`, `refresh`, `gateway/[...path]`)
  **keep the cookies on transient** and return `503`; they only `clearAuthCookies` on terminal.
  So one Cloudflare blip or gateway cold-start can never delete a still-valid session.
- **Client restore semantics** — `restorePortalSession()` returns `ok | transient | signed_out`.
  On a transient the client (a) does not clobber a live session, (b) shows a "Reconnecting…" gate
  (`RoleGate`, driven by the store's `sessionStatus`) instead of the login prompt, and (c) retries
  with backoff (`providers.tsx`: 1 s / 3 s / 8 s). `src/lib/api/http.ts` also retries a single
  `503` request once after 1 s (throttled "Reconnecting…" toast) before throwing. `session` is
  still never persisted.
- **Single-flight rotation (P3.1)** — `refreshTokensSingleflight()` in `src/lib/portal/server.ts`
  coalesces every concurrent 401-triggered refresh onto ONE upstream `/auth/portal/refresh`, keyed
  by a 16-hex sha256 of the refresh cookie with a 10 s TTL (in-process map — no Valkey key, so the
  cache doc is untouched). Combined with the server's 30 s reuse grace this makes two tabs / a wide
  cold-start spawn genuinely idempotent.
- **Proactive keep-alive (P3.2)** — the client never waits for a 401: after login/me it arms a
  timer at ~80% of the access token's life (`armProactiveRefresh`, client-side single-flight),
  restores on tab `visibilitychange`/`focus` throttled to once a minute (`armVisibilityRefresh`),
  and re-arms after every rotation (transient failures retry at 30 s). The `expiresIn` floor is
  echoed by the `login`/`refresh`/`me` routes; nothing is persisted — the timer is in-memory only.
- **Auth guard + deep links (P3.3)** — `middleware.ts` (edge) redirects `/seller/*` and `/admin/*`
  with no `faazio_prt` (or future `__Host-faazio_prt`) cookie to `/login?next=<path>`. The login
  page validates `next` (internal path only, no open redirect), "Stay signed in" maps to
  `faazio_remember`/`remember`, and a forced password rotation stashes `next` in `sessionStorage`
  (`faazio.next`) so the deep link survives the `/security` round-trip. On a genuinely dead session
  (`invalid_refresh`, `session_expired_*`, `invalid_refresh_reuse` from `/api/gateway`) `http.ts`
  redirects once to `/login?next=…` — authorization 401s (wrong role) never do.
- **First-login confinement** — the access token carries `must_change`. Until the password is
  rotated, the gateway refuses every path outside `/auth/portal/*` (`403 password_change_required`)
  and the shell redirects to `/security`, so a temporary password cannot reach the control plane.
  `SUPER_ADMIN` is exempt (the claim is never set for it): a superadmin password is always active,
  and any active superadmin can reset any role's password from `/admin/super/credentials`.
  A `DISTRICT_ADMIN` login minted by the unified creator always has `must_change=true` (locked —
  the temporary password is single-use by design).
- **Refresh rotation** — opaque `faazio_pr_*` tokens are stored only as SHA-256 hashes
  (`admins.portal_sessions`) with `ua_hash`/`ip_hash` one-way fingerprints, single-use-per-family
  with the reuse grace above. A rotation consumes the presented row (atomic `WHERE used_at IS
  NULL AND revoked_at IS NULL AND expires_at > now() AND absolute_expires_at > now()`) and inserts
  a child pinned to the same family + absolute cap; the idle timeout revokes **only that row**, so
  one lapsed device never logs the others out. `POST /auth/portal/logout` also denylists the access
  `jti` in Valkey until it expires.
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
  brand-gradient tile). `src/components/brand/FaazioWordmark.tsx` exports
  `FaazioWordmark` (the vector letterforms, copied verbatim from the landing
  page `client/web/landingpage/src/components/faazio-logo.tsx`) for the
  header/sidebar/login lockups. The placeholders they replaced:
  `app/page.client.tsx` (the raw `F` tile), `SellerShell`, `AdminShell` and the
  login screen all compose `BrandTile` + `FaazioWordmark` (wordmark only in the
  expanded sidebar; the collapsed rail stays icon-only). `public/` carries the
  generated icon set — `favicon.svg` (kept vector, untouched),
  `favicon.ico` (multi-size 16/32/48 ICO), `favicon-16x16`/`favicon-32x32`,
  `apple-touch-icon.png` (opaque white), `android-chrome-192x192`
  (`any`) / `android-chrome-512x512` (full-bleed, maskable-safe) — wired via
  `app/layout.tsx` `metadata.icons` (cache-busting `?v=3`, mirroring the
  landing page's `?v=2`) + `metadata.manifest` (`/site.webmanifest`), plus
  `viewport.themeColor` (`#1162D3`). The raster set is regenerated from the
  canonical mobile knot PNG (`client/mobile/src/assets/faazio-logo.png`) by
  `scripts/generate-brand-icons.py` (dev-only, python3 + Pillow); and
  `src/styles.css` provides the `.brand-wordmark` sizing token (18px for 14px
  chrome).

No secrets are baked into the build: `NEXT_PUBLIC_*` values are read at build
time, so a demo deployment that leaves them unset renders in seed mode and
shows the `SEED MODE — not connected to gateway` badge. Set them in the Vercel
project's Environment Variables for a live deployment.

Set `NEXT_PUBLIC_GATEWAY_URL` to the gateway origin. Those route handlers run on
Vercel's Node runtime and call the gateway server-side, so the gateway's
`ALLOWED_ORIGINS` can stay exact (the browser only ever talks to the portal
origin). The gateway still needs `PORTAL_JWT_SECRET` + `PORTAL_PEPPER` and
migrations `0032` + `0033` + `0034` + `0038` applied before the first login (deploy order in
`docs/RUNBOOKS/PORTAL_AUTH.md`).