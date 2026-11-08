# Vehicle + documents

**App / route:** delivery · `Register` (`features/delivery-partner/screens/RegistrationFormScreen.tsx`)
**Status:** Shipped
**Trigger:** Rider selects a vehicle and captures required documents.

## Steps

1. `chooseVehicle(id, cap)` sets the vehicle type and capacity.
2. `requiredDocs` is derived from the vehicle:
   - `BICYCLE` → base documents.
   - Motor vehicles → base + motor documents.
3. Each capture uploads via `gateway.uploadSellerDocument(uri, ownerId)` (media pipeline) and stores
   the object key + asset id.
4. Submit includes `documents[]` (`docType`, `fileKey`, `assetId`) in `POST /delivery/register`.
5. Admin review (`/admin/*/delivery-boys`) verifies documents and activates the rider
   (`PUT /delivery/register/{id}/verify`, `/activate`).
6. Admin uploads a replacement document with
   `PUT /delivery/register/{id}/documents/{docType}/reupload`. Riders cannot request a re-upload
   in-app: the rider-side request endpoint always returns `410 Gone`.

## State

- Local `docs`, `vehicleType`, `capacity`.
- `useDeliveryPartnerStore` after submit.

## Data path

- `gateway.uploadSellerDocument` → `/media/upload-url` + R2 `PUT` + `/media/confirm` →
  `media.assets`.
- `gateway.registerDeliveryPartner` → `POST /delivery/register` →
  `delivery.delivery_documents`, `delivery.delivery_boys`.
- Admin: `GET /delivery/register/{id}`, `PUT /delivery/register/{id}/verify`,
  `PUT /delivery/register/{id}/activate`.
- Private document preview: `GET /media/private/{id}`.

## Success / error / empty

- **Success:** all required docs captured; application submitted.
- **Error:** failed upload shows "could not upload <doc>"; submission blocked until every required
  doc is captured.
- **Empty:** no docs → cannot submit.

## Known gaps

- The rider-side re-upload request endpoint is retired (`410 Gone`); only admins can attach a
  replacement document. See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/monolith-breakdown.md` (delivery/media rows)
- `docs/architecture/db-schema.md` (`delivery.delivery_documents`)
