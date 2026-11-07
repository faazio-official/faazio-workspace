# Delivery-fee quote

**App / route:** customer · `Cart` → `FULFILLMENT` / `PAYMENT` (`CartView.tsx`)
**Status:** Shipped
**Trigger:** Choosing **Delivery** and entering the FULFILLMENT or PAYMENT step with a live fix.

## Steps

1. The user chooses Delivery (vs Self-Pickup) and a saved/live address.
2. For each store in the cart, the app calls
   `gateway.fetchDeliveryFee(storeId, lat, lng)` (`GET /checkout/delivery-fee?storeId&lat&lng`).
3. A multi-store cart keeps the **furthest** (highest total) quote; settlement charges that same
   worst case.
4. The quote is reused on the PAYMENT step so the figure matches what the server will charge.
5. PICKUP skips the quote (fee = 0).

## State

- `useCartStore` — store ids / lines.
- `useLocationStore` — live drop fix.
- `CartView` local `deliveryFeeQuote` / `deliveryQuoteMissing`.

## Data path

- `gateway.fetchDeliveryFee` → `GET /checkout/delivery-fee` → `tax.delivery_fee_settings` +
  `directory.stores` pins + night/rain/festival surge (`contracts.SurgeReader`,
  `WeatherChecker`, `FestivalLookup`).
- Distance is Haversine over the store pin and the live drop fix; the result is persisted on
  `checkout.orders` so payout is a pass-through.
- If the read fails or there is no live fix, the UI uses the standard default fee constant and
  labels it an **estimate** — it never guesses distance against a bundled directory.

## Success / error / empty

- **Success:** server-confirmed fee shown; used at payment.
- **Error/no fix:** estimate flag; no fake "confirmed" fee.
- **Empty:** PICKUP shows no delivery fee.

## Known gaps

- None specific. Surge is fail-open by design at the experience boundary (weather outage waives
  surge, never fabricates it).

## Linked docs

- `docs/architecture/monolith-breakdown.md` (checkout/pricing rows)
- `docs/architecture/caching-cloudflare-valkey.md`
