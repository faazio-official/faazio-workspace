# Seller workflows — inventory

Every seller workflow Faazio ships today, in one table, with where it runs and the
authoritative doc. This is an index, not a second source of truth: the canonical
end-to-end flow for each row lives in `docs/user-interaction-workflow/seller/`,
and the animated walkthrough that mirrors these rows is
`docs/user-interaction-workflow/seller/help-centre.md`
(landing page `/help-centre`).

The seller app is a **WebView over the partner portal**, so a "mobile" row and its
portal row are the same code path; only the entry point differs.

## Where each workflow runs

| Surface | Code |
|---|---|
| Seller portal (shipped console) | `client/web/platform/app/seller/*` |
| Seller app (Android; WebView shell) | `client/mobile/src/features/seller-partner/` → portal |
| Seller-onboarding screens in the customer app | `client/mobile/src/features/seller-onboarding/` |
| Gateway (writes + reads) | `server/gateway/internal/sellers/*` |

## Inventory

| # | Workflow | Entry | Writes | Doc |
|---|---|---|---|---|
| 1 | Apply to sell | Customer app → My Account → Sell with us | `POST /sellers` → `PENDING_REVIEW` | [onboarding/index.md](docs/user-interaction-workflow/seller/onboarding/index.md) |
| 2 | Admin reviews the application | Admin → seller requests | `POST /seller/requests/{id}/verify`, `…/reject` | [onboarding/index.md](docs/user-interaction-workflow/seller/onboarding/index.md) |
| 3 | Create a shop / vendor | Portal → Stores → `Add shop` (`/seller/onboarding`) | `POST /seller/stores` | [store-setup.md](docs/user-interaction-workflow/seller/onboarding/store-setup.md) |
| 4 | Take a shop live | Portal → Stores card → `Live` switch | `PUT /seller/stores/{id}/live` | [store-setup.md](docs/user-interaction-workflow/seller/onboarding/store-setup.md) |
| 5 | Add a product | Portal → Products → `Add` (5-step wizard) | `POST /seller/products` | [add-product.md](docs/user-interaction-workflow/seller/catalog/add-product.md) |
| 6 | Edit or delete a listing | Portal → Products → row / `Delete` | `PUT`/`DELETE /seller/products/{id}` | [product-trash.md](docs/user-interaction-workflow/seller/catalog/product-trash.md) |
| 7 | Restore from Trash | Portal → Products → Trash → `Restore listing` | `POST /seller/products/{id}/restore` | [product-trash.md](docs/user-interaction-workflow/seller/catalog/product-trash.md) |
| 8 | Reprice (single or mass %) | Portal → Pricing | `PUT /seller/pricing/{productId}` | [price-update.md](docs/user-interaction-workflow/seller/catalog/price-update.md) |
| 9 | Restock / set ETA | Portal → Inventory | `PUT /seller/inventory/{productId}` | [price-update.md](docs/user-interaction-workflow/seller/catalog/price-update.md) |
| 10 | Menus — add, price, delist | Portal → Menu | `POST`/`PUT /seller/menus` | [offers.md](docs/user-interaction-workflow/seller/catalog/offers.md) |
| 11 | Offers / festival opt-in | Portal → Offers & Promotions | `POST /seller/promotions/optin` | [offers.md](docs/user-interaction-workflow/seller/catalog/offers.md) |
| 12 | Add-ons — create, link, submit | Portal → Inventory → Add-ons | `POST /seller/addons`, `/seller/menu-addons` | [addons.md](docs/user-interaction-workflow/seller/web-portal/addons.md) |
| 13 | Accept an order | Portal → Orders → `Accept order` | `PUT /seller/orders/{id}/accept` | [order-lifecycle.md](docs/user-interaction-workflow/seller/orders/order-lifecycle.md) |
| 14 | Reject an order (sector reason) | Portal → Orders → `Reject` | `PUT /seller/orders/{id}/reject` | [order-lifecycle.md](docs/user-interaction-workflow/seller/orders/order-lifecycle.md) |
| 15 | Pickup QR handover | Portal → Orders → `Pickup QR` | `GET /seller/orders/{id}/pickup-qr`; `POST /delivery/pickup/verify` | [order-lifecycle.md](docs/user-interaction-workflow/seller/orders/order-lifecycle.md) |
| 16 | Mark delivered | Portal → Order → `Mark delivered` | `PUT /orders/{id}/status` | [order-lifecycle.md](docs/user-interaction-workflow/seller/orders/order-lifecycle.md) |
| 17 | Print the kitchen ticket | Portal → Order → `Print KOT` / `Print` | — (print only) | [order-lifecycle.md](docs/user-interaction-workflow/seller/orders/order-lifecycle.md) |
| 18 | Search order history | Portal → Order history | `GET /seller/orders` (filtered) | [order-lifecycle.md](docs/user-interaction-workflow/seller/orders/order-lifecycle.md) |
| 19 | Returns — approve / reject | Portal → Returns | `PUT /seller/returns/{id}` | [order-lifecycle.md](docs/user-interaction-workflow/seller/orders/order-lifecycle.md) |
| 20 | Notifications + deep links | Portal header bell | `POST /notifications/{id}/read`, `/read-all` | [notifications.md](docs/user-interaction-workflow/seller/web-portal/notifications.md) |
| 21 | Payouts ledger + invoices | Portal → Payments | `GET /settlements`, `/payouts`, `/seller/payout-invoices/{id}` | [payouts-ledger.md](docs/user-interaction-workflow/seller/orders/payouts-ledger.md) |
| 22 | Business profile | Portal → Settings → Profile | `PATCH /sellers/{id}` | [settings.md](docs/user-interaction-workflow/seller/web-portal/settings.md) |
| 23 | Bank account | Portal → Settings → Bank | `PUT /sellers/{id}/bank-account` | [settings.md](docs/user-interaction-workflow/seller/web-portal/settings.md) |
| 24 | Notification preferences | Portal → Settings → Notifications | `PUT /seller/notifications/preferences` | [settings.md](docs/user-interaction-workflow/seller/web-portal/settings.md) |
| 25 | Theme | Portal → Settings → Appearance | device-local | [settings.md](docs/user-interaction-workflow/seller/web-portal/settings.md) |
| 26 | Invite a sub-user | Portal → Settings → Sub-users | `POST /seller/sub-users` | [settings.md](docs/user-interaction-workflow/seller/web-portal/settings.md) |
| 27 | Accept an invite | `/accept-invite?token=…` | `POST /seller/sub-users/accept` | [accept-invite.md](docs/user-interaction-workflow/seller/web-portal/accept-invite.md) |
| 28 | Change email / password | Portal → Settings → Security | `PUT /auth/portal/email`, `/password` | [settings.md](docs/user-interaction-workflow/seller/web-portal/settings.md) |
| 29 | Run an ad campaign | Portal → Ads → `New hero campaign` | `POST /ads` | [seller-console.md](docs/user-interaction-workflow/seller/web-portal/seller-console.md) |
| 30 | Fill a prescription | Portal → Prescriptions | `PUT /seller/prescriptions/{id}/quote`, status | [seller-console.md](docs/user-interaction-workflow/seller/web-portal/seller-console.md) |
| 31 | Ask for a platform-fee change | Portal → Account → Platform fee (`/seller/fee-change-request`), or `/seller/fee-history` to review | `POST /sellers/{id}/platform-fee-request` → `PENDING` | [fee-change-requests.md](docs/user-interaction-workflow/seller/web-portal/fee-change-requests.md) |
| 32 | Approve a fee change | Admin → Fee change requests board | `PATCH /seller/fee-change-requests/{id}/approve` or `…/reject` | [fee-change-requests.md](docs/user-interaction-workflow/seller/web-portal/fee-change-requests.md) |
| 33 | Home, tabs and range | Portal → Home | reads only | [seller-console.md](docs/user-interaction-workflow/seller/web-portal/seller-console.md) |
| 34 | Analytics | Portal → Analytics | `GET /analytics/series|ranks` | [seller-console.md](docs/user-interaction-workflow/seller/web-portal/seller-console.md) |
| 35 | Answer or flag a review | Portal → Reviews | `POST /vendors/{id}/reviews/{id}/reply`, `…/flag` | [seller-console.md](docs/user-interaction-workflow/seller/web-portal/seller-console.md) |
| 36 | Explore + sign out | Portal → Explore | session end | [seller-console.md](docs/user-interaction-workflow/seller/web-portal/seller-console.md) |
| 37 | Outlet profile (read-only) | Portal → Outlet info | reads only | [seller-console.md](docs/user-interaction-workflow/seller/web-portal/seller-console.md) |
| 38 | Go offline with a reason | Portal → Restaurant/Store status | client-local today | [seller-console.md](docs/user-interaction-workflow/seller/web-portal/seller-console.md) |
| 39 | Delivery settings | Portal → Status → Delivery settings | client-local today | [seller-console.md](docs/user-interaction-workflow/seller/web-portal/seller-console.md) |
| 40 | Rush mode | Portal → Rush in kitchen | client-local today | [seller-console.md](docs/user-interaction-workflow/seller/web-portal/seller-console.md) |
| 41 | Support ticket | Portal → Support | client-local today | [seller-console.md](docs/user-interaction-workflow/seller/web-portal/seller-console.md) |

## Gap analysis (as of this revision)

- **Admin-side flows are real but not animated**: application review (`SellerRequestsScreen`,
  `SellerRequestDetailScreen`: KYC verify, verify & activate, reject with reason, per-vendor fee
  edit) and the fee-change board (`FeeChangeRequestsBoard`). The help centre documents the
  seller side and names the board; the admin console is out of scope for the walkthrough.
- **Client-local surfaces** still have no write: Home's setup checklist, outlet status + offline
  reason, delivery settings, rush mode, support tickets. They are labelled as local in the step
  copy and listed in `docs/user-interaction-workflow/KNOWN_GAPS.md`.
- **Manual payout marking** — an admin marks a payout paid; nothing on the seller side triggers it.
- **Fee change is request-only** — one pending request per store; approval is the only write.

## Click-target spec for the animations

Each animated step names the exact control it presses (`control` in
`client/web/landingpage/src/lib/tutorials/seller-journey.ts`), and the stage finds that control by
`data-tour-target`. The renderer enforces this: `src/test/journey-targets.test.tsx` renders every
screen once per step's active target and fails if the target is missing, or if the pressed control
is not marked `data-active`.

| Element | Rule |
|---|---|
| `step.target` | must exist as `data-tour-target="<target>"` in the matching screen |
| `step.control` | the exact visible label pressed; shown in the on-stage callout and the live caption |
| `data-active` | set on the pressed control so the ring, the callout and the highlighted style agree |
| cursor glyph | derived from `step.action`: hand (tap), caret (type), scan frame (scan), swipe |
| dwell | `holdMs` between 1200 and 3000 |

Adding a step without its screen hook fails the test suite; that is deliberate, so the script can
never outrun the UI.
