# Super admin — district coverage (district master CRUD)

**App / route(s):** portal `/admin/super/districts` (`app/admin/super/districts/page.client.tsx`) and the
per-district drill-down `/admin/super/districts/[code]`
**Status:** Shipped — live list + **Deleted** trash, 7-day restore, permanent delete.
**Trigger:** SUPER_ADMIN opens **Governance → District coverage** in the Partner Portal.

## Steps

1. The page loads `GET /admin/districts` (every row, including deactivated, with
   `isActive`/`createdAt`/`updatedAt`). The table shows Code, District, State, **Available** (a live
   switch), Updated and row actions. A search box filters on code/name/state and a state dropdown
   filters server-side (`?state=TN`).
2. **Create:** *New district* opens a sheet — District code, District name, State/UT, Available.
   Save calls `POST /admin/districts`. The portal validates the code against
   `^[A-Z]{2}[A-Z0-9]{1,3}$` before sending; the gateway repeats the check plus `admins.states`
   membership. The 1–3 trailing chars accept large states' codes (`UP01`…`UP75`); the master shipped
   with all 36 states/UTs seeded (`0127`), so most districts already exist and only need enabling.
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
5. **Delete (soft, 7-day trash):** the trash button opens a confirmation with an optional reason.
   `DELETE /admin/districts/{code}?reason=` sets `deleted_at`/`delete_reason` and `is_active = false`:
   the district leaves the picker, the live list and the geo mirror immediately, but stays a valid FK
   target. It is restorable for **7 days**, after which the hourly `districts.Purger` (and the
   optional `admins.purge_deleted_districts` pg_cron function) removes it for good. The row reports
   **`inUse`** (a seller, district admin, portal login or delivery order still references it); those
   rows show **no Delete button** at all — the correct retirement is the availability switch
   (deactivate). The gateway also refuses with `409 district_in_use` as a backstop.
6. **Deleted filter + restore + delete forever:** the **Deleted · N** chip switches the table to
   `GET /admin/districts/trash` (newest deletion first, `deletedAt`/`purgeAt`). Each row offers
   **Restore** (`POST /admin/districts/{code}/restore` — comes back deactivated, re-enable it with the
   switch) and **Delete forever** (`DELETE /admin/districts/{code}/permanent` — hard delete now,
   refused `409 district_in_use`). Rows can be selected for a bulk **Delete forever**. A restore after
   the window is `410 trash_expired` and the row drops from the list.
7. **Drill-down:** clicking a live district code opens `/admin/super/districts/[code]` — the existing
   per-district view (GMV trend, admin roster, campaigns, sellers) with a jump-to-district selector
   that routes within the drill-down. It reads `GET /admin/districts` (not the picker read) so a
   **deactivated** district still resolves; its header shows an `INACTIVE` pill and says so. Its
   **Assign admin** button (also shown as the empty-roster CTA) opens the shared
   `DistrictAdminDrawer` **locked to that district** — see
   [`district-admin-roster.md`](./district-admin-roster.md).
 8. Every write is audit-logged (`DISTRICT_CREATE`, `DISTRICT_UPDATE`, `DISTRICT_TOGGLE`,
    `DISTRICT_DELETE`, `DISTRICT_RESTORE`, `DISTRICT_PURGE`) on `admins.district_master` via the
    shared `contracts.AuditWriter`.

## State

- `stateFilter` / `query` — the server state filter and the client search.
- `items`, `loading`, `error`, `reload` — `useAdminDistricts(stateFilter)` (live, refetched after each
  write).
- `showTrash` — the Live / Deleted switch; `trash` — `useDeletedDistricts(stateFilter)` (fetched and
  refetched after delete/restore/purge).
- `selected` — trash rows ticked for bulk **Delete forever**.
- Sheet form state — code, name, state, availability.
- `deleting` + `deleteReason` — the row pending soft delete; `purging` / `bulkPurging` — the
  permanent-delete confirmation; `toggling` — the code whose switch is in flight.

## Data path

- `listAdminDistricts()` → `GET /admin/districts` → live `admins.district_master` rows (`inUse`,
  timestamps).
- `listDeletedDistricts()` → `GET /admin/districts/trash` → trashed rows (`deletedAt`, `deleteReason`,
  `purgeAt`); each read first runs the expiry purge.
- `createDistrict()` → `POST /admin/districts` → insert (SUPER_ADMIN, audited) → `geo.Reload`.
- `updateDistrict()` → `PUT /admin/districts/{code}` → rename / re-state (code immutable).
- `toggleDistrict()` → `PATCH /admin/districts/{code}/toggle` → `is_active`.
- `deleteDistrict()` → `DELETE /admin/districts/{code}?reason=` → `deleted_at` + `is_active=false`
  (soft delete; `409 district_in_use` when referenced) → `geo.Reload`.
- `restoreDistrict()` → `POST /admin/districts/{code}/restore` → clears `deleted_at` (row stays
  deactivated) → `geo.Reload`.
- `purgeDistrict()` → `DELETE /admin/districts/{code}/permanent` → hard delete now (trash-only,
  unreferenced only).
- The customer / seller-facing picker still reads `GET /geo/districts` (`is_active AND deleted_at is
  null`), so an edit or delete reaches the apps on their next picker fetch — no cache to purge. The
  customer app's coverage check keeps a 60 s in-memory copy and forces a refresh on every foreground,
  the gate's "Check again", and the location picker's confirmation check.

## Success / error / empty

- **Success:** row persists; toast; the list and trash refetch. A new district is valid for onboarding
  at once.
- **Duplicate code:** `409 conflict` → toast "a district with this code already exists".
- **Delete:** toast names the `purgeAt` instant; the row moves to **Deleted**.
- **Referenced district:** no Delete button is shown (`inUse`); the gateway still returns
  `409 district_in_use` as a backstop.
- **Restore after the window:** `410 trash_expired` → the row drops from the trash.
- **Permanent delete blocked:** `409 district_in_use` → the row cannot be purged while referenced.
- **Validation:** a malformed code/name or unknown state is a `400` from the gateway, and the portal
  blocks the obvious shape errors before the request.
- **Empty:** "No districts" with a prompt to create one (or clear the filter); "Nothing deleted" in
  the trash.

## Known gaps

- `GET /admin/districts` has no pagination; the master is now **777 rows** (all 36 states/UTs, only
  TN + PY active) since `0127`, so the full read still works but the table relies on the state filter
  and search rather than scrolling the whole list.
- `data/districts.ts` (mobile/web offline fixtures) is still a manual mirror of the DB — see
  `docs/user-interaction-workflow/KNOWN_GAPS.md`. The mobile pickers read the live
  `GET /geo/districts` through `GatewayClient`; the fixture is only the offline shell.
- The 42 legacy 3-char codes (`TNA`, `PY0`…) are frozen forever — they are FK targets. New districts
  use `STATE+NN` codes and carry a `google_place_id` so lead intake can resolve them.

## Linked docs

- `docs/architecture/db-schema.md` §12.42, §12.48 (soft delete + 7-day trash)
- `docs/architecture/monolith-breakdown.md` §1 (districts row) + §4 (district codes)
- `docs/architecture/web-portal.md` (super-admin route table)
- [`../onboarding/seller-inquiry-queue.md`](../onboarding/seller-inquiry-queue.md) (leads resolve against this master)
