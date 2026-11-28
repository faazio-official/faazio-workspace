# Seller registration / application

**App / route:** customer app `SellWithUs` (`features/seller-onboarding/SellerRegistrationScreen.tsx`)
**Status:** Shipped (mobile-only by design; the portal deliberately has no seller-application form.
On approval the seller's portal login is auto-provisioned from `contact_email` — role `SELLER`,
scoped to `seller_id`, `must_change=true`; the seller app is a WebView over the portal.)
Contract acceptance, the server-owned rate card and the compliance status gate are **Partial**: the
acceptance/IP/tier audit is live, but no government GSTIN/PAN/FSSAI/bank provider is linked yet. The
application form itself no longer has a signature step or agreement tick-boxes: submitting the form
while signed in is the applicant's acceptance (see step 4).
**Trigger:** "Sell with us" entry in the customer app. A visitor who has not installed the app yet
can send a public enquiry on the landing page (`/sell-with-us` → `POST /seller-inquiries`) — that
creates an `INQUIRY` row only, never a KYC account, and this application remains the way to apply
([`seller-web-intake.md`](./seller-web-intake.md)). Submitting here with the same contact phone or
email **promotes** that same row to `PENDING_REVIEW` instead of creating a second record (`0129`).

## Steps

1. Applicant enters account fields (business name, owner, PAN, optional GSTIN) and one shop entry
   (app, category, per-store fee, FSSAI or drug licence, own pin, optional masked
   bank override, and **at least one shop-front photo**, up to five).
   The **shop number** is a single field like the fields around it: the `+91` dial code is plain
   inline text at the start of the value line (no separate box or control), followed by the 10
   national digits — the field strips non-digits and caps at 10. A **Same as owner number** tick below it mirrors the owner number into the shop
   number and keeps them in step while the owner edits theirs, leaving the field read-only. The tick
   is pre-selected for new drafts and off for drafts saved before it existed.
   **Every shop must share its location** before submission: the "Pin your shop" picker shows a
   native `MapView` with a draggable marker (matching the landing page's `sell-with-us` map) so the
   seller can tap or drag the pin onto the shop door itself. The marker is always drawn — before any
   choice it sits at the camera centre so the "tap or drag the pin" hint has a pin to point at, and
   **Confirm pin** stays disabled until a real point exists. Address search and "use my current
   location" remain the reliable alternatives when map tiles are unavailable (a missing/restricted
   Google Maps SDK key renders a blank canvas): when the map fires no load callback within 6 seconds
   the picker shows an in-card notice — with a red pin glyph — telling the seller to set the pin by
   search or current location instead of leaving a silent blank canvas. Permission-aware error copy
   and a Settings fallback are kept. The first shop's reverse-geocoded point sets the account
   state/district.
   The Business account step carries no per-question description text: field labels (dark ink, not
   muted grey) plus the controls only. The same applies to the Owner PAN & licence and Payout
   account steps — no section notes, licence hints, passbook hints or district status line.
   Step 2's **Submit** button is always enabled; tapping it with missing or
   invalid fields shows a red inline message naming exactly what to fill in (and jumps back to
   Step 1 when a Step 1 field is the problem) instead of being greyed out.
2. Contract tier: no rate-card question is shown. The screen reads `GET /sellers/contract-tiers` in
   the background (server-owned rate card, nothing hardcoded on the client) and puts the shop on the
   lowest-commission published tier, which `POST /sellers` receives as `contractTier`; the Terms of
   Service summary states that Faazio charges that commission per delivered order. If the catalogue
   cannot be read, submit is blocked with "Could not load the rate card. Reconnect and try again."
   and re-fetches it, never substituting a local card.
3. No clickwrap UI: there are no agreement tick-boxes in the form. Submitting the application is the
   acceptance, and `POST /sellers` still receives the three consent flags the gateway requires
   (`termsAccepted`, `partnerAgreementAccepted`, `ipLicenseGranted`) as accepted. The full public
   merchant disclosure is `https://faazio.com/seller-terms` (landing-page route
   `src/routes/seller-terms.tsx`; `/partner-terms` 301-redirects there); the acceptance audit stays
   server-side.
4. No OTP signature step: the Signature card (Send OTP, 6-digit code, Verify, resend countdown,
   "OTP verified" panel) is gone, and `otpVerified` is sent as `true`. The applicant is already a
   signed-in customer-app user, and the gateway separately rejects a bearer token whose phone claim
   does not match `contactPhone` (`401 otp_unverified`). Seller OTP helpers
   (`sendSellerOtp`/`verifySellerOtp`, Firebase phone auth) are no longer used by this screen.
5. KYC documents upload (`uploadSellerDocument`), and per-vendor **shop photos**: each picked image is
   POSTed to `POST /media/avif`, which re-encodes it to AVIF server-side and returns an
   `assetId`/`key`. The gateway converts because React Native has no AVIF encoder; the bytes are
   re-encoded from pixels, so camera EXIF/GPS never reaches storage. The conversion runs on a
   **detached 45 s deadline**, not the router's 10 s request timeout: a full-resolution camera JPEG
   takes several seconds to decode/downscale (long edge 1280)/encode on a shared instance, and the
   old 10 s deadline cancelled the asset-row insert mid-submit, surfacing as a 500
   (`media_unavailable`, "could not register image") for real phone photos. The client uploads
   these one at a time so several full-resolution photos cannot oversubscribe the encoder.
   Client-side hardening: `DocumentCapture` selects a ≤1600px camera format (`useCameraFormat`
   `photoResolution`) so captures stop sending full-sensor 12–50 MP bodies, and `uploadShopPhoto`
   fails fast locally with `photo_too_large` when a body still exceeds 4 MiB (shown as the
   "retake" copy); `media_unavailable` itself now reads as "converter busy — try again", since it
   is a server fault rather than a bad photo. The
   application then sends each vendor's ids as `shopPhotoIds`.
6. `gateway.submitSellerApplication(input)` → `POST /sellers` stores `sellers.sellers.user_id` from
   the auth subject, the `vendors[]` payload, the acceptance audit (timestamp, IP hash, account id),
   the resolved tier/rate-card version and the compliance status. `districtCode` is derived from the
   first pinned shop's reverse-geocoded district and is **required** (`400 district is required`).
7. `GET /sellers/me` returns the newest application linked by `user_id` (`404` = none), including the
   `vendorCount`/`vendorApps` rollup from `directory.stores`, so the "Shops" row survives a
   cross-session reload (the create response carries the same rollup). The admin detail
   (`GET /sellers/{id}`) returns each vendor's stored name, app, fee, licences, **address, phone,
   hours, latitude/longitude** and its **AVIF shop-photo CDN URLs**, so the review page can show every
   shop's pin and gallery (not just its fee).
8. A rejected application can be edited with `POST /sellers/{id}/edit` (REJECTED only; currently
   seller-role-gated, so the customer-app applicant cannot use it — see Known gaps).
9. **Local autosave draft (no Save button):** every change — account fields, shop cards, captured
   document/shop-photo URIs and the resolved tier — is debounced
   (~600 ms) into an AsyncStorage draft keyed per account
   (`faazio:seller-onboarding:draft:v1:<userId>`, `features/seller-onboarding/sellerDraft.ts`) and
   restored on the next open, so a half-filled application survives leaving the screen, backgrounding
   or an app restart. The phone number is kept. The draft is cleared on a
   successful submit and whenever `GET /sellers/me` reports `PENDING_REVIEW`/`ACTIVE`. Captured image
   URIs point at the app's local cache — if the OS purged a file, only that field needs a re-capture;
   KYC bytes are never copied or uploaded to persist a draft.
10. **Admin document requests:** `GET /sellers/me/document-requests` is read on open (and works even
    while the application is under review). A `PENDING` request renders a card above the status
    screen — "Faazio has requested you to upload your <document>" — with **Capture & upload**. The
    captured file uploads and fulfils the request
    (`POST /sellers/me/document-requests/{id}/fulfill`), which writes a fresh unverified KYC document
    and removes the card. See [`kyc-documents.md`](./kyc-documents.md).

## State

- `useAuthStore` — applicant identity (customer-app session).
- Local form state (including the resolved tier).
- `sellerDraft.ts` — device-local autosave draft (AsyncStorage, per-account key), restored on mount and
  reconciled with `GET /sellers/me` (cleared when an application is already in flight/active).

## Data path

- `gateway.listContractTiers` → `GET /sellers/contract-tiers` → `sellers.contract_tiers`.
- `gateway.submitSellerApplication` → `POST /sellers` → `sellers.sellers` +
  `sellers.compliance_validations`.
- `gateway.getMySellerApplication` → `GET /sellers/me`.
- `gateway.uploadSellerDocument` → `/media/upload-url` + R2 `PUT` + `/media/confirm` →
  `media.assets`.
- `gateway.uploadShopPhoto` → `POST /media/avif` (raw JPEG/PNG body) → AVIF object in R2 +
  `media.assets` (`owner_type = 'SHOP'`, PUBLIC, claimed by `POST /sellers`) →
  `directory.stores.photo_keys`/`photo_asset_ids`.
- `gateway.resubmitSellerApplication` → `POST /sellers/{id}/edit`.
- Local autosave only: AsyncStorage key `faazio:seller-onboarding:draft:v1:<userId>` (never sent to the
  gateway; no KYC bytes, no OTP stored).
- No fixture seller rows or local rate cards are presented as live.

## Success / error / empty

- **Success:** application pending review (`201`, `PENDING_REVIEW`), with `complianceStatus`
  `PENDING` (or `FAILED` when a format/checksum check rejects an identifier).
- **Error:** inline validation/API error; no fake approval. Server-side failure modes:
  - `400 bad_request` — missing names/PAN/email/bank/passbook, invalid platform fee/lat-lng, an
    inactive/unservable `stateCode` (validated against `admins.states`, 0073), a missing `districtCode`
    (`district is required`), or a `districtCode` whose parent state does not match `stateCode`.
  - `400 unknown_district` — `districtCode` is not in the active master (`admins.district_master`).
  - `400 otp_required` — `otpVerified` is false (this screen always sends it true).
  - `400 agreements_required` — any consent flag is missing (this screen always sends all three).
  - `400 invalid_contract_tier` — the selected tier is absent/inactive.
  - `401 otp_unverified` — the bearer token's phone claim does not match `contactPhone`.
  - `409 email_taken` — the lower-cased `contactEmail` already belongs to another application
    (`sellers_contact_email_lower_uniq`, 0068); surfaced on both `POST /sellers` and
    `POST /sellers/{id}/edit`.
  - `409 compliance_failed` — an admin tried to activate an application whose format/checksum
    compliance status is `FAILED`.
  - `50x media_unavailable` — the AVIF converter or the media registry/storage is temporarily busy
    (a full-resolution phone photo normally takes 15–25 s on a shared instance). The copy tells the
    seller the photo itself is fine and to retry; it no longer claims the photo reached the server
    when the failure was a converter/storage step.
  A KYC/passbook media failure is re-tagged client-side as `document_upload_failed` ("We couldn’t
  upload your document") so the seller is not told the shop-photo converter is busy.
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
export SHOP_PHOTO_IDS='<id1>,<id2>'   # one unclaimed DRAFT AVIF asset per applicant
server/gateway/scripts/simulate-seller-registration.sh 5 http://localhost:8080
```

Every application must carry at least one shop-front photo (the web enquiry path shares the same
`shopPhotoIds` rule), and a claim promotes the asset `DRAFT → ACTIVE`, so each applicant needs its own
id. Without R2 credentials locally, seed N drafts directly in `media.assets` (the script's header has
the exact `insert … 'DRAFT'` one-liner) and pass their ids.

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
