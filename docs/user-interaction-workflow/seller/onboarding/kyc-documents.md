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
   (`POST /sellers/{id}/document-requests {docType}`) instead of the old **Replace**. Missing document
   types (GSTIN / PAN / BANK_PROOF / SHOP_LICENSE / PASSBOOK / FSSAI) are listed as **cards** under
   "Request a missing document" — no dropdown and no admin-side upload. A request writes a `PENDING`
   `sellers.document_requests` row (one per seller+docType, so repeat taps refresh rather than
   duplicate) and notifies the applicant (`SELLER_DOC_REQUEST`, with `screen=SellWithUs` in the push
   data). While a request is open the row/card shows **Requested**.
6. **Applicant fulfils from the app:** tapping the push or the in-app notification routes the customer
   to the **Sell with us** screen (the push handler and `NotificationsScreen` both send
   `SELLER_DOC_REQUEST` to `SellWithUs`). That screen reads `GET /sellers/me/document-requests` and
   shows "Faazio has requested you to upload your <document>" with a **Capture & upload** button. The
   picked file uploads via `uploadSellerDocument`, then
   `POST /sellers/me/document-requests/{requestId}/fulfill {fileKey, assetId}` writes a fresh
   `sellers.kyc_documents` row of that type (unverified, so it re-enters review) and marks the
   request `FULFILLED` in one transaction. The card disappears once the list reloads.
7. Admin verifies the whole KYC with `POST /sellers/{id}/verify-kyc`, or rejects with
   `POST /sellers/{id}/reject` and a reason. `verify-kyc` (and `PATCH /sellers/{id}/status` →
   `ACTIVE`) **re-runs the compliance check first** against the stored profile + payout account +
   vendors, and refuses with `409 compliance_failed` only if the fresh verdict is still `FAILED`.
8. **Correct a flagged payout account without the seller:** the district review page's
   **Registered details → Edit** exposes the payout bank name, IFSC and account holder
   (`PUT /sellers/{id}/bank-account`); the account number itself stays masked. Saving re-runs
   compliance immediately, so a corrected IFSC clears the `FAILED` block. The **Decision** card
   shows the blocking reason; profile edits (`PATCH /sellers/{id}`) and seller re-submission
   (`POST /sellers/{id}/edit`) also revalidate.
9. Private document preview uses `GET /media/private/{assetId}` (creator/admin presigned GET).
10. Every document verification (`verify-doc`) writes `sellers.kyc_verification_log`;
    `verify-kyc` flips the seller status to ACTIVE (it writes no document/log rows).

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
- `gateway.verifySellerKyc` → `POST /sellers/{id}/verify-kyc` → revalidates compliance
  (`sellers.sellers.compliance_status`/`compliance_note`, appends `sellers.compliance_validations`)
  before flipping status to ACTIVE.
- `gateway.upsertBankAccount` → `PUT /sellers/{id}/bank-account` → `sellers.bank_accounts`, then
  revalidates compliance.
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
