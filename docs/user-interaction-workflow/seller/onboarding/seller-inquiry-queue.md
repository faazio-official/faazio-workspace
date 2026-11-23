# Seller enquiry queue — portal follow-up for "Sell with us" enquiries

**App / routes:** Partner Portal `client/web/platform/` —
`/admin/district/seller-inquiries` and `/admin/super/seller-inquiries`
(`app/admin/{district,super}/seller-inquiries/page.client.tsx` → `components/sellers/SellerInquiryBoard.tsx`)
**Status:** Shipped.
**Trigger:** a district admin or super admin opens **Supply → Seller enquiries** in the portal nav.

## Why it exists

`seller-web-intake.md` creates a `sellers.sellers` row with `status = 'INQUIRY'` and `source = 'web'`
from the public landing page (migration `0129`). Without a queue that row is only reachable in SQL, so a
real enquiry ("I want to sell on Faazio") can sit unread. This page turns it into a tracked call-back:
every enquiry has a call-back stage, an owner and a note.

An enquiry is the **same merchant row** the app application later completes — there is no separate lead
table and no post-hoc phone/email back-fill. `POST /sellers` (the KYC application) matches the open
enquiry on contact phone/email and promotes that row to `PENDING_REVIEW` / `source = 'app'`, so one
merchant has one id from first enquiry to live seller (`seller-registration.md`).

## Steps

1. Admin opens **Seller enquiries**. The page loads `GET /seller-inquiries` filtered to `stage=NEW`.
2. The gateway scopes the read by identity — a district admin is locked to their own district (a
   legacy admin without a district claim falls back to the parent state); a super admin sees every
   district and may narrow by the district select.
3. Admin can filter by stage (`New` / `Contacted` / `Approved` / `Rejected` / `All`) and search by
   shop name, owner name, phone or email (`?q=`).
4. Admin opens an enquiry to see the full record: address, district, **the expected platform fee**
   (required on the enquiry, so the call-back opens with a number), the **shop photos** the merchant
   attached (AVIF thumbnails), click-to-call phone, mailto email, the merchant's own notes, and — when
   the enquiry carries a pin — an "Open the pinned shop location" link to Google Maps. An enquiry
   without a pin predates the mandatory-location gate; the dialog then says to confirm the address on
   the call.
4a. **Ownership.** Any admin may **Claim** an unclaimed enquiry (`POST /seller-inquiries/{id}/assign`
   `{assigned:"me"}`); the owner is always the caller, so an enquiry can never be handed to someone
   else. Claiming is first-come: a second admin gets a `409` rather than both believing they own the
   call. Only the owner may **Release** it (`{assigned:""}`), which returns it to the unclaimed pool.
   The `Everyone` / `Mine` / `Unclaimed` chips filter the queue (`?assigned=me|unassigned`).
4b. **Already applied.** When the merchant completes the mobile application, `POST /sellers` promotes
   this same row (it is matched on contact phone or email), so the queue stops listing it — the
   enquiry's `status` is no longer `INQUIRY` and the record is now a normal
   `PENDING_REVIEW` application. An onboarded merchant is never chased twice, and no link column is
   needed because the row *is* the application.
5. Admin acts, in two independent dimensions:
   - **Call-back stage** (`inquiry_stage`) — `PATCH /seller-inquiries/{id}` `{stage:"CONTACTED"}`,
     `{stage:"APPROVED"}`, `{stage:"REJECTED"}`. This is the operator's own progress record.
   - **Merchant lifecycle** (`status`) — the same `PATCH` may carry
     `{status:"PENDING_REVIEW"}` (promote: the merchant is proceeding, hand the row to the normal seller
     review) or `{status:"REJECTED", note}` (the note is **required**, min 4 chars, and is the recorded
     reason). `status:"ACTIVE"` is refused with `409 not_an_application` — an enquiry carries no KYC
     documents, so it can never be activated from the queue.
6. On success the queue reloads and the row shows the new stage, the reviewer and the timestamp.

## State

- Local component state only (`SellerInquiryBoard`): filter stage, district, search text, the open
  dialog's enquiry, its note draft and a busy id. No Zustand store — the queue is a server read.
- `useSession()` supplies the district admin's own district for the display filter; the gateway
  applies the authoritative scope regardless of what the client sends.

## Data path

- `listSellerInquiries` → `GET /seller-inquiries?stage&district&q&assigned` → `sellers.sellers`
  `where status = 'INQUIRY'` (200-row cap, newest first, `ilike` search over
  business/owner/phone/email, `sellers_inquiry_queue_idx`). The `district` parameter narrows a super
  admin's view; for a scoped admin the identity scope always wins, so it can never widen the queue past
  their claim.
- `updateSellerInquiry` → `PATCH /seller-inquiries/{id}` → conditional
  `update … where seller_id=$1 and status='INQUIRY' returning …` writing `inquiry_stage`, and on a
  decision `status`/`rejection_reason`/`reviewed_by`/`reviewed_at`/`updated_at`.
- `assignSellerInquiry` → `POST /seller-inquiries/{id}/assign` → conditional
  `update … where seller_id=$1 and inquiry_assigned_to=$2` writing
  `inquiry_assigned_to`/`inquiry_assigned_at`.
- Every stage/status change writes one `admins.audit_logs` row (`SELLER_INQUIRY_UPDATE`, entity
  `sellers.sellers`) with the phone/email redacted to `***` — unlike the anonymous public write, the
  actor here is an admin whose role passes that table's `actor_role` check.
- **No back-fill and no merge step:** `POST /sellers` `Repo.matchOpenInquiry` finds the open enquiry by
  contact phone/email and updates that row (`status = 'PENDING_REVIEW'`, `source = 'app'`), keeping the
  `inquiry_*` columns as the historical record and seeding each vendor's shop gallery from
  `shop_photos` when the application brings none.
- No cache: enquiries carry PII, so they follow the same never-cache rule as the rest of `sellers`
  (`caching-cloudflare-valkey.md` §8).

## Success / error / empty

- **Success:** `200` with the updated record; the row re-renders with its new stage/status.
- **`404 not_found`** — the enquiry does not exist **or** is outside the caller's district. The two are
  deliberately indistinguishable so a district admin cannot probe another district's enquiries.
- **`409 status_changed`** — another admin already moved the enquiry. The board says so and reloads
  rather than retrying, so the first decision always wins.
- **`409 not_an_application`** — the requested move is `INQUIRY → ACTIVE`/`SUSPENDED`. The board says
  the row must be promoted by the merchant's application (or to `PENDING_REVIEW`) first.
- **`409 assigned_to_other` / `assigned_changed`** — another admin already claimed the enquiry (or owns
  the release you attempted). The queue reloads with their claim.
- **`400 bad_request`** — unknown stage/status, a note over 500 chars, or a rejection without a reason.
- **`403`** — a seller or role-less token; only `DISTRICT_ADMIN` / `SUPER_ADMIN` may open the queue.
- **Empty:** "No new enquiries" when the `NEW` filter is empty — a truthful empty state, not an error.

## Testing the queue

```bash
# Unit + DB integration (district scope, lifecycle, claim, search, promotion)
cd server/gateway && go test ./internal/sellers/ -run 'TestInquiry|TestCreateInquiry'
TEST_DATABASE_URL='postgres://postgres:faazio@localhost:5432/faazio?sslmode=disable' \
TEST_VALKEY_URL='redis://localhost:6379/0' \
  go test -count=1 ./internal/sellers/
```

The package's DB tests skip (and still report `ok`) when `TEST_DATABASE_URL` is unset — count the skips
(`go test -v … | grep -c SKIP`) before trusting a green run.

`TestApplicationPromotesInquiry` is the important one: it submits a web enquiry, submits an app
application with the same phone, and asserts the row count stays **one** and the surviving row is
`PENDING_REVIEW` / `source = 'app'`.

## Known gaps

- Rejection does not email the merchant. The reason is recorded for the record, not delivered.
- Promotion matches on phone **or** email; a merchant who applies with a different phone *and* a
  different email than they typed on the landing page produces a second row (the enquiry is then
  rejected by hand from the queue).
- The dashboard alert counts unclaimed `NEW` enquiries; there is no push/email page to an admin, so an
  enquiry is surfaced on the next dashboard or queue visit rather than immediately.

## Linked docs

- [`seller-web-intake.md`](./seller-web-intake.md) — the public enquiry that feeds this queue.
- [`seller-registration.md`](./seller-registration.md) — the KYC-complete application that promotes it.
- `docs/architecture/db-schema.md` §12.41, `monolith-breakdown.md` §1 (sellers row).
