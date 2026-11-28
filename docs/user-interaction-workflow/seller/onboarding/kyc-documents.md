# KYC documents + review

**App / route:** mobile `SellWithUs` (`SellerRegistrationScreen.tsx`) for KYC upload; admin review at
`/admin/district/sellers/[id]` and `/admin/super/sellers`
**Status:** Shipped
**Trigger:** Applicant uploads KYC in the mobile application; admin opens a seller application.

## Steps

1. Seller uploads each document with `uploadSellerDocument(uri, ownerId, mime?)`.
2. The client requests `POST /media/upload-url` (300 s presigned PUT), uploads the blob, then calls
   `POST /media/confirm`; the asset becomes `ACTIVE` and links to the seller.
3. Seller document types are the `kyc_doc_type` enum: `GSTIN`, `PAN`, `BANK_PROOF`,
   `SHOP_LICENSE`, `PASSBOOK`, `FSSAI`.
4. Admin opens the application (`GET /sellers/{id}`), reviews documents, and calls
   `POST /sellers/{id}/verify-doc/{docType}` per document. The **Vendors** section also surfaces the
   per-shop licence captured during onboarding: the FSSAI number (Food), drug licence number
   (Pharma) or shop registration certificate (Mart) plus a **View certificate** button that opens the
   private `fssaiCertAssetId`/`drugLicenseCertAssetId` via `GET /media/private/{assetId}`. A missing
   file is flagged inline instead of being silently absent.
5. **Request a re-upload (not admin-side replace):** each KYC document row has a **Request** button
   (`POST /sellers/{id}/document-requests {docType}`) instead of the old **Replace**. It writes a
   `PENDING` `sellers.document_requests` row (one per seller+docType, so repeat taps refresh rather
   than duplicate) and notifies the applicant (`SELLER_DOC_REQUEST`). While a request is open the row
   shows **Requested**.
6. **Applicant fulfils from the app:** the customer-app **Sell with us** screen (`GET
   /sellers/me/document-requests`) shows "Faazio has requested you to upload your <document>" with a
   **Capture & upload** button. The picked file uploads via `uploadSellerDocument`, then
   `POST /sellers/me/document-requests/{requestId}/fulfill {fileKey, assetId}` writes a fresh
   `sellers.kyc_documents` row of that type (unverified, so it re-enters review) and marks the
   request `FULFILLED` in one transaction. The card disappears once the list reloads.
7. Admin verifies the whole KYC with `POST /sellers/{id}/verify-kyc`, or rejects with
   `POST /sellers/{id}/reject` and a reason.
8. Private document preview uses `GET /media/private/{assetId}` (creator/admin presigned GET).
9. Every document verification (`verify-doc`) writes `sellers.kyc_verification_log`;
   `verify-kyc` only flips the seller status to ACTIVE.
5. Admin verifies the whole KYC with `POST /sellers/{id}/verify-kyc`, or rejects with
   `POST /sellers/{id}/reject` and a reason.
6. Private document preview uses `GET /media/private/{assetId}` (creator/admin presigned GET).
7. Every document verification (`verify-doc`) writes `sellers.kyc_verification_log`;
   `verify-kyc` only flips the seller status to ACTIVE.

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
- `requestSellerDocument` → `POST /sellers/{id}/document-requests` → `sellers.document_requests`.
- `listMyDocumentRequests` → `GET /sellers/me/document-requests` → `sellers.document_requests`.
- `fulfillDocumentRequest` → `POST /sellers/me/document-requests/{id}/fulfill` →
  `sellers.kyc_documents` + `sellers.document_requests`.

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
