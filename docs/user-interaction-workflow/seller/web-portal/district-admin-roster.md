# Super admin — district admins (roster, vertical scope, invite hand-over)

**App / route(s):** portal `/admin/super/district-admins`
(`app/admin/super/district-admins/page.client.tsx`) and the district drill-down
`/admin/super/districts/[code]` (`app/admin/super/districts/[code]/page.client.tsx`). Both mount the
shared slide-over `src/components/admin/DistrictAdminDrawer.tsx`.
**Status:** Shipped
**Trigger:** SUPER_ADMIN opens **Governance → District admins**, clicks **Assign admin** on the roster
page, or clicks **Assign admin** / the empty-roster CTA on a district drill-down.

## Steps

1. **Roster read.** The page loads `GET /district-admins` (every district; the store is also hydrated
   at login) and `GET /admin/portal-users` (the logins, for the invite/lifecycle badges and the
   pre-submit one-person-one-role lint). A district filter chip + search narrow the table; the coverage
   bar follows the selected district (`covered / selected`) instead of a hardcoded district.
2. **Assign.** *Assign admin* opens the drawer. From the roster page the district picker is free (a
   searchable list); from a drill-down the district is locked to the URL's `code`, and an uncovered-
   district chip opens it locked to that district.
3. **Form.** District, Name, Email, Phone (10-digit, prefix-normalised), **Login** mode
   (`Send invite` / `Set temporary password` / `No login yet`) and **Vertical access** (Mart / Food /
   Pharma, all on by default). Email duplicates are blocked inline before submit; a shared phone is an
   amber soft warning.
4. **Submit.** `createDistrictAdminWithLogin()` → `POST /district-admins` writes the roster row and —
   for invite/password modes — the `DISTRICT_ADMIN` portal login in **one transaction**:
   - `inviteMode:true` → the server mints a one-time, 7-day token, stores only its SHA-256 hash, and
     returns the raw token once. The drawer shows the invite link + copy button.
   - `password` mode → the login is created with `must_change` locked true; the temporary password is
     shown once with a copy button.
   - `issueLogin:false` → roster only (No login badge + one-click **Issue login** later).
5. **Roster actions.** **Edit** updates name/email/phone/district + verticals (`PUT
   /district-admins/{id}`; an email change mirrors onto the linked login). **Deactivate/Reactivate**
   flips the roster and its login (deactivating revokes the login's refresh sessions). **Delete**
   removes the roster and the linked login (7-day audit trail retained). A **pending** row shows
   **New invite link** (`POST /district-admins/{id}/resend-invite`) which rotates the token and copies
   the new link; a row whose `inviteExpiresAt` has passed is shown as **Invite expired** and can be
   re-invited the same way.
6. **Drill-down.** `/admin/super/districts/[code]` lists that district's admins with their vertical
   badges and Active / Pending invite status; the **Assign admin** button opens the drawer locked to
   the district.

## State

- `useDistrictAdmins()` — the roster slice (refreshed from `GET /district-admins` on mount).
- `listPortalCredentials()` — local `creds` state for the login badges + duplicate lint.
- Page-local: `query`, `districtFilter`, `lockedDistrict`, `drawerOpen`, `editing`/`draft` (edit
  sheet), `resending`.
- Drawer-local: `mode`, form fields, `created` (the one-time invite link / temp password), errors.

## Data path

- `createDistrictAdminWithLogin()` → `POST /district-admins` → `admins.district_admins` +
  `admins.portal_users` in one tx (`internal/admins` `Provisioner.Create`). Vertical flags →
  `mart_access`/`food_access`/`pharma_access` (`0130`). Invite → `invite_status='pending'`,
  `invite_token_hash`, `invite_expires_at` (`0131`).
- `resendDistrictAdminInvite()` → `POST /district-admins/{id}/resend-invite` → rotates the hash/expiry.
- `updateDistrictAdmin()` → `PUT /district-admins/{id}` → roster identity + active + verticals, login
  kept in sync by `lower(email)`.
- `deleteDistrictAdmin()` → `DELETE /district-admins/{id}` → roster + linked login removed in one tx.
- `districtAdminInviteUrl(token)` builds `/accept-invite/admin?token=…` (see
  [`district-admin-invite-accept.md`](./district-admin-invite-accept.md)).
- Vertical flags are enforced server-side: the login token carries the three flags and every
  district-admin moderation/list surface checks them (`auth.CanAccessVertical`/`AllowedVerticals`) —
  product, add-on, store fee/live/cover, seller/enquiry/fee-change decisions and queues, district
  orders, promo campaigns/opt-ins/caps, and blood-board moderation. A row outside the granted
  verticals answers `404` (not `403`) so its existence is not disclosed.
- Invite delivery is a copied link — there is no mail/WhatsApp provider in the repo.

## Success / error / empty

- **Success:** the admin appears in the roster immediately (store update) and, for invite/password
  modes, a login exists; the one-time secret (invite link or temp password) is shown once.
- **Duplicate email:** `409` with a role-specific code (`email_used_by_super_admin`,
  `email_used_by_seller`, `email_has_district_login`, `email_has_district_roster`) → inline field
  error, form kept.
- **Shared phone:** `201 warnings[]` — the admin is created and an amber note is shown.
- **Weak password:** `400 weak_password` (≥12 chars, not common) in password mode.
- **Empty:** "No admins yet" with the assign CTA; a filtered empty state offers to clear the filter.
- **Resend on a non-pending login:** `409 invite_not_pending` → toast.

## Known gaps

- Invite delivery is a manual copied link (no transactional-email provider) — see
  [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).
- The drill-down roster is read-only (edit/deactivate/delete live on the roster page).

## Linked docs

- [`district-admin-invite-accept.md`](./district-admin-invite-accept.md) (the invitee's side)
- `docs/architecture/db-schema.md` §12.46 (vertical scope + invite lifecycle)
- `docs/architecture/server-gateway-plan.md` (portal identity writes)
- `docs/architecture/monolith-breakdown.md` §1 (admins row)
- `docs/architecture/web-portal.md` (super-admin route table)
