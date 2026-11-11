# Seller registration / application

**App / route:** customer app `SellWithUs` (`features/seller-onboarding/SellerRegistrationScreen.tsx`)
**Status:** Shipped (mobile-only by design; the portal deliberately has no seller-application form.
On approval the seller's portal login is auto-provisioned from `contact_email` — role `SELLER`,
scoped to `seller_id`, `must_change=true`; the seller app is a WebView over the portal.)
Contract clickwrap, the server-owned rate card and the compliance status gate are **Partial**: the
acceptance/IP/tier audit is live, but no government GSTIN/PAN/FSSAI/bank provider is linked yet.
**Trigger:** "Sell with us" entry in the customer app.

## Steps

1. Applicant enters account fields (business name, owner, PAN, optional GSTIN) and one or more
   vendor entries (app, category, per-store fee, FSSAI or drug licence, own pin, optional masked
   bank override).
2. Contract tier: the screen reads `GET /sellers/contract-tiers` (server-owned rate card) and shows
   the selected tier's commission and payout terms. No tier is hardcoded on the client.
3. Clickwrap: the applicant must tick three acceptances — Terms of Service, Seller / Partner
   Agreement and the content/IP licence. Each opens a short in-app summary sheet. The full public
   merchant disclosure is `https://faazio.com/seller-terms` (landing-page route
   `src/routes/seller-terms.tsx`; `/partner-terms` 301-redirects there); the clickwrap capture and
   audit remain server-side.
4. Phone verification with Firebase OTP on mobile (the digital signature).
5. KYC documents upload (`uploadSellerDocument`).
6. `gateway.submitSellerApplication(input)` → `POST /sellers` stores `sellers.sellers.user_id` from
   the auth subject, the `vendors[]` payload, the acceptance audit (timestamp, IP hash, account id),
   the resolved tier/rate-card version and the compliance status. `districtCode` is derived from the
   first pinned shop's reverse-geocoded district and is **required** (`400 district is required`).
7. `GET /sellers/me` returns the newest application linked by `user_id` (`404` = none), including the
   `vendorCount`/`vendorApps` rollup from `directory.stores`, so the "Shops" row survives a
   cross-session reload (the create response carries the same rollup).
8. A rejected application can be edited with `POST /sellers/{id}/edit` (REJECTED only; currently
   seller-role-gated, so the customer-app applicant cannot use it — see Known gaps).

## State

- `useAuthStore` — applicant identity (customer-app session).
- Local form state (including the selected tier and three acceptance booleans).

## Data path

- `gateway.listContractTiers` → `GET /sellers/contract-tiers` → `sellers.contract_tiers`.
- `gateway.submitSellerApplication` → `POST /sellers` → `sellers.sellers` +
  `sellers.compliance_validations`.
- `gateway.getMySellerApplication` → `GET /sellers/me`.
- `gateway.uploadSellerDocument` → `/media/upload-url` + R2 `PUT` + `/media/confirm` →
  `media.assets`.
- `gateway.resubmitSellerApplication` → `POST /sellers/{id}/edit`.
- No fixture seller rows or local rate cards are presented as live.

## Success / error / empty

- **Success:** application pending review (`201`, `PENDING_REVIEW`), with `complianceStatus`
  `PENDING` (or `FAILED` when a format/checksum check rejects an identifier).
- **Error:** inline validation/API error; no fake approval. Server-side failure modes:
  - `400 bad_request` — missing names/PAN/email/bank/passbook, invalid platform fee/lat-lng, an
    inactive/unservable `stateCode` (validated against `admins.states`, 0073), a missing `districtCode`
    (`district is required`), or a `districtCode` whose parent state does not match `stateCode`.
  - `400 unknown_district` — `districtCode` is not in the active master (`admins.district_master`).
  - `400 otp_required` — `otpVerified` is false.
  - `400 agreements_required` — any of the three clickwrap acceptances is missing.
  - `400 invalid_contract_tier` — the selected tier is absent/inactive.
  - `401 otp_unverified` — the bearer token's phone claim does not match `contactPhone`.
  - `409 email_taken` — the lower-cased `contactEmail` already belongs to another application
    (`sellers_contact_email_lower_uniq`, 0068); surfaced on both `POST /sellers` and
    `POST /sellers/{id}/edit`.
  - `409 compliance_failed` — an admin tried to activate an application whose format/checksum
    compliance status is `FAILED`.
  The mobile screen maps the gateway `code` to specific copy (duplicate email, unverified phone,
  unknown district, missing agreements, invalid tier) instead of one generic "try again" message.
- **Empty:** no application → onboarding entry state.

## Known gaps

- Mobile OTP verification is unavailable when Firebase Auth is unconfigured; the screen says so.
- **Government validation is not linked.** The default `FormatComplianceValidator` checks PAN/
  GSTIN/FSSAI/IFSC shape and the GSTIN checksum, records `sellers.compliance_validations`, and leaves
  the account `PENDING`. A real provider is a server-side adapter (`Handler.WithCompliance`).
- Compliance `PENDING` does not block activation; only `FAILED` does. The district admin's manual KYC
  review is still the verification authority until a provider is linked.
- The customer app submits a rejected application through `POST /sellers`, which collides with the
  `contact_email` unique index; `POST /sellers/{id}/edit` requires a SELLER role the applicant does
  not have before approval.
- See [`../../../KNOWN_GAPS.md`](../../../KNOWN_GAPS.md).

## Local verification (no Firebase / SMS)

The gateway verifies Firebase ID tokens first and falls back to legacy Supabase/GoTrue **HS256**
tokens signed with `SUPABASE_JWT_SECRET`. That makes the exact server path
(`auth.Require` → `checkout.ProvisionUserID` → `auth.OTPSigned` → `sellers.CreateExtended`) drivable
locally without Firebase:

```bash
# gateway running with SUPABASE_JWT_SECRET set; local Postgres migrated to the latest migration + seed
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
- `client/web/landingpage/src/routes/seller-terms.tsx` (public Seller & Partner Terms)
- `docs/RUNBOOKS/FIREBASE_AUTH.md`
- `server/gateway/scripts/simulate-seller-registration.sh`
