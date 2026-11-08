# Seller web portal — domain index

**Status:** Partial (fake `useMockLoading` latency; local-only/toast-only surfaces)
**App:** `client/web/platform` (Next.js App Router)
**Routes:** `/seller/*` (seller console), `/admin/district/*`, `/admin/super/*`
**Trigger:** Browser login at `/login`, or the seller app WebView.

## Flows

| Flow | Doc |
|---|---|
| Portal auth + seller console shell | [seller-console.md](./seller-console.md) |

## Route groups

| Group | Routes |
|---|---|
| Seller console | `/seller` → `/seller/orders`, `hub`, `products`, `products/new`, `products/[id]/edit`, `inventory`, `menus`, `pricing`, `orders`, `orders/[id]`, `order-history`, `returns`, `prescriptions`, `payments`, `promotions`, `ads`, `analytics`, `stores`, `reviews`, `settings`, `support`, `notifications`, `onboarding`, `outlet-info`, `restaurant-status`, `rush-hour`, `explore` |
| District admin | `/admin/district` + analytics, audit, blood, content, coupons, customers, delivery-boys, delivery/manual-allocation, delivery/payouts, fee-change-requests, festival, orders, pricing-audit, products, products/queue, sellers, sellers/[id], settings, support |
| Super admin | `/admin/super` + ads, analytics, app-config, audit, categories, coupons, coverage, credentials, delivery-boys, delivery/manual-allocation, delivery/payouts, district-admins, districts, fee-change-requests, festival, payouts, products, rewards, sdui, sectors, security, sellers, settings, users |

## State

- `usePortalStore` (client store) + HttpOnly cookies (tokens never exposed to JS).
- `src/lib/portal/auth.ts` — login/restore/refresh/logout/password.
- `src/lib/portal/server.ts` — cookie contract and refresh singleflight.
- `src/lib/api/*` hooks + `src/lib/sellerUi.ts` (client-only seller UI state).

## Data path

- All reads/writes go through `src/lib/api/*` → same-origin `/api/gateway/[...path]`.
- Auth: `/api/auth/portal/login|refresh|logout|me|status`, HttpOnly cookies (`faazio_pat`,
  `faazio_prt`), 15 min access / 30 d refresh.
- No Server Actions; no bundled demo rows.

## Success / error / empty

- **Success:** role home / console page renders live gateway data.
- **Error:** `not_configured` / `gateway_unreachable` / `portal_auth_unavailable` diagnostics; `401`
  bounces to `/login`. Toast-only actions report success without a gateway write (see Known gaps).
- **Empty:** honest empty states; no fixtures.

## Known gaps

- `useMockLoading` fake latency (320 ms, 37 `app/` files), local-only
  notifications/support/rush-hour/restaurant-status, toast-only admin and settings actions, and the
  TTC-hardcoded district-admins page. See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/web-portal.md`
- `docs/RUNBOOKS/PORTAL_AUTH.md`
