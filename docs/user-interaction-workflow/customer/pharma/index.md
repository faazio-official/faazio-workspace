# Pharma — domain index

**Status:** Shipped
**Routes:** `SubApp` `PHARMA` (`PharmaScreen.tsx`), `MedicalShopDetails`, `ProductDetail`,
`PrescriptionFlow`, `BloodDonor`, `BloodDonorDetails`, `BloodRequestDescription`
**Trigger:** Home → Pharma, pharmacy card, prescription entry, or blood-donor entry.

## Flows

| Flow | Doc |
|---|---|
| Prescription upload + quote | [prescription-upload.md](./prescription-upload.md) |
| Blood donor / request board | [blood-donor.md](./blood-donor.md) |

## Pharmacy discovery

- `PharmaScreen` loads `fetchPharmaSections` (`GET /sdui/pharma`), `fetchStores('PHARMA')`,
  coupons (`GET /coupons?app=PHARMA`), and server discounts (`GET /promo/active-discounts`).
- `MedicalShopDetailsScreen` loads `getStore` + products.
- Product detail uses the shared PDP path.

## State

- `useCartStore` — pharmacy cart lines.
- `useBloodDonorStore` — donor draft, registration, matches, offline outbox.
- `useLocationStore` — nearby pharmacy origin.
- Prescription flow uses local component state + `useOrdersStore`; `usePharmaStore` is not part of
  that flow (it is only used by account-deletion/logout cleanup).

## Data path

- `pharma.prescriptions`, `pharma.quote_items`, `pharma.status_history`.
- `blood.donors`, `blood.requests`, `blood.interests`, `blood.match_requests`.
- `directory.stores`, `catalog.products`, `inventory.stock`.

## Success / error / empty

- **Success:** pharmacy rail/detail render server rows; prescription submits with a server Rx id;
  donor profile/request writes return a sync outcome.
- **Error:** inline error on the failing step; no fixture pharmacy, prescription, donor, or match.
- **Empty:** no nearby pharmacies / no blood requests → honest empty state.

## Known gaps

- Blood-donor `StepPlaceholder` is defensive dead code today; adding a step without a `case` would
  surface "coming next". See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/mobile-app.md` (prescription + blood donor)
- `docs/architecture/monolith-breakdown.md` (pharma/blood rows)
- `data/DATA_CONTROL.md` (`@data/pharma`)
