# Seller journey tutorial (`/tutorial`)

**Surface:** landing page `/tutorial` (`client/web/landingpage/src/routes/tutorial.tsx`)
**Script:** `client/web/landingpage/src/lib/tutorials/seller-journey.ts`; the onboarding chapter
reuses `seller-onboarding.ts` unchanged.
**Screens:** `client/web/landingpage/src/components/tutorial/screens.tsx` (onboarding) and
`screens-journey.tsx` (post-onboarding).
**Status:** Shipped — illustrative only. One FAQ-style dropdown per chapter; opening a row plays
that chapter continuously, top to bottom, then stops with Replay. It never loops. The stage is
decorative (`aria-hidden`), the live caption under it carries the current step's text, and nothing
on the page submits.

This page is the audit map for the walkthrough: every animated action must correspond to a real
seller flow documented under `docs/user-interaction-workflow/seller/`. If a flow changes, update
this map and the script in the same change. Labels are copied, not imported, because the landing
page is a separate deploy.

Navigation: the walkthrough is a single-open accordion, one row per chapter. Opening a row starts
that chapter's player (it begins once the row is scrolled into view) and closes any other; each row
shows its chapter number, title, subtitle and step count. Playback is continuous — the chapter runs
top to bottom on its own and stops on its last screen with `Replay chapter`. There is no step list
and no step control: a row contains only the animated stage, a live caption (`Step n of N · title`)
and `Restart` / `Replay chapter`. Reduced-motion users see the first screen with the same replay
control plus `Next step`.

## Chapters

| # | Chapter | Steps | Primary docs |
|---|---|---|---|
| 1 | Apply to sell | 8 | [onboarding/index.md](./onboarding/index.md) |
| 2 | Set up your store | 5 | [store-setup.md](./onboarding/store-setup.md) |
| 3 | Add a product | 6 | [add-product.md](./catalog/add-product.md) |
| 4 | Maintain your catalog | 6 | [price-update.md](./catalog/price-update.md) · [product-trash.md](./catalog/product-trash.md) |
| 5 | Menus, offers and add-ons | 8 | [price-update.md](./catalog/price-update.md) · [offers.md](./catalog/offers.md) · [addons.md](./web-portal/addons.md) |
| 6 | Take and fulfil orders | 8 | [order-lifecycle.md](./orders/order-lifecycle.md) |
| 7 | Notifications | 4 | [notifications.md](./web-portal/notifications.md) |
| 8 | Payouts | 4 | [payouts-ledger.md](./orders/payouts-ledger.md) |
| 9 | Settings | 8 | [settings.md](./web-portal/settings.md) |
| 10 | The rest of the console | 11 | [seller-console.md](./web-portal/seller-console.md) · [accept-invite.md](./web-portal/accept-invite.md) |

## Step → action → route / endpoint

### 1. Apply to sell (mobile app)

The application is **one scrolling screen** in the customer app (`SellerRegistrationScreen`), so
the chapter keeps that screen mounted and moves through its sections in document order: Part 1
business account (identity, KYC, payout, contract, signature), Part 2 shops, then submit and the
Pending-review state.

| Step | Action | Flow |
|---|---|---|
| Open My Account and tap Sell with us | tap | `POST /sellers` entry (App/AccountView) |
| Add your business identity | type | business name, owner, PAN, optional GSTIN, address, contact |
| Add the payout account and passbook | type | bank fields + bank passbook capture (`media.assets`) |
| Pick the contract tier and accept the agreements | tap | `GET /sellers/contract-tiers`, clickwrap |
| Verify your phone — the digital signature | type | Firebase OTP (`otpVerified`) |
| Add each shop you sell from | tap | shop app, category, platform fee, licence, map pin |
| Submit for review | tap | `POST /sellers` → `PENDING_REVIEW` |
| Pending review | tap | `GET /sellers/me` review card; nothing is approved automatically |

### 2. Set up your store (portal `/seller/stores`, `/seller/onboarding`)

| Step | Action | Route / endpoint |
|---|---|---|
| Open Stores in the portal | tap | `GET /seller/stores` |
| Create a vendor | tap | `/seller/stores` → create form |
| Name, address and contact | type | `POST /seller/stores` |
| Add the shop's licence | type | FSSAI / drug licence fields on the same write |
| Save the store | tap | `POST /seller/stores`, then `PUT /seller/stores/{id}/live` |

### 3. Add a product (portal `/seller/products/new`)

| Step | Action | Route / endpoint |
|---|---|---|
| Choose the store | tap | store selector |
| Pick the category leaf | tap | `GET /categories?app=` (`taxonomy.categories`) |
| Confirm the GST bucket | tap | `GET /tax/categories` (`tax.tax_rates`) |
| Name, price and unit | type | create form |
| Add a photo | tap | `POST /media/upload-url` → `PUT` → `POST /media/confirm` |
| Save — it goes to review | tap | `POST /seller/products` → `PENDING_REVIEW` |

### 4. Maintain your catalog (portal `/seller/products/[id]/edit`, `/seller/pricing`, `/seller/inventory`, `/seller/products/trash`)

| Step | Action | Route / endpoint |
|---|---|---|
| Open a listing to edit | tap | `GET /seller/pricing` / `GET /seller/inventory` hydration |
| Fix the description | type | `PUT /seller/products/{id}` |
| Change the price | type | `PUT /seller/pricing/{productId}` |
| Set stock and ETA | type | `PUT /seller/inventory/{productId}` |
| Delete a listing | tap | `DELETE /seller/products/{id}?reason=…` (soft delete) |
| Restore it from Trash | tap | `GET /seller/products/trash` → `POST /seller/products/{id}/restore` |

### 5. Menus, offers and add-ons (portal `/seller/menus`, `/seller/offers`, `/seller/inventory`)

| Step | Action | Route / endpoint |
|---|---|---|
| Open a dish | tap | `GET /seller/menus` |
| Update price and MRP | type | `POST /seller/menus` / `PUT /seller/menus/{venueId}/{dishId}` |
| Pick the live campaign | tap | `GET /promo/campaigns` |
| Enter the discount | type | `GET /promo/optins`, `GET /promo/sector-caps` |
| Opt in | tap | `POST /seller/promotions/optin` → `PENDING` |
| Create an add-on | tap | `POST /seller/addons` → `DRAFT` |
| Link it to a dish | tap | `POST /seller/menu-addons` / `DELETE /seller/menu-addons/{venueId}/{dishId}/{addonId}` |
| Submit for review | tap | `POST /seller/addons/{addonId}/submit-for-review` |

### 6. Take and fulfil orders (portal `/seller/orders`, `/seller/orders/[id]`, `/seller/returns`)

| Step | Action | Route / endpoint |
|---|---|---|
| Open the order board | tap | `GET /seller/orders` |
| Open a new order | tap | `GET /seller/orders/{id}` |
| Accept the order | tap | `PUT /seller/orders/{id}/accept` → `PACKED` (409 when unpaid) |
| Show the pickup QR | tap | `GET /seller/orders/{id}/pickup-qr` |
| The rider scans it | scan | `POST /delivery/pickup/verify` (rider side) |
| Advance the status | tap | `PUT /orders/{id}/status` → `SHIPPED` → `DELIVERED` |
| Reject if you can't fulfil | tap | `PUT /seller/orders/{id}/reject` (refund + notify) |
| Handle a return | tap | `/seller/returns` (advances with the order) |

### 7. Notifications (portal `/seller/notifications`)

| Step | Action | Route / endpoint |
|---|---|---|
| Open the bell | tap | unread count in the console header |
| Open the newest alert | tap | `GET /notifications` (newest first) |
| Follow the deep link | tap | `POST /notifications/{id}/read` + payload deep link |
| Mark everything read | tap | `POST /notifications/read-all` |

### 8. Payouts (portal `/seller/payments`)

| Step | Action | Route / endpoint |
|---|---|---|
| Open Payments | tap | `GET /seller/payments` |
| Read the ledger | tap | `GET /settlements` / `GET /payouts` |
| Get the invoice | tap | `GET /seller/payout-invoices/{payoutId}` |
| Payouts are marked by hand | tap | `POST /admin/seller/payouts/{sellerId}/mark-paid` (admin; manual model) |

### 9. Settings (portal `/seller/settings`)

| Step | Action | Route / endpoint |
|---|---|---|
| Edit your profile | tap | `useSeller` hydrated from `GET /sellers` |
| Save the changes | tap | `PATCH /sellers/{id}` (changed fields only) |
| Add the payout account | tap | `GET`/`PUT /sellers/{id}/bank-account` |
| Choose your alerts | tap | `GET`/`PUT /seller/notifications/preferences` |
| Match the theme | tap | `localStorage["faazio.theme"]` (device-local) |
| Invite your team | tap | `GET /seller/sub-users` → `POST /seller/sub-users` |
| Copy the one-time link | tap | `/accept-invite?token=…` (7 days, single use) |
| Rotate your sign-in | tap | `PUT /auth/portal/email`, `PUT /auth/portal/password` |

### 10. The rest of the console (portal `/seller/*`)

| Step | Action | Route / endpoint |
|---|---|---|
| Work the daily checklist | tap | `/seller/hub` — **client-local** checklist |
| Find any surface in Explore | tap | `/seller/explore` navigation grid |
| Run an ad campaign | tap | `/seller/ads` → `GET/POST /ads/*` |
| Read your sales series | tap | `/seller/analytics` → `GET /analytics/series|ranks` |
| Read your reviews | tap | `/seller/reviews` → `GET /vendors/{id}/reviews*` |
| Open a prescription | tap | `/seller/prescriptions` → `GET /seller/prescriptions*`, quotes |
| Update outlet hours | type | `/seller/outlet-info` → `PUT /seller/stores/{id}` |
| Restaurant status — local today | tap | `/seller/restaurant-status` — **client-local** (no write) |
| Rush hour — local today | type | `/seller/rush-hour` — **client-local** (no write) |
| Support — local today | tap | `/seller/support` — **client-local** tickets |
| A teammate accepts the invite | tap | `/accept-invite` → `POST /seller/sub-users/accept` |

## Honesty rules

- Local-only surfaces (`hub` checklist, `restaurant-status`, `rush-hour`, `support`) are labelled
  in the step copy and described as client-local; the walkthrough never animates a fake save.
- The payout model is manual; the tutorial says an admin marks it paid.
- The invoice PDF may lag the JSON invoice.
- Reviews are read-only in the console today.

## Known gaps

See [`../KNOWN_GAPS.md`](../KNOWN_GAPS.md) (local-only seller surfaces, manual invite delivery,
`lowStock`/`campaigns` having no producer, invoice PDF lag).

## Linked docs

- [`README.md`](./README.md) — seller flow inventory
- [`onboarding/index.md`](./onboarding/index.md) — application + store setup
- `docs/architecture/web-portal.md`
- `docs/UI_DESIGN_SYSTEM.md` (motion + token contract used by the tutorial)
