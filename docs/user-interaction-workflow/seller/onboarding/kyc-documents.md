# KYC documents + review

**App / route:** portal `/seller/onboarding`; admin review at `/admin/district/sellers/[id]` and
`/admin/super/sellers`
**Status:** Shipped
**Trigger:** Seller submits/updates KYC; admin opens a seller application.

## Steps

1. Seller uploads each document with `uploadSellerDocument(uri, ownerId, mime?)`.
2. The client requests `POST /media/upload-url` (300 s presigned PUT), uploads the blob, then calls
   `POST /media/confirm`; the asset becomes `ACTIVE` and links to the seller.
3. Seller document types are the `kyc_doc_type` enum: `GSTIN`, `PAN`, `BANK_PROOF`,
   `SHOP_LICENSE`, `PASSBOOK`, `FSSAI`.
4. Admin opens the application (`GET /sellers/{id}`), reviews documents, and calls
   `POST /sellers/{id}/verify-doc/{docType}` per document.
5. Admin verifies the whole KYC with `POST /sellers/{id}/verify-kyc`, or rejects with
   `POST /sellers/{id}/reject` and a reason.
6. Private document preview uses `GET /media/private/{assetId}` (creator/admin presigned GET).
7. Every verification writes `sellers.kyc_verification_log`.

## State

- Portal local review state; no shared mobile store.
- Seller application status is server-owned (`sellers.sellers.status`).

## Data path

- `gateway.uploadSellerDocument` → `POST /media/upload-url` + `PUT R2` + `POST /media/confirm` →
  `media.assets`.
- `gateway.getSellerDetail` → `GET /sellers/{id}` → `sellers.sellers`, `sellers.kyc_documents`,
  `sellers.bank_accounts`.
- `gateway.verifySellerDoc` → `POST /sellers/{id}/verify-doc/{docType}` →
  `sellers.kyc_documents`, `sellers.kyc_verification_log`.
- `gateway.verifySellerKyc` → `POST /sellers/{id}/verify-kyc`.
- `gateway.rejectSeller` → `POST /sellers/{id}/reject`.
- `gateway.getPrivateMediaUrl` → `GET /media/private/{assetId}`.

## Success / error / empty

- **Success:** document/KYC verified; seller status advances.
- **Error:** portal error; no fabricated verification.
- **Empty:** no documents → review cannot verify; honest pending state.

## Known gaps

- None specific to KYC.

## Linked docs

- `docs/architecture/monolith-breakdown.md` (sellers/media rows)
- `docs/architecture/db-schema.md` (sellers tables)
- `docs/RUNBOOKS/PORTAL_AUTH.md`
