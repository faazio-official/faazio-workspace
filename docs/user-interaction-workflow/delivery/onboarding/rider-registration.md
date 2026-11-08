# Rider registration

**App / route:** delivery · `Register` (`features/delivery-partner/screens/RegistrationFormScreen.tsx`)
**Status:** Shipped
**Trigger:** Verified phone with no active application.

## Steps

1. The rider enters personal details (name, state code, hub zone, address, city, pincode, emergency
   contact).
2. Vehicle type + capacity are chosen; capacity is capped by the vehicle
   (`VEHICLES[].cap`).
3. Required documents are captured (see [vehicle-documents.md](./vehicle-documents.md)).
4. Bank account details are entered (account name, number, IFSC).
5. `validate()` enforces name, 2-letter state, 6-digit pincode, 10-digit emergency contact, all
   required docs, and IFSC format.
6. Submit calls `gateway.registerDeliveryPartner(payload)` → `POST /delivery/register`.
7. Success stores the rider projection and replaces to `SubmissionSuccess`.
8. `409` means the phone already has a rider record in `ACTIVE`, `VERIFIED`, `SUSPENDED`, or
   `BLACKLISTED` status.

## State

- `useAuthStore` — Firebase session.
- `useDeliveryPartnerStore` — verified phone + rider projection.
- Local form state.

## Data path

- `gateway.uploadSellerDocument` → `POST /media/upload-url` + R2 `PUT` + `POST /media/confirm`.
- `gateway.registerDeliveryPartner` → `POST /delivery/register` → `delivery.delivery_boys`,
  `delivery.delivery_documents`, `delivery.delivery_bank_accounts`.
- No fixture rider/application rows.

## Success / error / empty

- **Success:** `SubmissionSuccess` (pending review).
- **Error:** inline validation/API message; 409 explains the existing application.
- **Empty:** no application → this form.

## Known gaps

- None specific.

## Linked docs

- `docs/architecture/mobile-app.md` (delivery partner)
- `docs/architecture/monolith-breakdown.md` (delivery row)
- `docs/architecture/db-schema.md` (`delivery.*`)
