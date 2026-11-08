# Order feedback

**App / route:** customer · `OrderDetails` (`features/profile/OrderDetailsScreen.tsx`) →
`OrderFeedback` (`features/profile/OrderFeedbackScreen.tsx`)
**Status:** Shipped
**Trigger:** "Share feedback" on the `OrderDetails` "Rate your order" card, shown only for a
delivered order.

## Steps

1. `OrderDetails` resolves the order from `useOrdersStore.getOrderById` and renders the "Rate your
   order" card when `order.status === 'Delivered'`.
2. Tapping "Share feedback" pushes the root `OrderFeedback` route with `{ orderId }`.
3. The screen marks the order ineligible (and shows a "Delivered orders only" card) when the known
   order is not delivered; the server re-checks on write, so deep links cannot bypass the gate.
4. On open, it reads the caller's existing feedback (`GET /orders/{id}/feedback`) and pre-fills the
   stars/comment when one exists.
5. The buyer picks 1–5 stars and an optional comment (≤ 280 chars) and submits.
6. `PUT /orders/{id}/feedback` upserts one feedback row per order (latest wins). On `synced` the
   toast reads "Feedback saved" and the screen pops after ~800 ms; other outcomes show an inline
   message.

## State

- `useOrdersStore` — supplies the order (status, vendor label) used for display and the local gate.
- Local screen state for rating/comment/error.

## Data path

- `gateway.getOrderFeedback(orderId)` → `GET /orders/{id}/feedback` → `reviews.order_feedback`.
- `gateway.submitOrderFeedback(orderId, rating, comment)` → `PUT /orders/{id}/feedback` →
  `reviews.order_feedback` (primary key `order_id`; upsert).
- Eligibility is derived, never stored: `checkout.orders` must belong to the caller and have
  `status = 'Delivered'` (`OrderDeliveredProof`).
- No cache key; the read is caller-scoped and cheap.

## Success / error / empty

- **Success:** the feedback row is durable and re-opening the screen shows it pre-filled.
- **Error:** inline message for `not-verified` (order not delivered / not owned), `signed-out`, or
  `offline`; nothing is written locally on failure (unlike the vendor rating's offline store).
- **Empty:** an order with no feedback pre-fills with zero stars and a "Submit feedback" CTA.

## Known gaps

- None specific.

## Linked docs

- `docs/architecture/mobile-app.md` (Vendor ratings & reviews → reviews context)
- `docs/architecture/monolith-breakdown.md` (reviews row)
- `docs/architecture/db-schema.md` §7.6
