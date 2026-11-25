# Super admin — users directory (find a customer by phone, district or pincode)

**App / route(s):** portal `/admin/super/users` (`app/admin/super/users/page.client.tsx`)
**Status:** Shipped
**Trigger:** A customer signs in to the app with their phone number (Firebase Phone OTP) and later
contacts support (or the super admin needs them for a payout/dispute). The super admin must find that
customer in the platform directory by phone / customer id / pincode, optionally narrowed to a state
and district — even when the customer has never placed an order.

## Steps

1. The super admin opens **Platform → Users**. The page loads one page of `GET /customers` — every
   provisioned `checkout.users` row with order count, spend, last order and join date, plus the
   customer's sign-in **phone**, **pincode**, **district** and stable **customer id**.
2. **Filter.** Pick a **state** (all states from `GET /geo/states`) and optionally a **district**
   (searchable dropdown over `GET /geo/districts`, scoped to the state). The server applies the
   filters; a district admin's token is additionally forced to its own state/district.
3. **Find the customer.** Type into the search box; the term is debounced 300 ms and sent as `q`.
   The gateway matches `q` against **phone, name, user id, customer code and pincode** in SQL, so a
   `Faazio User` row (the default provisioned name) with no spend is still found by phone or pincode.
4. **Page.** The table loads 50 rows at a time; the footer shows "Showing X–Y of N" with prev/next and
   page numbers. The KPI strip totals users / orders / spend for the whole filtered set (server
   totals, not the current page).
5. Read the row: customer, phone, user id, pincode, district, state, orders, spend, last order,
   joined. The page is read-only; order-level actions live on the super-admin orders board.

## The visible "User id"

The id shown is the customer's **`customer_code`**: `fa` + 6-digit pincode + last 10 phone digits,
e.g. `fa6000019876543210`. It is minted once by the gateway when the app reports a serviceable
location (`PUT /profile/location`). Until then the row shows its internal `user_id` with a small
"pending" marker — an existing account gets a code on its next app open. The internal `user_id` stays
the immutable FK key for orders/payments etc.; the code is never used for joins.

## State

- `useCustomers({ stateCode, districtCode, query, limit: 50, offset })` — a live server-filtered,
  page-scoped read of `GET /customers` (not the hydrated store slice).
- Search state is page-local (`search` debounced 300 ms → `q`); any filter/search change resets to
  page 1 and a state change clears the district.

## Data path

- `fetchCustomers()` → `GET /customers?state=…&district=…&q=…&limit=50&offset=…` →
  `admins/handler.go listCustomers` → `admins/repo.go Customers` → `checkout.users_admin`
  (a projection over `checkout.users` + their `checkout.orders`).
- Location fields come from the app's reverse geocode reported through `PUT /profile/location`
  (`internal/checkout`): the server validates the district against `admins.district_master`, derives
  the state, and stores `state_code`/`district_code`/`pincode` on `checkout.users` (0132).
- Role scope: a `DISTRICT_ADMIN` is forced to its own `state_code` (and `district_code` when the
  token carries one) server-side; a `SUPER_ADMIN` sees every state.
- No caching — the directory is auth-scoped and join-heavy (see `caching-cloudflare-valkey.md` §8).

## Success / error / empty

- **Success:** the matched/filtered customers appear with phone, pincode, district, order count and
  spend; totals reflect the full filtered set.
- **Empty:** "No users found" — no customer matches the search/filters, or none have been provisioned.
- **Error:** a non-admin token gets `403 forbidden`; a transport failure shows the standard error
  state with retry. The page distinguishes an empty base directory from an empty filtered result.

## Known gaps

- The projection carries the customer's **account phone** (`checkout.users.phone`), not necessarily
  the phone on a specific delivery address (`checkout.addresses.phone`) — those differ for gift /
  alternate-contact orders.
- A customer who never grants location / never reports a pincode keeps showing the internal id
  ("pending") until they do; there is no manual pincode entry on this page.
- No customer drill-in from this page (activity trail is on the district customers page).

## Linked docs

- `docs/architecture/db-schema.md` §12.40 + §12.47 (users_admin projection, phone, location/code)
- `docs/architecture/monolith-breakdown.md` §1 (admins `/customers`, checkout `/profile/location`)
- [`super-admin-orders.md`](./super-admin-orders.md) (order-level customer lookup)
