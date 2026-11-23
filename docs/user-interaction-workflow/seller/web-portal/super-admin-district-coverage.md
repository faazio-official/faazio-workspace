# Super admin — district coverage (district master CRUD)

**App / route(s):** portal `/admin/super/districts` (`app/admin/super/districts/page.client.tsx`) and the
per-district drill-down `/admin/super/districts/[code]`
**Status:** Shipped
**Trigger:** SUPER_ADMIN opens **Governance → District coverage** in the Partner Portal.

## Steps

1. The page loads `GET /admin/districts` (every row, including deactivated, with
   `isActive`/`createdAt`/`updatedAt`). The table shows Code, District, State, **Available** (a live
   switch), Updated and row actions. A search box filters on code/name/state and a state dropdown
   filters server-side (`?state=TN`).
2. **Create:** *New district* opens a sheet — District code, District name, State/UT, Available.
   Save calls `POST /admin/districts`. The portal validates the code against
   `^[A-Z]{2}[A-Z0-9]$` before sending; the gateway repeats the check plus `admins.states` membership.
   A created district is immediately valid for seller onboarding and district scoping (the gateway
   reloads its `internal/platform/geo` mirror on the write), so no deploy is needed.
3. **Edit:** *Edit* prefills name, state and availability; the **code field is disabled** because
   `district_code` is the primary key that sellers, district admins and payouts reference. Save calls
   `PUT /admin/districts/{code}`.
4. **Toggle availability:** the row switch calls `PATCH /admin/districts/{code}/toggle` `{isActive}`.
   Off hides the district from the seller picker **and from the customer app's coverage gate**
   (`GET /geo/districts` filters `is_active`) while existing references keep resolving — the correct
   retirement for a district still in use. A customer whose origin matches a disabled district is
   sent to the app-level coverage page on the next check/foreground; re-enabling it lifts the gate
   after that check. See
   [`../../customer/onboarding/service-area-gate.md`](../../customer/onboarding/service-area-gate.md).
5. **Delete:** the trash button opens a confirmation. `DELETE /admin/districts/{code}` succeeds only
   when nothing references the district; FKs in `0047`/`0048`/`0055` are `ON DELETE RESTRICT`, so a
   district with sellers, admins or payouts returns `409 district_in_use` and the toast says to
   deactivate instead.
6. **Drill-down:** clicking a district code opens `/admin/super/districts/[code]` — the existing
   per-district view (GMV trend, admin roster, campaigns, sellers) with a jump-to-district selector
   that routes within the drill-down. It reads `GET /admin/districts` (not the picker read) so a
   **deactivated** district still resolves; its header shows an `INACTIVE` pill and says so.
7. Every write is audit-logged (`DISTRICT_CREATE`, `DISTRICT_UPDATE`, `DISTRICT_TOGGLE`,
   `DISTRICT_DELETE`) on `admins.district_master` via the shared `contracts.AuditWriter`.

## State

- `stateFilter` / `query` — the server state filter and the client search.
- `items`, `loading`, `error`, `reload` — `useAdminDistricts(stateFilter)` (refetched after each write).
- Sheet form state — code, name, state, availability.
- `deleting` — the row pending delete confirmation; `toggling` — the code whose switch is in flight.

## Data path

- `listAdminDistricts()` → `GET /admin/districts` → `admins.district_master` (all rows).
- `createDistrict()` → `POST /admin/districts` → insert (SUPER_ADMIN, audited) → `geo.Reload`.
- `updateDistrict()` → `PUT /admin/districts/{code}` → rename / re-state (code immutable).
- `toggleDistrict()` → `PATCH /admin/districts/{code}/toggle` → `is_active`.
- `deleteDistrict()` → `DELETE /admin/districts/{code}` → row delete, or `409 district_in_use`.
- The customer / seller-facing picker still reads `GET /geo/districts` (`is_active` only), so an
  edit reaches the apps on their next picker fetch — no cache to purge. The customer app's coverage
  check keeps a 60 s in-memory copy and forces a refresh on every foreground / the gate's
  "Check again".

## Success / error / empty

- **Success:** row persists; toast; the list refetches. A new district is valid for onboarding at once.
- **Duplicate code:** `409 conflict` → toast "a district with this code already exists".
- **Delete blocked:** `409 district_in_use` → toast "deactivate it instead".
- **Validation:** a malformed code/name or unknown state is a `400` from the gateway, and the portal
  blocks the obvious shape errors before the request.
- **Empty:** "No districts" with a prompt to create one (or clear the filter).

## Known gaps

- `GET /admin/districts` has no pagination; the master is ~42 rows and additive, so a full read is fine
  for now.
- `data/districts.ts` (mobile/web offline fixtures) is still a manual mirror of the DB — see
  `docs/user-interaction-workflow/KNOWN_GAPS.md`. The mobile pickers read the live
  `GET /geo/districts` through `GatewayClient`; the fixture is only the offline shell.

## Linked docs

- `docs/architecture/db-schema.md` §12.42
- `docs/architecture/monolith-breakdown.md` §1 (districts row) + §4 (district codes)
- `docs/architecture/web-portal.md` (super-admin route table)
- [`../onboarding/seller-lead-queue.md`](../onboarding/seller-lead-queue.md) (leads resolve against this master)
