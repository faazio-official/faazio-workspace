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
> (`SellerWebViewScreen.tsx`).

## Flow inventory

| Domain | Flow | Surface | Doc |
|---|---|---|---|
| Onboarding | Registration / application | mobile `SellWithUs` + portal `/seller/onboarding` | [seller-registration.md](./onboarding/seller-registration.md) |
| Onboarding | KYC document upload + admin review | portal `/seller/onboarding`, `/admin/district/sellers/[id]` | [kyc-documents.md](./onboarding/kyc-documents.md) |
| Onboarding | Store/vendor setup | portal `/seller/stores`, `/seller/onboarding` | [store-setup.md](./onboarding/store-setup.md) |
| Catalog | Add product | portal `/seller/products/new` | [add-product.md](./catalog/add-product.md) |
| Catalog | Price / inventory update | portal `/seller/pricing`, `/seller/inventory` | [price-update.md](./catalog/price-update.md) |
| Orders | Seller order board + lifecycle | portal `/seller/orders`, `/seller/orders/[id]` | [order-lifecycle.md](./orders/order-lifecycle.md) |
| Orders | Payouts / ledger / invoices | portal `/seller/payments` | [payouts-ledger.md](./orders/payouts-ledger.md) |
| Web portal | Console shell + auth | `/seller/*` | [seller-console.md](./web-portal/seller-console.md) |

## Cross-cutting rules

- **Server-only:** portal reads/writes go through `src/lib/api/*` → same-origin
  `/api/gateway/[...path]`; there are no Server Actions. No bundled demo rows.
- **No fake latency:** `useMockLoading` is not allowed to fabricate loading (see
  [`../KNOWN_GAPS.md`](../KNOWN_GAPS.md)).
- **Honest local-only states:** notifications/support/rush-hour/restaurant-status are currently
  client-local; they are documented as gaps, not live flows.

## Known gaps

See [`../KNOWN_GAPS.md`](../KNOWN_GAPS.md). Seller-specific gaps include local-only notifications
and support, the "Simulate scan" toast, toast-only admin actions, and the district-admins page being
hardcoded to TTC.

## Linked docs

- `docs/architecture/web-portal.md`
- `docs/architecture/mobile-app.md` (seller partner)
- `docs/RUNBOOKS/PORTAL_AUTH.md`
