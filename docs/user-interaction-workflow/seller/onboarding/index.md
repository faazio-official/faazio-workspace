# Seller onboarding — domain index

**Status:** Shipped (by design: the KYC-complete application is mobile-only; the seller's login is auto-provisioned on approval; the seller app is a WebView over the portal). The landing page `/sell-with-us` adds a **public enquiry** that creates a `sellers.seller_leads` row only — not an account (see [`seller-web-intake.md`](./seller-web-intake.md)). Vendor fee/cover steps remain tracked as separate gaps in [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).
**Surfaces:** mobile `SellWithUs` (`SellerRegistrationScreen.tsx`) for application + KYC upload,
the landing page `/sell-with-us` for the public pre-install enquiry (no auth, no KYC fields),
portal `/seller/onboarding` for vendor creation, district-admin review at
`/admin/district/sellers/[id]` (super admin has a list only), fee-change boards, and the landing
page `/help-centre` — an illustrative walkthrough of the application that shows no data and submits
nothing. The tutorial's onboarding chapter (`seller-onboarding.ts`) covers this application; the
remaining chapters cover the rest of the seller journey (see
[`../help-centre.md`](../help-centre.md)).
**Trigger:** "Sell with us" entry in the customer app or the landing-page `/sell-with-us` link; a
seller opens onboarding/stores in the portal; an admin opens a seller application.

## Flows

| Flow | Doc |
|---|---|
| Public web enquiry (landing page) | [seller-web-intake.md](./seller-web-intake.md) |
| Admin lead follow-up queue (portal) | [seller-lead-queue.md](./seller-lead-queue.md) |
| Registration / application | [seller-registration.md](./seller-registration.md) |
| KYC documents + review | [kyc-documents.md](./kyc-documents.md) |
| Store/vendor setup | [store-setup.md](./store-setup.md) |

## Steps (application → store)

0. (Optional) A visitor sends an enquiry at `/sell-with-us` → `POST /seller-leads` →
   `sellers.seller_leads`; an admin follows up. No account is created.
1. Applicant completes `SellWithUs` on mobile and submits `POST /sellers`.
2. Applicant uploads KYC documents through the mobile media pipeline.
3. District/super admin verifies documents and the application.
4. Seller opens portal `/seller/onboarding` and creates a vendor via `POST /seller/stores`.
5. Seller adds products (`PENDING_REVIEW` → `ACTIVE`), then receives orders and payouts.

## Lifecycle

```
web enquiry (/sell-with-us → POST /seller-leads → sellers.seller_leads, no account)
  → application (POST /sellers, mobile)
  → KYC documents uploaded (media.assets)
  → district/super review (verify-doc, verify-kyc)
  → store/vendor created (POST /seller/stores)
  → products created (PENDING_REVIEW → ACTIVE)
  → orders / payouts
```

## State

- Mobile: `useAuthStore` (Firebase session for the customer app entry) and the portal WebView
  session for the seller app.
- Portal: `usePortalStore` + `src/lib/portal/*` (HttpOnly cookies; no bearer in the browser).
- Landing page `/sell-with-us`: local form state only — no session, no store, nothing persisted
  in the browser.

## Data path

- `POST /seller-leads` (public) → `sellers.seller_leads`; the admin queue reads `GET /seller-leads`
  and moves `PATCH /seller-leads/{id}` (district-scoped) — see
  [`seller-lead-queue.md`](./seller-lead-queue.md).
- `POST /sellers`, `GET /sellers/me`, `GET /sellers/{id}` → `sellers.sellers`.
- `POST /media/upload-url` + `POST /media/confirm` → `media.assets`.
- `POST /sellers/{id}/verify-doc/{docType}` → `sellers.kyc_documents`,
  `sellers.kyc_verification_log`; `POST /sellers/{id}/verify-kyc` only sets
  `sellers.sellers.status` to ACTIVE (it writes no document/log rows).
- `PATCH /sellers/{id}/status` sets the moderation status; an optional `reason` is recorded in the
  audit entry and persisted to `rejection_reason` + `rejection_history` on a REJECTED transition
  (ACTIVE clears the rejection trail).
- `POST /seller/stores`, `PUT /seller/stores/{id}` → `directory.stores`.

## Success / error / empty

- **Success:** application submitted, KYC verified, vendor live.
- **Error:** inline portal errors; no fabricated approval.
- **Empty:** no application → onboarding entry state.

## Designed, not partial

- **Application is intentionally mobile-only:** `POST /sellers` is called only from the customer
  app's `SellWithUs`; the portal deliberately has no application form. This is the completed design.
  The landing page's `/sell-with-us` form is deliberately **not** an application: it collects no
  KYC identifiers and writes a `sellers.seller_leads` row that an admin follows up in the portal
  queue ([`seller-web-intake.md`](./seller-web-intake.md), [`seller-lead-queue.md`](./seller-lead-queue.md)).
- **Portal login is auto-provisioned on approval:** `POST /sellers/{id}/verify-kyc` (or
  `PATCH /sellers/{id}/status` → `ACTIVE`) creates a `SELLER` `admins.portal_users` row scoped to
  `seller_id` from the application's `contact_email` (`must_change=true`), and returns the one-time
  temporary password to the approving admin in the response (never logged). Provisioning is
  idempotent — an existing login is reused, and an email already owned by another account is
  reported as skipped, in which case a superadmin can still issue one at `/admin/super/credentials`
  (HS256 JWT in HttpOnly cookies).
- **Seller app is a WebView over the portal:** the seller partner app loads the portal, so there is
  no native seller auth or separate seller web app to build.

## Known gaps

- A web lead is linked to the application it becomes only when the merchant applies with the same
  contact phone or email (`POST /sellers` back-fills `seller_id`, `0113`); a different phone *and*
  email leaves the lead unlinked and it is closed by hand
  ([`seller-lead-queue.md`](./seller-lead-queue.md)).
- Mobile seller onboarding OTP is unavailable when Firebase Auth is unconfigured
  (`SellerRegistrationScreen.tsx` reports it).
- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/web-portal.md`
- `docs/architecture/monolith-breakdown.md` (sellers/media rows)
- `docs/RUNBOOKS/PORTAL_AUTH.md`
