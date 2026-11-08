# Prescription upload + quote

**App / route:** customer · `PrescriptionFlow` (`features/pharma/prescription/PrescriptionFlowScreen.tsx`)
**Status:** Shipped
**Trigger:** Pharma home "Upload prescription" or a pharmacy's prescription entry.

## Steps

1. **CAPTURE:** the user selects/captures prescription pages.
2. **NOTE:** optional note; a preset vendor skips vendor selection.
3. **VENDORS:** choose a pharmacy and fulfillment mode (Delivery/Pickup).
4. On confirm, `gateway.getAddresses()` resolves a **server-owned** default address id (never a
   fixture id).
5. Each photo uploads sequentially: `gateway.uploadPrescriptionImage(uri)` →
   `POST /prescriptions/upload-url` then `PUT {uploadUrl}`; only object **keys** are kept.
6. If remote and any page failed to upload, the flow hard-stops with a retry message — no silent
   partial upload.
7. `gateway.createPrescription({ vendorId, fulfillment, pages, note, imagePaths, addressId })` →
   `POST /prescriptions`.
8. The server returns the authoritative Rx id; `ordersStore.recordOrder` records a prescription
   order keyed by that id.
9. **CONFIRMED:** the shopper sees the submitted state; the pharmacy quotes/reveals later.

## State

- `useOrdersStore` — prescription order mirror keyed by the server Rx id.
- Local `draft`, `step`, `uploadProgress`, `submitting`, `submitError`. The flow does not use
  `usePharmaStore`.

## Data path

- `gateway.getAddresses` → `GET /profile/addresses` → `checkout.addresses`.
- `gateway.uploadPrescriptionImage` → `POST /prescriptions/upload-url` + presigned `PUT` → R2 /
  Supabase Storage.
- `gateway.createPrescription` → `POST /prescriptions` → `pharma.prescriptions`.
- Quote/reveal lifecycle: `GET /seller/prescriptions`, `POST /seller/prescriptions/{id}/quotes`,
  `PUT /prescriptions/{id}/status` → `pharma.quote_items`, `pharma.status_history`.
- Cache: `faazio:v1:pharma:prescriptions:{userId}` 60 s; never edge-cached.

## Success / error / empty

- **Success:** CONFIRMED with server Rx id.
- **Error:** failed page upload → retry message; 404/422 → "pharmacy can no longer receive
  prescriptions, pick another"; other failures keep the user on the step with an explanation.
- **Empty:** a prescription must have at least one page (server rejects an empty Rx).

## Known gaps

- Two stale comments in `PrescriptionFlowScreen.tsx` mention a fixture/mock fallback that no longer
  exists (the code is server-only). See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/mobile-app.md` (prescription flow)
- `docs/architecture/monolith-breakdown.md` (pharma row)
- `docs/architecture/db-schema.md` (pharma tables)
