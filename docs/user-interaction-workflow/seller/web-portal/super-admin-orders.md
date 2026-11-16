# Super admin — all orders (customer delivery lookup)

**App / route(s):** portal `/admin/super/orders` (`app/admin/super/orders/page.client.tsx`),
`/admin/super/orders/[id]` (`app/admin/super/orders/[id]/page.client.tsx`)
**Status:** Shipped
**Trigger:** A customer calls the super admin — "I placed an order, when will it be delivered?" — and
the super admin must find the order across all districts/states and read its status + delivery SLA.

## Steps

1. The super admin opens **Operations → All orders**. The page loads `GET /admin/orders` (every
   order across every district/state, newest first) with the real customer name + phone.
2. **Find the order.** Type into the search box (matches `q` against customer name, phone, order
   number and order id), pick a status chip (`ALL / NEW / PACKED / SHIPPED / DELIVERED / CANCELLED /
   RETURNED`), a state, or a seller id. Every filter is applied server-side — no district lock.
3. Read the row: order, customer, phone, city, state, seller, sector, items, value, placed,
   **SLA due**, status. The KPI strip shows total / open / out-for-delivery / delivered-today.
4. **Drill in** (tap the order number) → `/admin/super/orders/[id]` loads `GET /admin/orders/{id}`:
   customer + address context, line items, and the latest delivery job (rider name/phone, delivery
   status, payout mode, assigned at).
5. **Answer the customer** with the status and the SLA-due time (the page also shows hours left /
   overdue). If the customer needs a correction, the super admin can **Mark status** (choose a
   status, *Update status*) → `PUT /admin/orders/{id}/status`.
6. **Escalate** if needed via the district/super delivery board (manual allocation) — the super
   admin board is read + status override, not a dispatch console.

## State

- `useAdminOrders(filter)` — live server-filtered read of `GET /admin/orders` (status/state/q/
  seller filters). `useAdminOrder(id)` drives the drill-in.
- The hydrated `orders` store slice is also filled from `GET /admin/orders` for a super admin
  (`sync.ts`), so dashboards that read `useOrders()` stay correct.
- Filter state is page-local (`search` debounced 300 ms, `status`, `stateCode`, `sellerId`).

## Data path

- `fetchAdminOrders()` → `GET /admin/orders` → `checkout.orders` left-joined to
  `checkout.addresses` + `checkout.users` (customer name/phone), `directory.stores` +
  `sellers.sellers` (seller/state/district) and `admins.district_master` (district name as the city
  label). `AdminOrderRow` always returns real customer identity — never a `"Customer"` placeholder.
- `getAdminOrder()` → `GET /admin/orders/{id}` → the same join + `checkout.order_items`
  (`checkout.order_item_addons`) + the latest `delivery.delivery_orders` row joined to
  `delivery.delivery_boys` (rider).
- `updateAdminOrderStatus()` → `PUT /admin/orders/{id}/status` → `checkout.orders.status`
  (audited, `status_date` bumped; a `PACKED` write still honours the UPI payment gate — `409
  payment_pending`).
- Role isolation: `GET /seller/orders` is **SELLER-only**; `GET /admin/orders` +
  `GET /admin/orders/{id}` + `PUT /admin/orders/{id}/status` are **SUPER_ADMIN-only**; district
  admins read `GET /admin/district/orders` (SQL-scoped to the caller's district, query params can
  never widen it).

## Success / error / empty

- **Success:** the row (and drill-in) show status + SLA due; a status override toasts *Order marked
  …* and refetches.
- **Empty:** "No orders match" — shown when no order satisfies the current filters (or none exist).
- **Error:** a non-super token gets `403 forbidden` from the gateway (the endpoint is role-gated);
  a transport failure shows the page's error state with retry.

## Known gaps

- The delivery SLA is the board's **4-hour-from-placement** convention (there is no per-order
  `promised_at` column yet), not a per-seller promise.
- The super board is read + status override only — no rider assignment (that is the delivery
  manual-allocation board).
- `city` is the vendor's district name (`admins.district_master`); the checkout address has no
  structured city column.

## Linked docs

- `docs/architecture/monolith-breakdown.md` §1 (checkout / admin-orders endpoints)
- `docs/architecture/server-gateway-plan.md` (order endpoints)
- `docs/architecture/web-portal.md` (admin console routes)
- [`../orders/index.md`](../orders/index.md)
