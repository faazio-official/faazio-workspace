# Seller app / seller console — interaction workflows

**Products:** Faazio Seller Partner app (mobile) + the seller console in the Next.js Partner Portal.
**Mobile entry:** `client/mobile/index.seller.js` → `src/SellerPartnerApp.tsx` →
`src/features/seller-partner/SellerPartnerNavigator.tsx` (single route `Portal`).
**Portal:** `client/web/platform` → `/seller/*` (seller), `/admin/district/*` and
`/admin/super/*` (review/admin).
**Auth:** email + password → gateway-native portal HS256 JWT (`iss=faazio-portal`, `aud=portal`).
Sellers sign in to the seller app with the same credentials as the portal.

> The mobile seller app is intentionally a **WebView shell** over the portal. It is not a partial
> native flow; the real seller flows live in `client/web/platform/app/seller/*`. Admin-only portal
> paths are blocked inside the app with a "Not available in the Faazio Seller app" state
> (`src/features/seller-partner/screens/SellerWebViewScreen.tsx`).

## Cold start (seller app)

1. **Layer 1 — native splash** (Android `Theme.App.SplashScreen`, iOS `LaunchScreen`), unchanged.
2. **Layer 2 — branded JS splash** (`SplashFallback` `royal`, `SellerPartnerApp.tsx`), whose overlay
   is dropped only when the WebView reports **auth resolved**: it navigated to `/seller/*`, or the
   5 s `PORTAL_AUTH_RESOLVE_TIMEOUT_MS` fallback fired (signed-out seller on `/login`), or the
   portal failed. `onLoadEnd` alone is not a readiness signal — the first painted page is `/login`.
3. **Portal** — `providers.tsx` restores the HttpOnly-cookie session; while it is in flight
   (`sessionStatus === "unknown"`) the portal paints a branded loading skeleton, not the login form
   or "Sign in to continue".
4. **Result** — a returning seller goes splash → dashboard with no login-page flash; a signed-out
   seller goes splash → sign-in after the fallback. Details:
   [web-portal/seller-console.md](./web-portal/seller-console.md).

## Flow inventory

Domain indexes are the entry point for each area; every flow page is linked from them.

| Domain | Flow | Surface | Doc |
|---|---|---|---|
| Onboarding | Public web enquiry (no account) | landing page `/sell-with-us` | [onboarding/seller-web-intake.md](./onboarding/seller-web-intake.md) |
| Onboarding | Enquiry follow-up queue (portal) | portal `/admin/*/seller-inquiries` | [onboarding/seller-inquiry-queue.md](./onboarding/seller-inquiry-queue.md) |
| Onboarding | Registration / application | mobile `SellWithUs` (customer app) | [onboarding/index.md](./onboarding/index.md) · [seller-registration.md](./onboarding/seller-registration.md) |
| Onboarding | KYC document upload + admin review | mobile `SellWithUs` upload; admin `/admin/district/sellers/[id]` | [kyc-documents.md](./onboarding/kyc-documents.md) |
| Onboarding | Store/vendor setup | portal `/seller/onboarding` (adds a vendor), `/seller/stores` | [store-setup.md](./onboarding/store-setup.md) |
| Account | Platform-fee change request + own history | portal `/seller/fee-change-request`, `/seller/fee-history` | [web-portal/fee-change-requests.md](./web-portal/fee-change-requests.md) |
| Catalog | Add product | portal `/seller/products/new` | [catalog/index.md](./catalog/index.md) · [add-product.md](./catalog/add-product.md) |
| Catalog | Products list (+ scroll-to-reload) | portal `/seller/products` | [web-portal/products.md](./web-portal/products.md) |
| Catalog | Price update | portal `/seller/pricing` | [price-update.md](./catalog/price-update.md) |
| Catalog | Sector-aware inventory (Food dish availability + add-ons · Mart/Pharmacy stock qty/ETA) | portal `/seller/inventory` | [catalog/inventory.md](./catalog/inventory.md) |
| Catalog | Dish creation + publish (section → leaf sub-category, photo, Publish/Draft) | portal `/seller/menus` (FOOD only) | [web-portal/menu-creation.md](./web-portal/menu-creation.md) |
| Catalog | Dish add-ons (create, link, review) | portal `/seller/inventory` (Add-ons tab, FOOD only), admin `/admin/district/addons/queue` | [web-portal/addons.md](./web-portal/addons.md) |
| Catalog | Edit / delete / restore (trash) | portal `/seller/products/[id]/edit`, `/seller/products/trash` | [product-trash.md](./catalog/product-trash.md) |
| Catalog | Product-first festival offers | portal `/seller/offers` (Mart/Pharmacy) | [offers.md](./catalog/offers.md) |
| Orders | Seller order board + lifecycle | portal `/seller/orders`, `/seller/orders/[id]` | [orders/index.md](./orders/index.md) · [order-lifecycle.md](./orders/order-lifecycle.md) |
| Orders | Payouts / ledger / invoices | portal `/seller/payments` | [payouts-ledger.md](./orders/payouts-ledger.md) |
| Web portal | Console shell + auth | `/seller/*` | [web-portal/index.md](./web-portal/index.md) · [seller-console.md](./web-portal/seller-console.md) |
| Web portal | Notifications inbox | `/seller/notifications` | [web-portal/notifications.md](./web-portal/notifications.md) |
| Web portal | Settings (profile, bank, notifications, sub-users, security) | portal `/seller/settings` | [web-portal/settings.md](./web-portal/settings.md) |
| Growth | Shop page ads (per-shop STORE_TOP playlist: draft/play/order/click target) | portal `/seller/ads` | [web-portal/shop-page-ads.md](./web-portal/shop-page-ads.md) |
| Web portal | Team invite acceptance | portal `/accept-invite?token=…` | [web-portal/accept-invite.md](./web-portal/accept-invite.md) |
| Web portal | District admins (roster, vertical scope, invite hand-over) | portal `/admin/super/district-admins`, `/admin/super/districts/[code]` | [web-portal/district-admin-roster.md](./web-portal/district-admin-roster.md) |
| Web portal | District admin invite acceptance (set own password) | portal `/accept-invite/admin?token=…` | [web-portal/district-admin-invite-accept.md](./web-portal/district-admin-invite-accept.md) |
| Web portal | Super admin categories + mandatory GST + main app header | `/admin/super/categories` | [web-portal/super-admin-categories.md](./web-portal/super-admin-categories.md) |
| Web portal | Super admin GST rate slab master | `/admin/super/gst-rates` | [web-portal/super-admin-gst-rates.md](./web-portal/super-admin-gst-rates.md) |
| Web portal | Super admin global catalog + seller product requests | `/admin/super/products` | [web-portal/super-admin-products.md](./web-portal/super-admin-products.md) |
| Web portal | Super admin seller credential hand-over (approve → share login) | `/admin/super/sellers`, `/admin/super/credentials` | [web-portal/credential-handover.md](./web-portal/credential-handover.md) |
| Help centre | Full seller-journey walkthrough (22 chapters, every seller action) | landing page `/help-centre` | [help-centre.md](./help-centre.md) |

> The landing page `/help-centre` covers the full journey, not just onboarding: chapter 1 is the
> application, then store setup, catalog, offers/add-ons, orders, notifications, payouts, settings
> and the rest of the console. See [`help-centre.md`](./help-centre.md) for the step → action → endpoint
> map.

## Cross-cutting rules

- **Server-only:** portal reads/writes go through `src/lib/api/*` → same-origin
  `/api/gateway/[...path]`; there are no Server Actions. No bundled demo rows.
- **No fake latency:** portal loading comes from `usePortalLoading()` (real gateway hydration);
  fabricated `useMockLoading` timers are removed.
- **Honest local-only states:** support/rush-hour/restaurant-status are currently client-local;
  they are documented as gaps, not live flows. Notifications are gateway-backed.

## Known gaps

See [`../KNOWN_GAPS.md`](../KNOWN_GAPS.md). Seller-specific gaps include local-only support,
toast-only admin actions, manual invite-link delivery (no email provider), `lowStock`/`campaigns`
having no event producer yet, an un-cancellable fee-change request, and district-admin
vertical-scope flags being stored but not yet enforced by gateway authorization.

## Linked docs

- `docs/architecture/web-portal.md`
- `docs/architecture/mobile-app.md` (seller partner)
- `docs/RUNBOOKS/PORTAL_AUTH.md`
