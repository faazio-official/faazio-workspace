# User Interaction Workflow — single source of truth

Status: **authoritative** for every expected user interaction across the three mobile products
(customer, delivery partner, seller partner) and the seller-facing web portal.

This folder is the **contract**; the code is the implementation. If a route, screen, button,
endpoint, store action, or DB write exists, its end-to-end flow belongs here. The intended state is
full coverage; current known coverage gaps are listed explicitly in
[`KNOWN_GAPS.md`](./KNOWN_GAPS.md) so this folder never claims coverage it does not have.

## The sync rule (non-negotiable)

Any code change that touches a user-facing flow — a screen, route, tab, bottom sheet, action,
Zustand store, `GatewayClient` method, gateway endpoint, or DB read/write in a flow — **must update
the matching page under `docs/user-interaction-workflow/<app>/<domain>/` in the same change**.

- One page per flow. One `index.md` per domain.
- A PR that ships behavior without the workflow page is incomplete and fails review.
- Deleting a flow deletes its page in the same change.
- New pages are added to this README and its app README; new folders are also added to the docs map
  in root `AGENTS.md` and `docs/README.md`.

## No undocumented partial workflows

Partial flows may exist in the code today, but they may never be hidden: every partial flow is
marked **Status: Partial** on its page and listed in [`KNOWN_GAPS.md`](./KNOWN_GAPS.md). New
half-built flows are not allowed without that marking. Every documented flow must state:

1. **Trigger** — user action, deep link, push, or boot condition.
2. **Steps** — numbered, with the real route names and screen files.
3. **State** — Zustand store(s) and selectors under `client/mobile/src/state/`.
4. **Data path** — `GatewayClient` method → gateway endpoint → table/collection, or an explicitly
   labelled offline/error shell.
5. **Success / error / empty** — honest states. No fabricated rows, balances, orders, or latency.
6. **Known gaps** — link to [`KNOWN_GAPS.md`](./KNOWN_GAPS.md) when the flow is partial.

If a flow is intentionally a shell (for example the seller app is a WebView over the portal), say so
and link the real flow.

## No mocked setup — DB-driven data only

This folder documents the rule enforced by `AGENTS.md`:

- **Client:** no inline fixture data presented as live, no `useMockLoading`-style fake latency, no
  client-generated demo orders/balances/coins as online data, no mock mode as the online origin.
  `@data/*` fixtures appear only as an explicitly labelled offline/error shell or read-through
  cache, never while the gateway answers. `GatewayClient` is server-only — no `@data/*`
  substitution on failure.
- **Server:** no hardcoded return values, no in-memory seed as runtime origin, no fake latency, no
  synthetic responses. Reads/writes go to Supabase Postgres/MongoDB through the Go Chi modular
  monolith; seed files bootstrap only.
- **Tags:** `@data/*` entries carry `@mock`/`@seed`/`@static`/`@server` in `data/DATA_CONTROL.md`.
  Every `@mock` entry is a contract for a gateway handler (`@mock → @server`), not a UI data source.

## App roots (do not conflate)

| Product | JS entry | Navigator | Notes |
|---|---|---|---|
| Customer | `client/mobile/index.js` | `src/navigation/AppNavigator.tsx` → `MainTabs` / `FoodStack` | Consumer SuperApp |
| Seller partner | `client/mobile/index.seller.js` | `src/features/seller-partner/SellerPartnerNavigator.tsx` | Single `Portal` WebView over `client/web/platform` (email/password portal JWT) |
| Delivery partner | `client/mobile/index.delivery.js` | `src/features/delivery-partner/DeliveryPartnerNavigator.tsx` | Separate product, Android flavor + iOS config |
| Seller web portal | `client/web/platform` | Next.js App Router | `/seller/*`, `/admin/district/*`, `/admin/super/*` |

## Page template

```markdown
# <Flow name>

**App / route(s):** <entry> · `<RouteName>` (`<screen file>`)
**Status:** Shipped | Partial | Gap
**Trigger:** <user action / deep link / push / boot>

## Steps
1. ...

## State
- `<store>` — <what it holds>

## Data path
- `gateway.<method>()` → `METHOD /path` → `schema.table`
- Offline shell: <only if explicitly labelled>

## Success / error / empty
- Success: ...
- Error: ...
- Empty: ...

## Known gaps
- <link or "None">

## Linked docs
- `docs/architecture/mobile-app.md`
- `docs/architecture/monolith-breakdown.md`
- `data/DATA_CONTROL.md`
```

## Index

### Customer
- [Customer overview](./customer/README.md)
- [Onboarding](./customer/onboarding/index.md) · [Phone OTP login](./customer/onboarding/phone-otp-login.md) · [Location picker](./customer/onboarding/location-picker.md)
- [Home](./customer/home/index.md) · [Home feed](./customer/home/home-feed.md) · [Sponsored rail](./customer/home/sponsored-rail.md)
- [Discovery](./customer/discovery/index.md) · [Store drill-in](./customer/discovery/store-drillin.md) · [Product detail](./customer/discovery/product-detail.md) · [Product review](./customer/discovery/product-review.md)
- [Cart & checkout](./customer/cart-checkout/index.md) · [Add to cart](./customer/cart-checkout/add-to-cart.md) · [Delivery-fee quote](./customer/cart-checkout/delivery-fee-quote.md) · [Place order](./customer/cart-checkout/place-order.md)
- [Orders](./customer/orders/index.md) · [Order history](./customer/orders/order-history.md) · [Order feedback](./customer/orders/order-feedback.md)
- [Profile](./customer/profile/index.md) · [Saved addresses](./customer/profile/saved-addresses.md) · [Rewards ledger](./customer/profile/rewards-ledger.md) · [Rate vendor](./customer/profile/rate-vendor.md)
- [Pharma](./customer/pharma/index.md) · [Prescription upload](./customer/pharma/prescription-upload.md) · [Blood donor](./customer/pharma/blood-donor.md)

### Seller
- [Seller overview](./seller/README.md)
- [Onboarding](./seller/onboarding/index.md) · [Registration](./seller/onboarding/seller-registration.md) · [KYC documents](./seller/onboarding/kyc-documents.md) · [Store setup](./seller/onboarding/store-setup.md)
- [Catalog](./seller/catalog/index.md) · [Add product](./seller/catalog/add-product.md) · [Price update](./seller/catalog/price-update.md) · [Edit / delete / restore](./seller/catalog/product-trash.md)
- [Orders](./seller/orders/index.md) · [Order lifecycle](./seller/orders/order-lifecycle.md) · [Payouts ledger](./seller/orders/payouts-ledger.md)
- [Web portal](./seller/web-portal/index.md) · [Seller console](./seller/web-portal/seller-console.md) · [Products list](./seller/web-portal/products.md) · [Dish add-ons](./seller/web-portal/addons.md) · [Notifications](./seller/web-portal/notifications.md) · [Settings](./seller/web-portal/settings.md) · [Team invite acceptance](./seller/web-portal/accept-invite.md) · [Super admin categories + home rail](./seller/web-portal/super-admin-categories.md)

### Delivery
- [Delivery overview](./delivery/README.md)
- [Onboarding](./delivery/onboarding/index.md) · [Rider registration](./delivery/onboarding/rider-registration.md) · [Vehicle & documents](./delivery/onboarding/vehicle-documents.md)
- [Availability](./delivery/availability/index.md) · [Go online](./delivery/availability/go-online.md)
- [Offers](./delivery/offers/index.md) · [Delivery offer](./delivery/offers/delivery-offer.md) · [Route sequencing](./delivery/offers/route-sequencing.md)
- [Fulfillment](./delivery/fulfillment/index.md) · [Order pickup](./delivery/fulfillment/order-pickup.md) · [Customer handover](./delivery/fulfillment/customer-handover.md)
- [Earnings](./delivery/earnings/index.md) · [Earnings ledger](./delivery/earnings/earnings-ledger.md)

### Shared
- [Shared flows](./shared/README.md) · [Auth & OTP](./shared/auth-otp.md)

### Audit
- [Known gaps and incomplete flows](./KNOWN_GAPS.md)

## Glossary

| Term | Meaning |
|---|---|
| SDUI | Server-driven UI. Gateway compiles a layout doc; the app renders ordered sections. |
| `@server` | Data originates from the gateway/Supabase/Mongo at runtime. |
| `@mock` / `@seed` / `@static` | Fixture/seed/static data, never the online origin (see `data/DATA_CONTROL.md`). |
| Offline shell | A labelled fallback shown only when the server gives no answer. |
| Portal JWT | Gateway-native HS256 token for `client/web/platform` and the seller app. |
| Firebase OTP | Phone OTP for customer and delivery apps (`@react-native-firebase/auth`). |

## Verification

Docs changes need no build, but code changes still follow the repo contract:

```bash
cd client/mobile
npm run ts:check
npm run check:boundaries
```

Never run Gradle locally — Android builds are CI-only (`AGENTS.md`).
