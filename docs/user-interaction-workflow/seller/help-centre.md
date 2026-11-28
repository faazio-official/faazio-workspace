# Seller help centre (`/help-centre`)

**Surface:** landing page `/help-centre` (`client/web/landingpage/src/routes/help-centre.tsx`); `/tutorial` 301-redirects here
**Script:** `client/web/landingpage/src/lib/tutorials/seller-journey.ts`; the onboarding chapter
reuses `seller-onboarding.ts` unchanged.
**Screens:** `client/web/landingpage/src/components/tutorial/screens.tsx` (onboarding) and
`screens-journey.tsx` (post-onboarding).
**Status:** Shipped — illustrative only. One FAQ-style dropdown per chapter; opening a row plays
that chapter continuously, top to bottom, then stops with Replay. It never loops. The stage is
decorative (`aria-hidden`), the live caption under it carries the current step's text plus the control it presses, and
nothing on the page submits.

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

One row per surface, not one row per group of surfaces: opening a chapter must
never tour unrelated pages. Chapters 1–22 mirror the flows documented under
`docs/user-interaction-workflow/seller/`; chapter 1 (the customer-app
application) reuses `seller-onboarding.ts` unchanged.

| # | Chapter | Steps | Screens | Primary docs |
|---|---|---|---|---|
| 1 | Apply to sell | 8 | app: account, registration, review | [onboarding/index.md](./onboarding/index.md) |
| 2 | Set up your store | 10 | store-login → store-orders → store-products → store-create → store → store-switcher | [store-setup.md](./onboarding/store-setup.md) |
| 3 | Add a product | 11 | catalog-list → catalog-add | [add-product.md](./catalog/add-product.md) |
| 4 | Maintain your catalog | 6 | catalog-list → catalog-edit → catalog-trash | [product-trash.md](./catalog/product-trash.md) |
| 5 | Reprice and restock | 2 | pricing, inventory | [price-update.md](./catalog/price-update.md) |
| 6 | Menus, offers and add-ons | 9 | menus, offers, addons | [offers.md](./catalog/offers.md) · [addons.md](./web-portal/addons.md) |
| 7 | Take and fulfil orders | 8 | orders-board → orders-detail → pickup-qr, returns | [order-lifecycle.md](./orders/order-lifecycle.md) |
| 8 | Print, search and reject | 6 | orders-detail, order-history, orders-reject | [order-lifecycle.md](./orders/order-lifecycle.md) |
| 9 | Notifications | 4 | hub → notifications | [notifications.md](./web-portal/notifications.md) |
| 10 | Payouts | 5 | payouts | [payouts-ledger.md](./orders/payouts-ledger.md) |
| 11 | Your business profile | 2 | settings (Profile) | [settings.md](./web-portal/settings.md) |
| 12 | Bank, alerts and appearance | 3 | settings (Bank, Notifications, Appearance) | [settings.md](./web-portal/settings.md) |
| 13 | Your team | 5 | settings (Sub-users) → accept-invite | [settings.md](./web-portal/settings.md) · [accept-invite.md](./web-portal/accept-invite.md) |
| 14 | Sign-in and security | 4 | settings (Security) | [settings.md](./web-portal/settings.md) |
| 15 | Run a hero campaign | 6 | ads → ads-wizard | [seller-console.md](./web-portal/seller-console.md) |
| 16 | Fill a prescription | 6 | prescriptions → rx-detail | [seller-console.md](./web-portal/seller-console.md) |
| 17 | Ask for a fee change | 6 | account → fee-change-request, fee-history | [fee-change-requests.md](./web-portal/fee-change-requests.md) |
| 18 | Home and analytics | 5 | hub, analytics | [seller-console.md](./web-portal/seller-console.md) |
| 19 | Reviews | 3 | reviews | [seller-console.md](./web-portal/seller-console.md) |
| 20 | Explore and the outlet card | 4 | explore, outlet-info | [seller-console.md](./web-portal/seller-console.md) |
| 21 | Outlet status, delivery and rush | 6 | restaurant-status, status-offline, rush-hour | [seller-console.md](./web-portal/seller-console.md) |
| 22 | Support | 2 | support | [seller-console.md](./web-portal/seller-console.md) |

121 steps across 22 rows (8 in the onboarding chapter, 113 in the console
chapters). Chapters 2–22 paint the portal's own pages, because the
seller app is a WebView over the portal: every step lands on the console element
it names, at the portal's mobile-web layout. A step's `target` must exist as a
`data-tour-target` on the screen it plays; `src/test/journey-targets.test.tsx`
renders every screen and fails the build if a target has no element, or if the
pressed control is not marked `data-active`.

## Step → action → route / endpoint

### 1. Apply to sell (mobile app)

The application is **one scrolling screen** in the customer app (`SellerRegistrationScreen`), so
the chapter keeps that screen mounted and moves through its sections in document order: Part 1
business account (identity, KYC, payout), Part 2 shops, then submit and the Pending-review state.
There is no signature or agreement step: submitting while signed in is the acceptance.

| Step | Action | Flow |
|---|---|---|
| Open My Account and tap Sell with us | tap | `POST /sellers` entry (App/AccountView) |
| Add your business identity | type | owner name, PAN, optional GSTIN, address, contact |
| Add the payout account and passbook | type | bank fields + bank passbook capture (`media.assets`) |
| Add each shop you sell from | tap | shop app, category, platform fee, licence, map pin |
| Submit for review | tap | `POST /sellers` → `PENDING_REVIEW` |
| Pending review | tap | `GET /sellers/me` review card; nothing is approved automatically |

### 2. Set up your store (portal `/login` → `/seller/orders` → `/seller/products` → `/seller/onboarding` → `/seller/stores`)

The chapter replays the real first-run path: the seller app is a WebView over the portal, so it
opens on `/login`; signing in lands on `/seller/orders`; Products → List a new product explains a
listing needs a shop; Create a shop opens `/seller/onboarding`; and the finished vendor appears in
`/seller/stores`, whose header carries `Add shop` for the next one.

| Step | Action | Route / endpoint |
|---|---|---|
| Open the Faazio Seller Partner app | tap | native shell → `/login` (portal sign-in) |
| Land on Orders | tap | `/seller/orders`, `GET /seller/orders` — the format: shop-name bar (the `StoreSwitcher` trigger, reading `Your shop` / `Seller console` until the first vendor exists) top left, `Online` chip beside it (a separate link to `/seller/restaurant-status`), then the empty `No new orders right now` board |
| Create your first shop | tap | `/seller/products/new` empty state → Create a shop |
| Open Add a vendor | tap | `/seller/onboarding` — "A vendor is one shop in one app" |
| Name, address and contact | type | `POST /seller/stores` — vendor name, app, state, address, phone, hours |
| Add the shop's licence | type | FSSAI (Food) / drug licence (Pharma) fields on the same write |
| Create the vendor | tap | `POST /seller/stores`, then flip it live from Stores with `PUT /seller/stores/{id}/live` |
| Your shop is in Stores | tap | `/seller/stores`, `GET /seller/stores` — one card per vendor with its live switch, veg mark and opening hours |
| Add another shop | tap | `Add shop` in the Stores header → `/seller/onboarding` |
| Switch between your shops | tap | the shop-name bar top left of the console header (the `StoreSwitcher` trigger — not the `Online` chip beside it) opens the switcher; picking a shop re-scopes products, orders and payouts |

### 3. Add a product (portal `/seller/products` → `/seller/products/new`)

The wizard is five steps — `Category → Details → Pricing → Inventory → Review` — and the header
carries `Step n of 5`; the fixed bar reads `Continue` until the last step, then `Submit for review`.

| Step | Action | Route / endpoint |
|---|---|---|
| Open Products and tap Add | tap | `GET /seller/products` (search + `ALL/MART/FOOD/PHARMA` filters) |
| Step 1 · choose the store | tap | store selector — a listing belongs to one store |
| Pick the category leaf | tap | `GET /categories?app=` (`taxonomy.categories`) |
| GST rate (automatic) | — | the leaf's own `tax.category_gst_rates` rate; shown as `GST n%` on the picker, never picked separately |
| Step 2 · name, description and unit | type | create form |
| Add a photo | tap | `POST /media/upload-url` → `PUT` → `POST /media/confirm` |
| Step 3 · set the selling price | type | GST-inclusive price; card previews GST, commission, TCS 1%, TDS 0.1% |
| Step 4 · stock quantity | type | quantity + platform-owned 30-minute ETA |
| Step 5 · review the listing | tap | review block, status `PENDING_REVIEW` |
| Submit for review | tap | `POST /seller/products` → `PENDING_REVIEW` |
| It waits in the list as Pending review | tap | back on `/seller/products` with the `PENDING REVIEW` pill |

### 4. Maintain your catalog (portal `/seller/products/[id]/edit`, `/seller/products/trash`)

| Step | Action | Route / endpoint |
|---|---|---|
| Open a listing (`Amul butter 500 g`) | tap | row in `/seller/products` → `/seller/products/{id}/edit` |
| Fix the description | type | photos, name, description and price save together |
| Save changes | tap | `PUT /seller/products/{id}` |
| Delete | tap | `DELETE /seller/products/{id}?reason=…` (soft delete, audit-logged) |
| Delete — confirm | tap | confirm sheet: hidden now, restorable 7 days |
| Restore listing | tap | `GET /seller/products/trash` → `POST /seller/products/{id}/restore` |

### 5. Reprice and restock (portal `/seller/pricing`, `/seller/inventory`)

| Step | Action | Route / endpoint |
|---|---|---|
| Mass cut % | type | `PUT /seller/pricing/{productId}`; the header's mass `%` applies to every listing |
| Restock (`Basmati rice 5 kg`) | tap | `PUT /seller/inventory/{productId}` (10 units, platform-owned 30-minute ETA) |

### 6. Menus, offers and add-ons (portal `/seller/menus`, `/seller/offers`, `/seller/inventory`)

| Step | Action | Route / endpoint |
|---|---|---|
| Add dish | tap | `GET /seller/menus`, `POST /seller/menus` (editor sheet) |
| Open a dish (`Chicken biryani`) | tap | row card with Submit / Delist / Edit |
| MRP | type | `PUT /seller/menus/{venueId}/{dishId}`; MRP below price is rejected |
| Pick the live campaign (`Pongal festival`) | tap | `GET /promo/campaigns` + `GET /promo/sector-caps` |
| Your discount (%) | type | whole percent inside the sector cap |
| Opt in | tap | `POST /seller/promotions/optin` → `PENDING` |
| Create an add-on | tap | `POST /seller/addons` → `DRAFT` |
| Add add-on to a dish | tap | `POST /seller/menu-addons` / `DELETE /seller/menu-addons/{venueId}/{dishId}/{addonId}` |
| Submit for review | tap | `POST /seller/addons/{addonId}/submit-for-review` |

### 7. Take and fulfil orders (portal `/seller/orders`, `/seller/orders/[id]`, `/seller/returns`)

The board's tabs read `Preparing / Ready / Out for delivery / Delivered` for a Food shop and
`New / Packed / Shipped / Delivered` elsewhere, with counts on each tab.

| Step | Action | Route / endpoint |
|---|---|---|
| The `Preparing` tab | tap | `GET /seller/orders` — status tabs with counts |
| Open `#FAZ10428` | tap | order card → `GET /seller/orders/{id}` |
| Accept order | tap | `PUT /seller/orders/{id}/accept` → `PACKED` (409 when unpaid) |
| Pickup QR | tap | `GET /seller/orders/{id}/pickup-qr` (sheet on a packed card) |
| Scan the QR at pickup | scan | `POST /delivery/pickup/verify` (rider side) |
| Mark delivered | tap | `PUT /orders/{id}/status` → `SHIPPED` → `DELIVERED` |
| Reject | tap | `PUT /seller/orders/{id}/reject` (reason per sector, refund + notify) |
| Handle a return (`Reject`) | tap | `/seller/returns` — approve or reject the return; the refund is drawn from the next settlement |

### 8. Print, search and reject (portal `/seller/orders/[id]`, `/seller/order-history`, `/seller/orders`)

| Step | Action | Route / endpoint |
|---|---|---|
| Print KOT | tap | the order header's printer; labels `Print KOT` for Food, `Print` otherwise — prints only, never changes status |
| Search by order ID | type | `GET /seller/orders`, filtered on order id or customer name (digits matched) |
| Last 7 days | tap | range bar → `Select date range` sheet |
| Last 30 days | tap | `Last 7 days` / `Last 30 days` / `All time`; the list re-filters, empty says `No orders found in this range` |
| Items out of stock | tap | reject sheet — the sector's reason list (`Kitchen is full`, `Restaurant closing soon`, `Customer requested`, `Other` for Food) |
| Reject order | tap | `PUT /seller/orders/{id}/reject` — `CANCELLED`, refund, notify customer and rider |

### 9. Notifications (portal `/seller/notifications`)

| Step | Action | Route / endpoint |
|---|---|---|
| Bell | tap | the bell in the console header → `/seller/notifications` |
| Open `#FAZ10429` | tap | `GET /notifications` (newest first) |
| Follow `Basmati rice 5 kg was approved` | tap | `POST /notifications/{id}/read` + payload deep link |
| Mark all read | tap | `POST /notifications/read-all` |

### 10. Payouts (portal `/seller/payments`)

| Step | Action | Route / endpoint |
|---|---|---|
| Payouts tab | tap | `GET /seller/payments` — `Payouts` / `Invoices & Taxes` |
| Gross order value | tap | `GET /settlements` / `GET /payouts` — GVO, commission, GST, TCS 1%, TDS 0.1%, net |
| Get report | tap | the cycle picker; `SCHEDULED / PAID / ON_HOLD / PARTIAL` |
| Payout invoice | tap | `GET /seller/payout-invoices/{payoutId}` (seller-scoped JSON) |
| Paid | tap | `POST /admin/seller/payouts/{sellerId}/mark-paid` (admin; manual model) |

### 11. Your business profile (portal `/seller/settings`)

| Step | Action | Route / endpoint |
|---|---|---|
| Profile | tap | `useSeller` hydrated from `GET /sellers` |
| Save changes | tap | `PATCH /sellers/{id}` (changed fields only) |

### 12. Bank, alerts and appearance (portal `/seller/settings`)

| Step | Action | Route / endpoint |
|---|---|---|
| Bank | tap | `GET`/`PUT /sellers/{id}/bank-account` |
| Notifications | tap | `GET`/`PUT /seller/notifications/preferences` |
| Appearance | tap | `localStorage["faazio.theme"]` (device-local) |

### 13. Your team (portal `/seller/settings`, `/accept-invite`)

| Step | Action | Route / endpoint |
|---|---|---|
| Sub-users | tap | `GET /seller/sub-users` |
| Create invite link | tap | `POST /seller/sub-users` → one-time link |
| New link | tap | `POST /seller/sub-users/{id}/resend` (rotates the link) |
| Remove | tap | `DELETE /seller/sub-users/{id}` |
| Set password & activate | tap | `/accept-invite?token=…` → `POST /seller/sub-users/accept` (7 days, single use) |

### 14. Sign-in and security (portal `/seller/settings`)

| Step | Action | Route / endpoint |
|---|---|---|
| Security | tap | the Security tab |
| Change email | tap | sheet: new email + current password |
| Save email | tap | `PUT /auth/portal/email` (other sessions signed out) |
| Change password | tap | `PUT /auth/portal/password` (re-authenticates first) |

### 15. Run a hero campaign (portal `/seller/ads` → `/seller/ads/new`)

The wizard is one five-step form — `What → Where → Creative → When → Review` — and the bar reads
`Next` until the last step, then `Publish now`.

| Step | Action | Route / endpoint |
|---|---|---|
| New hero campaign | tap | `GET /ads` — impressions, clicks, CTR, attributed orders |
| Products | tap | the target tab (`Products` / `Dishes` / `Stores`), then one of your own items |
| Home hero | tap | a placement slot; the list is filtered by the target |
| Title (max 40) | type | 40-char title, 60-char subtitle, 16:9 poster uploaded to Faazio, one CTA |
| Starts | tap | start and end date (end defaults to +30, max 90) |
| Publish now | tap | `POST /ads` — machine-checked (owner, fit, poster, length, caps), goes live instantly |

### 16. Fill a prescription (portal `/seller/prescriptions`)

| Step | Action | Route / endpoint |
|---|---|---|
| Open `RX-88214` | tap | `GET /seller/prescriptions` — only requests routed to this store |
| View images | tap | `POST /seller/prescriptions/{id}/images` (short-lived private URLs) |
| Item name | type | quote builder rows (name, qty, MRP, price, discount); up to 50 |
| Save quote | tap | `PUT /seller/prescriptions/{id}/quote` → `QUOTED`; refuses an empty quote |
| Mark READY | tap | disabled until the total is above zero; surfaces the quote to the customer |
| PII revealed (audited) | tap | contact details appear only at `READY`/`FULFILLED`; the reveal is stamped and audit-logged |

### 17. Ask for a fee change (portal `/seller/fee-change-request` → `/sellers/{id}/platform-fee-request`)

| Step | Action | Route / endpoint |
|---|---|---|
| Platform fee | tap | Account → Platform fee (portal sidebar, Explore, or the Stores row link); the seller app reaches the same page through its WebView |
| Vendor store | tap | the shop that needs a new rate — the fee is per shop, not per account (`GET /seller/stores`) |
| Current fee | read | the selected store's `platformFeePct`, read from the record |
| Requested fee % | type | one whole percent between 1 and 100, ≥ 5 for a Food shop, and different from the current fee |
| Why (optional) | type | up to 500 characters, stored as `seller_note` and shown to the reviewer under the shop name |
| Submit request | tap | `POST /sellers/{id}/platform-fee-request` `{storeId, platformFeePct, reason}` → `PENDING`; one pending per shop |
| Fee history | tap | `/seller/fee-history` → `GET /sellers/{id}/platform-fee-requests` — `old% → requested%` with the seller's own note and status; an admin approves on `FeeChangeRequestsBoard` |

> The reason is optional (`seller_note`, `0106`); omission sends an empty string, never a fabricated note.

### 18. Home and analytics (portal `/seller/hub`, `/seller/analytics`)

| Step | Action | Route / endpoint |
|---|---|---|
| Sales tab | tap | five tabs: `My Feed / Sales / Funnel / Service quality / Kitchen` (`Operations` for non-food) |
| Last 30 days | tap | the range bar — the period and what it compares against |
| Setup checklist | tap | `/seller/hub` — **client-local** checklist |
| GMV (7d) | tap | `/seller/analytics` → `GET /analytics/series|ranks` |
| 30d | tap | the `7d / 30d / 90d` pills re-query the whole page |

### 19. Reviews (portal `/seller/reviews`)

| Step | Action | Route / endpoint |
|---|---|---|
| Open a review (`A. Kumar`) | tap | `GET /vendors/{id}/reviews*`; five star pills filter by rating |
| Reply | tap | `POST /vendors/{id}/reviews/{reviewId}/reply` — published publicly |
| Flag to admin | tap | `POST /vendors/{id}/reviews/{reviewId}/flag` — sends it to moderation; never deletes |

### 20. Explore and the outlet card (portal `/seller/explore`, `/seller/outlet-info`)

| Step | Action | Route / endpoint |
|---|---|---|
| Catalog grid | tap | `/seller/explore` navigation grid, filtered to the shop's sector |
| Search | tap | the magnifier searches the surface list |
| Sign out | tap | ends the portal session → `/login` |
| Opening hours | tap | `/seller/outlet-info` — read-only hours, delivery time, phone; edits go through Stores |

### 21. Outlet status, delivery and rush (portal `/seller/restaurant-status`, `/seller/rush-hour`)

| Step | Action | Route / endpoint |
|---|---|---|
| Delivery status | tap | the outlet switch — turning it off opens the reason sheet first |
| Kitchen is full | tap | sector reasons (`Staff shortage`, `Closing early today`, `Technical issue`, `Other`; non-food swaps in `Inventory unavailable`) |
| Go offline | tap | stops new orders — **client-local** in this release |
| Edit | tap | delivery settings: minimum order, packaging charge, delivery radius — **client-local** |
| 30 minutes | type | rush window: 30 min / 1 h / 2 h / 3 h |
| Confirm | tap | turns rush mode on — **client-local**; the Explore tile shows ON |

### 22. Support (portal `/seller/support`)

| Step | Action | Route / endpoint |
|---|---|---|
| Subject | type | subject ≥ 4 characters and body ≥ 8 unlock the submit |
| Submit ticket | tap | adds to `My tickets` — **client-local** tickets in this release |

## Honesty rules

- Local-only surfaces (`hub` checklist, `restaurant-status`, delivery settings, `rush-hour`,
  `support` tickets) are labelled in the step copy and described as client-local; the walkthrough
  never animates a fake save.
- The payout model is manual; the help centre says an admin marks it paid.
- The invoice PDF may lag the JSON invoice.
- A review can be answered publicly or flagged to an admin for moderation; it cannot be deleted.
- A platform-fee request is a request: only an admin approval rewrites the store's fee.

## Known gaps

See [`../KNOWN_GAPS.md`](../KNOWN_GAPS.md) (local-only seller surfaces, manual invite delivery,
`lowStock`/`campaigns` having no producer, invoice PDF lag).

## Linked docs

- [`README.md`](./README.md) — seller flow inventory
- [`onboarding/index.md`](./onboarding/index.md) — application + store setup
- `docs/architecture/web-portal.md`
- `docs/UI_DESIGN_SYSTEM.md` (motion + token contract used by the walkthrough)
