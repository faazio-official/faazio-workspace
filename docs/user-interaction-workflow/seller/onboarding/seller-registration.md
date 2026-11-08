# Seller registration / application

**App / route:** customer app `SellWithUs` (`features/seller-onboarding/SellerRegistrationScreen.tsx`)
**Status:** Shipped (mobile-only by design; the portal deliberately has no seller-application form. On approval the seller's portal login is auto-provisioned from `contact_email` — role `SELLER`, scoped to `seller_id`, `must_change=true`; the seller app is a WebView over the portal.)
**Trigger:** "Sell with us" entry in the customer app.

## Steps

1. Applicant enters account fields (business name, owner, PAN, optional GSTIN) and one or more
   vendor entries (app, category, per-store fee, FSSAI or drug licence, own pin, optional masked
   bank override).
2. Phone verification with Firebase OTP on mobile.
3. KYC documents upload (`uploadSellerDocument`).
4. `gateway.submitSellerApplication(input)` → `POST /sellers` stores `sellers.sellers.user_id` from
   the auth subject and the `vendors[]` payload. `districtCode` is derived from the first pinned
   shop's reverse-geocoded district and is **required** (`400 district is required` when absent).
5. `GET /sellers/me` returns the newest application linked by `user_id` (`404` = none), including the
   `vendorCount`/`vendorApps` rollup from `directory.stores`, so the "Shops" row survives a
   cross-session reload (the create response carries the same rollup).
6. A rejected application can be edited with `POST /sellers/{id}/edit` (REJECTED only).

## State

- `useAuthStore` — applicant identity (customer-app session).
- Local form state.

## Data path

- `gateway.submitSellerApplication` → `POST /sellers` → `sellers.sellers`.
- `gateway.getMySellerApplication` → `GET /sellers/me`.
- `gateway.uploadSellerDocument` → `/media/upload-url` + R2 `PUT` + `/media/confirm` →
  `media.assets`.
- `gateway.resubmitSellerApplication` → `POST /sellers/{id}/edit`.
- No fixture seller rows are presented as live.

## Success / error / empty

- **Success:** application pending review (`201`, `PENDING_REVIEW`).
- **Error:** inline validation/API error; no fake approval. Server-side failure modes:
  - `400 bad_request` — missing names/PAN/email/bank/passbook, invalid platform fee/lat-lng, an
    inactive/unservable `stateCode` (validated against `admins.states`, 0073), a missing `districtCode`
    (`district is required`), or a `districtCode` whose parent state does not match `stateCode`.
  - `400 unknown_district` — `districtCode` is not in the active master (`admins.district_master`).
  - `400 otp_required` — `otpVerified` is false.
  - `401 otp_unverified` — the bearer token's phone claim does not match `contactPhone`.
  - `409 email_taken` — the lower-cased `contactEmail` already belongs to another application
    (`sellers_contact_email_lower_uniq`, 0068); surfaced on both `POST /sellers` and
    `POST /sellers/{id}/edit`.
  The mobile screen maps the gateway `code` to specific copy (duplicate email, unverified phone,
  unknown district) instead of one generic "try again" message.
- **Empty:** no application → onboarding entry state.

## Known gaps

- Mobile OTP verification is unavailable when Firebase Auth is unconfigured; the screen says so.
- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Local verification (no Firebase / SMS)

The gateway verifies Firebase ID tokens first and falls back to legacy Supabase/GoTrue **HS256**
tokens signed with `SUPABASE_JWT_SECRET`. That makes the exact server path
(`auth.Require` → `checkout.ProvisionUserID` → `auth.OTPSigned` → `sellers.CreateExtended`) drivable
locally without Firebase:

```bash
# gateway running with SUPABASE_JWT_SECRET set; local Postgres migrated (all 87 migrations + seed)
export SUPABASE_JWT_SECRET='<same secret the gateway uses>'
server/gateway/scripts/simulate-seller-registration.sh 5 http://localhost:8080
```

The script mints one HS256 token per applicant (`sub` + matching `phone` claim) and submits a valid
`POST /sellers` body (`otpVerified: true`, unique sub/phone/email), then asserts `201`,
`PENDING_REVIEW`, and that `GET /sellers/me` returns the same `sellerId`. Exit code is non-zero on
any failure. It writes real rows through the real handler — no fixtures.

## Linked docs

- `docs/architecture/mobile-app.md` (seller onboarding)
- `docs/architecture/web-portal.md`
- `docs/RUNBOOKS/FIREBASE_AUTH.md`
- `server/gateway/scripts/simulate-seller-registration.sh`
