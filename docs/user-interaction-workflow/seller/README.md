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

## Flow inventory

Domain indexes are the entry point for each area; every flow page is linked from them.

| Domain | Flow | Surface | Doc |
|---|---|---|---|
| Onboarding | Registration / application | mobile `SellWithUs` (customer app) | [onboarding/index.md](./onboarding/index.md) · [seller-registration.md](./onboarding/seller-registration.md) |
| Onboarding | KYC document upload + admin review | mobile `SellWithUs` upload; admin `/admin/district/sellers/[id]` | [kyc-documents.md](./onboarding/kyc-documents.md) |
| Onboarding | Store/vendor setup | portal `/seller/onboarding` (adds a vendor), `/seller/stores` | [store-setup.md](./onboarding/store-setup.md) |
| Catalog | Add product | portal `/seller/products/new` | [catalog/index.md](./catalog/index.md) · [add-product.md](./catalog/add-product.md) |
| Catalog | Price / inventory update | portal `/seller/pricing`, `/seller/inventory` | [price-update.md](./catalog/price-update.md) |
| Orders | Seller order board + lifecycle | portal `/seller/orders`, `/seller/orders/[id]` | [orders/index.md](./orders/index.md) · [order-lifecycle.md](./orders/order-lifecycle.md) |
| Orders | Payouts / ledger / invoices | portal `/seller/payments` | [payouts-ledger.md](./orders/payouts-ledger.md) |
| Web portal | Console shell + auth | `/seller/*` | [web-portal/index.md](./web-portal/index.md) · [seller-console.md](./web-portal/seller-console.md) |

## Cross-cutting rules

- **Server-only:** portal reads/writes go through `src/lib/api/*` → same-origin
  `/api/gateway/[...path]`; there are no Server Actions. No bundled demo rows.
- **No fake latency:** `useMockLoading` must not fabricate loading. It is currently still present
  (320 ms, 37 `app/` files) and is recorded as a violation in [`../KNOWN_GAPS.md`](../KNOWN_GAPS.md).
- **Honest local-only states:** notifications/support/rush-hour/restaurant-status are currently
  client-local; they are documented as gaps, not live flows.

## Known gaps

See [`../KNOWN_GAPS.md`](../KNOWN_GAPS.md). Seller-specific gaps include the current
`useMockLoading` fake-latency violation, local-only notifications and support, the "Simulate scan"
toast, toast-only admin/settings actions, and the district-admins page being hardcoded to TTC.

## Linked docs

- `docs/architecture/web-portal.md`
- `docs/architecture/mobile-app.md` (seller partner)
- `docs/RUNBOOKS/PORTAL_AUTH.md`
