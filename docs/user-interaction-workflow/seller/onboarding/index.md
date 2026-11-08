# Seller onboarding — domain index

**Status:** Partial (application mobile-only; vendor fee/cover steps incomplete)
**Surfaces:** mobile `SellWithUs` (`SellerRegistrationScreen.tsx`) for application + KYC upload,
portal `/seller/onboarding` for vendor creation, district-admin review at
`/admin/district/sellers/[id]` (super admin has a list only), fee-change boards.
**Trigger:** "Sell with us" entry in the customer app; a seller opens onboarding/stores in the
portal; an admin opens a seller application.

## Flows

| Flow | Doc |
|---|---|
| Registration / application | [seller-registration.md](./seller-registration.md) |
| KYC documents + review | [kyc-documents.md](./kyc-documents.md) |
| Store/vendor setup | [store-setup.md](./store-setup.md) |

## Steps (application → store)

1. Applicant completes `SellWithUs` on mobile and submits `POST /sellers`.
2. Applicant uploads KYC documents through the mobile media pipeline.
3. District/super admin verifies documents and the application.
4. Seller opens portal `/seller/onboarding` and creates a vendor via `POST /seller/stores`.
5. Seller adds products (`PENDING_REVIEW` → `ACTIVE`), then receives orders and payouts.

## Lifecycle

```
application (POST /sellers, mobile)
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

## Data path

- `POST /sellers`, `GET /sellers/me`, `GET /sellers/{id}` → `sellers.sellers`.
- `POST /media/upload-url` + `POST /media/confirm` → `media.assets`.
- `POST /sellers/{id}/verify-doc/{docType}` → `sellers.kyc_documents`,
  `sellers.kyc_verification_log`; `POST /sellers/{id}/verify-kyc` only sets
  `sellers.sellers.status` to ACTIVE (it writes no document/log rows).
- `POST /seller/stores`, `PUT /seller/stores/{id}` → `directory.stores`.

## Success / error / empty

- **Success:** application submitted, KYC verified, vendor live.
- **Error:** inline portal errors; no fabricated approval.
- **Empty:** no application → onboarding entry state.

## Known gaps

- Mobile seller onboarding OTP is unavailable when Firebase Auth is unconfigured
  (`SellerRegistrationScreen.tsx` reports it).
- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/web-portal.md`
- `docs/architecture/monolith-breakdown.md` (sellers/media rows)
- `docs/RUNBOOKS/PORTAL_AUTH.md`
