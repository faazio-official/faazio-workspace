# Seller console + portal auth

**App / route:** `client/web/platform` · `/login` → role home (`/seller`, `/admin/district`,
`/admin/super`)
**Status:** Partial (auth shell shipped; local-only surfaces remain)
**Trigger:** Browser login, seller app WebView, or a session restore on page load. A seller's
`SELLER` credential is auto-provisioned on application approval (see
[`../onboarding/index.md`](../onboarding/index.md)); a superadmin can still issue/reset one at
`/admin/super/credentials`.

## Steps

1. Cold start (`client/mobile` seller app only): the native splash (layer 1) hands off to the JS
   **layer-2 splash** (`SplashFallback` `royal`) — Faazio wordmark on Faazio Blue with the bottom
   **"Product of FA CREATORS"** credit. The WebView mounts behind it (loading `/login`, which the
   portal middleware redirects to `/seller/*` when the refresh cookie is live), and the splash is
   only dropped once the portal's **auth has resolved** — `SellerWebViewScreen` calls
   `onPortalReady` when the WebView navigates to a `/seller/*` route, when the portal posts
   `faazio:auth-resolved` (a signed-out restore), or after a 5 s fallback
   (`PORTAL_AUTH_RESOLVE_TIMEOUT_MS`; `SPLASH_MIN_DISPLAY_MS` 1.2 s floor). A returning seller
   therefore sees splash → dashboard, never the login page flashing first.
2. `middleware.ts` checks for the refresh cookie (`faazio_prt` / `__Host-faazio_prt`) on
   `/seller/*` and `/admin/*`; absent → redirect to `/login?next=…`.
3. `/login` calls `signIn` → `POST /api/auth/portal/login` → gateway `POST /auth/portal/login`.
4. The gateway verifies credentials (`admins.portal_users`) and mints a portal HS256 JWT
   (`iss=faazio-portal`, `aud=portal`) + rotating refresh session.
5. `setAuthCookies` stores `faazio_pat` (15 min) and `faazio_prt` (30 d) as HttpOnly cookies.
6. `providers.tsx` calls `restoreSession` on mount; `armProactiveRefresh` /
   `armVisibilityRefresh` keep the session fresh. `refreshTokensSingleflight` dedupes concurrent
   refreshes. While the restore is in flight (`sessionStatus === "unknown"`), `/login` renders a
   branded loading state instead of the form and `RoleGate` renders its loading shell instead of
   "Sign in to continue", so a signed-in refresh never flashes unauthenticated UI.
7. `RoleGate` + `src/lib/auth/permissions.ts` route the role to its home:
   `homeFor()` → `/seller`, `/admin/district`, or `/admin/super`.
8. Seller console pages read/write via `src/lib/api/*` → `/api/gateway/[...path]` (the proxy
   forwards cookies and retries once after rotation).
9. Logout calls `POST /api/auth/portal/logout` and clears cookies.

## State

- `usePortalStore` (client store) + HttpOnly cookies (tokens never exposed to JS).
- `src/lib/portal/auth.ts` — login/restore/refresh/logout/password.
- `src/lib/portal/server.ts` — cookie contract and refresh singleflight.

## Data path

- `POST /auth/portal/login|refresh|logout`, `GET /auth/portal/me`, `PUT /auth/portal/password` →
  `admins.portal_users`, `admins.portal_sessions`.
- All console reads/writes → gateway endpoints listed in the seller/catalog/orders docs.
- No bundled demo rows; a disconnected gateway yields an empty state, not fixtures.

## Mobile layout contract

- Below `md` the seller content is **fluid full-width** (the old 430px centred strip left dead
  gutters on tablets/landscape); at `md` it switches to the persistent `SellerDesktopShell` sidebar
  beside a `max-w-[1024px]` column. The floating bottom nav is `md:hidden` and stays a centred
  `max-w-[430px]` dock.
- Mobile type is **not** the 13px desktop root: `html:has(.font-seller)` raises the root to 16px
  below `md` (admin routes keep 13px). Fields stay pinned to 16px to prevent iOS focus auto-zoom.
- `--seller-nav-gap` + `--seller-nav-h` (`src/styles.css`) are the single source of truth for the
  nav height/gap; the nav carries `h-[var(--seller-nav-h)]`, and `main` bottom padding + every
  fixed action bar/FAB derive from them plus `env(safe-area-inset-bottom)`.
- The bottom nav is hidden on `/seller/explore` (that page is the navigation itself). Its labels
  are plain single words shop owners already use. The third tab is sector-aware: Food shops get
  **Menu** → `/seller/menus`; Mart/Pharmacy shops get **Offers** → `/seller/offers`. Orders mode is
  Orders / Stock / Menu|Offers / Reviews and Hub mode is Home / Ads / Menu|Offers / Payments; the
  round switch reads Home / Orders. `/seller/offers` deliberately stays out of `HUB_MODE_PATHS`, so
  opening it keeps the Orders-mode bar and the Offers tab highlighted. Spacing follows the
  4px grid and derives from `--seller-nav-h` / `--seller-nav-gap`.
- Mobile headers (`OrdersTopBar`, `HubHeader`, `OutletHeader`) share one hairline bottom border,
  `px-4` padding and the `env(safe-area-inset-top)` offset; action clusters are `shrink-0` so the
  shop name truncates instead of crowding the icons. In `OrdersTopBar` the shop-name bar (name +
  area) is the `StoreSwitcher` trigger, while the `Online`/`Offline` chip beside it is a separate
  link to `/seller/restaurant-status` — the two are distinct targets, never one control.
- The shop switcher is read-only when there is nothing to switch to: with no shops (or while the
  list is loading) the trigger renders as plain text, with exactly one shop it says "You have one
  shop" instead of opening a one-row menu, and rows that arrive without a `storeId` are dropped. A
  persisted `activeStoreId` that no longer names one of the seller's shops is reconciled to a real
  shop on load, so a switch never scopes the console to a ghost vendor. `PageHeader`'s `right` slot
  keeps its content on one line (`shrink-0`, `whitespace-nowrap`) and the title truncates first —
  the `Add shop` action on `/seller/stores` never wraps under its icon.
- Product rows on `/seller/products` are viewport-clamped (`min-w-0 max-w-full overflow-hidden`):
  the image + chevron + status pill are `shrink-0` and pinned, while the name, `category · productId`
  and price truncate via `min-w-0`. The image is `h-12 w-12` below `sm` and `h-14 w-14` at `sm`+, so
  a long name ellipsizes instead of pushing the right side out of the viewport. See
  [products.md](./products.md).
- All fixed action bars use the shared `FixedActionBar` (`src/components/sellers/kit.tsx`), which
  also aligns to the content column (right of the sidebar) at `md` and sits at `z-40`.
- `Sheet` uses `88dvh`, respects the bottom safe area, and is offset by the sidebar at `md`.
- Sticky headers (`HubHeader`, `OrdersTopBar`, `PageHeader`, order-history) respect
  `env(safe-area-inset-top)`. `PageHeader` always ends with an Explore escape (except on Explore
  itself), so no detail/settings page is a mobile dead end.
- Settings' `UnderlineTabs` wrap instead of hiding tabs in a scroll row.
- Hub-mode tab bar includes `/seller/onboarding`, `/seller/fee-change-request` and
  `/seller/fee-history`; landscape phones ≥ `md` get the desktop sidebar (Account group carries
  **Platform fee** → `/seller/fee-change-request`).

## Success / error / empty

- **Success:** role home renders live data. A returning seller cold-starting the app goes
  splash → dashboard (auth resolved before the splash drops).
- **Error:** `not_configured` / `gateway_unreachable` / `portal_auth_unavailable` diagnostics on the
  login page; 401 bounces to login. If auth never resolves, the splash releases after the 5 s
  fallback and the sign-in page shows.
- **Empty:** honest empty states.

## Known gaps

- Local-only seller surfaces: `support` (local tickets), `hub` checklist, `restaurant-status`,
  `rush-hour` (client-only zustand store). Notifications are now gateway-backed (see
  [notifications.md](./notifications.md)).
- Toast-only admin actions: district `content` publish, `orders` escalate, `pricing-audit` contact,
  super `settings` save.
- `/admin/super/district-admins` is hardcoded to TTC.
- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/web-portal.md`
- `docs/RUNBOOKS/PORTAL_AUTH.md`
- `docs/architecture/monolith-breakdown.md` (portal auth row)
