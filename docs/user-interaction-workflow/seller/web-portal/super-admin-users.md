# Super admin — users directory (find a customer by phone)

**App / route(s):** portal `/admin/super/users` (`app/admin/super/users/page.client.tsx`)
**Status:** Shipped
**Trigger:** A customer signs in to the app with their phone number (Firebase Phone OTP) and later
contacts support (or the super admin needs them for a payout/dispute). The super admin must find that
customer in the platform directory by phone number — even when the customer has never placed an order.

## Steps

1. The super admin opens **Platform → Users**. The page loads `GET /customers` — every provisioned
   `checkout.users` row across all districts with order count, spend, last order and join date, plus
   the customer's sign-in **phone**.
2. **Find the customer.** Type into the search box; the term is debounced 300 ms and sent as `q` to
   `GET /customers`. The gateway matches `q` against **phone, name and user id** in SQL, so a
   `Faazio User` row (the default provisioned name) with no spend is still found by phone.
3. Read the row: customer, phone, user id, state, orders, spend, last order, joined. The KPI strip
   totals users / orders / spend for the current result set.
4. **Answer / act** with the phone (support callback, order clarification). The page is read-only;
   order-level actions live on the super-admin orders board.

## State

- `useCustomers({ query, limit: 500 })` — a live server-filtered read of `GET /customers` (not the
  hydrated store slice), so the match spans the whole customer base rather than one page.
- Search state is page-local (`search` debounced 300 ms → `q`).

## Data path

- `fetchCustomers()` → `GET /customers?q=…&limit=…` → `admins/handler.go listCustomers` →
  `admins/repo.go Customers` → `checkout.users_admin` (a projection over `checkout.users` + their
  `checkout.orders`). Phone comes from `checkout.users.phone`, provisioned on first authenticated
  gateway call (`ProvisionUserID`) and forward-filled (never blanked) on later logins.
- Role scope: a `DISTRICT_ADMIN` is forced to its own `state_code` server-side (the `state` param
  cannot widen it); a `SUPER_ADMIN` sees every state.
- No caching — the directory is auth-scoped and join-heavy (see `caching-cloudflare-valkey.md` §8).

## Success / error / empty

- **Success:** the matched customer appears with phone, order count and spend.
- **Empty:** "No users found" — either no customer matches the name/phone/user id, or none have
  been provisioned yet.
- **Error:** a non-admin token gets `403 forbidden`; a transport failure shows the standard error
  state with retry. The page distinguishes an empty base directory from an empty search result.

## Known gaps

- The projection carries the customer's **account phone** (`checkout.users.phone`), not necessarily
  the phone on a specific delivery address (`checkout.addresses.phone`) — those differ for gift /
  alternate-contact orders.
- No customer drill-in from this page (activity trail is on the district customers page).

## Linked docs

- `docs/architecture/db-schema.md` §12.11 + §12.40 (users_admin projection, phone)
- `docs/architecture/monolith-breakdown.md` §1 (admins / `/customers`)
- [`super-admin-orders.md`](./super-admin-orders.md) (order-level customer lookup)
