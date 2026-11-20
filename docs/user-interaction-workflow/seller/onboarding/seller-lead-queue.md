# Seller lead queue — portal follow-up for "Sell with us" enquiries

**App / routes:** Partner Portal `client/web/platform/` —
`/admin/district/seller-leads` and `/admin/super/seller-leads`
(`app/admin/{district,super}/seller-leads/page.client.tsx` → `components/sellers/SellerLeadsBoard.tsx`)
**Status:** Shipped.
**Trigger:** a district admin or super admin opens **Supply → Seller leads** in the portal nav.

## Why it exists

`seller-web-intake.md` creates a `sellers.seller_leads` row from the public landing page. Without a
queue that row is only reachable in SQL, so a real enquiry ("I want to sell on Faazio") can sit
unread. This page turns it into a tracked call-back: every lead has an owner-visible status, a
reviewer and a note.

Approving a lead does **not** create a seller account. An enquiry is an unverified phone number; the
merchant still completes the KYC application in the app (`seller-registration.md`), which remains the
only path into `sellers.sellers`.

## Steps

1. Admin opens **Seller leads**. The page loads `GET /seller-leads` filtered to `status=NEW`.
2. The gateway scopes the read by identity — a district admin is locked to their own district (a
   legacy admin without a district claim falls back to the parent state); a super admin sees every
   district and may narrow by the district select.
3. Admin can filter by status (`New` / `Contacted` / `Approved` / `Rejected` / `All`) and search by
   shop name, owner name, phone or email (`?q=`).
4. Admin opens a lead to see the full enquiry: address, district, click-to-call phone, mailto email,
   the merchant's own notes, and — when a pin was dropped — an "Open the pinned shop location" link
   to Google Maps.
4a. **Ownership.** Any admin may **Claim** an unclaimed lead (`POST /seller-leads/{id}/assign`
   `{assigned:"me"}`); the owner is always the caller, so a lead can never be handed to someone else.
   Claiming is first-come: a second admin gets a `409` rather than both believing they own the call.
   Only the owner may **Release** it (`{assigned:""}`), which returns it to the unclaimed pool. The
   `Everyone` / `Mine` / `Unclaimed` chips filter the queue (`?assigned=me|unassigned`).
4b. **Already applied.** When the merchant completes the mobile application, `POST /sellers`
   back-fills `seller_id` on any lead matching their contact phone or email. The queue then shows
   `Applied · <sellerId>` and the dialog says the enquiry is closed — so an onboarded merchant is
   never chased twice.
5. Admin acts:
   - **Mark contacted** → `PATCH /seller-leads/{id}` `{status:"CONTACTED"}`
   - **Approve** → `{status:"APPROVED", note}` — "we called and they are proceeding"
   - **Reject** → `{status:"REJECTED", note}` — the note is **required** (min 4 chars) and is the
     recorded reason.
   The follow-up note is optional for contacted/approved, capped at 500 characters.
6. On success the queue reloads and the row shows the new status, the reviewer and the timestamp.

## State

- Local component state only (`SellerLeadsBoard`): filter status, district, search text, the open
  dialog's lead, its note draft and a busy id. No Zustand store — the queue is a server read.
- `useSession()` supplies the district admin's own district for the display filter; the gateway
  applies the authoritative scope regardless of what the client sends.

## Data path

- `listSellerLeads` → `GET /seller-leads?status&district&q` → `sellers.seller_leads`
  (200-row cap, newest first, `ilike` search over business/owner/phone/email).
- `updateSellerLeadStatus` → `PATCH /seller-leads/{id}` → conditional
  `update … where lead_id=$1 and status=$2 returning …` writing `status`, `admin_note`,
  `reviewed_by`, `reviewed_at`, `updated_at`.
- `assignSellerLead` → `POST /seller-leads/{id}/assign` → conditional
  `update … where lead_id=$1 and assigned_to=$2` writing `assigned_to`/`assigned_at` (`0113`).
- Back-fill: `(*Repo).LinkLeadToSeller` is called from `POST /sellers` after the application is
  created and sets `seller_id` on unlinked leads whose `contact_phone` or `contact_email` matches. It
  is best-effort and a no-op when nothing matches, so it can never fail an application.
- Every status change writes one `admins.audit_logs` row (`SELLER_LEAD_STATUS`,
  entity `sellers.seller_leads`) with the phone/email redacted to `***` — unlike the anonymous public
  write, the actor here is an admin whose role passes that table's `actor_role` check.
- No cache: leads carry PII, so they follow the same never-cache rule as the rest of `sellers`
  (`caching-cloudflare-valkey.md` §8).

## Success / error / empty

- **Success:** `200` with the updated lead; the row re-renders with its new status.
- **`404 not_found`** — the lead does not exist **or** is outside the caller's district. The two are
  deliberately indistinguishable so a district admin cannot probe another district's leads.
- **`409 status_changed`** — another admin already moved the lead. The board says so and reloads
  rather than retrying, so the first decision always wins.
- **`409 assigned_to_other` / `assigned_changed`** — another admin already claimed the lead (or owns
  the release you attempted). The queue reloads with their claim.
- **`400 bad_request`** — unknown status, a note over 500 chars, or a rejection without a reason.
- **`403`** — a seller or role-less token; only `DISTRICT_ADMIN` / `SUPER_ADMIN` may open the queue.
- **Empty:** "No new leads" when the `NEW` filter is empty — a truthful empty state, not an error.

## Known gaps

- Rejection does not email the merchant. The reason is recorded for the record, not delivered.
- The back-fill matches on phone **or** email; a merchant who applies with a different phone *and* a
  different email than they typed on the landing page stays unlinked (the lead is then closed by
  hand from the queue).
- The dashboard alert counts unclaimed `NEW` leads; there is no push/email page to an admin, so a
  lead is surfaced on the next dashboard or queue visit rather than immediately.

## Linked docs

- [`seller-web-intake.md`](./seller-web-intake.md) — the public enquiry that feeds this queue.
- [`seller-registration.md`](./seller-registration.md) — the KYC-complete application.
- `docs/architecture/db-schema.md` §12.41, `monolith-breakdown.md` §1 (sellers row).
