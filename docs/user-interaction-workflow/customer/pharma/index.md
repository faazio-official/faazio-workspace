# Pharma — domain index

**Status:** Partial (pharmacy discovery renders the authored offline shell on a failed category
read — a no-mocks gap; prescription and blood flows are shipped)
**Routes:** `SubApp` `PHARMA` (`PharmaScreen.tsx`), `MedicalShopDetails`, `ProductDetail`,
`PrescriptionFlow`, `BloodDonor`, `BloodDonorDetails`, `BloodRequestDescription`
**Trigger:** Home → Pharma, pharmacy card, prescription entry, or blood-donor entry.

## Flows

| Flow | Doc |
|---|---|
| Prescription upload + quote | [prescription-upload.md](./prescription-upload.md) |
| Blood donor / request board | [blood-donor.md](./blood-donor.md) |
| Blood donor detail + request description | [blood-donor-details.md](./blood-donor-details.md) |

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
- **Error:** inline error on the failing step; prescription/donor/match reads never fabricate rows.
  The category grid does fall back to its authored `PHARMA_PRODUCTS_DB` shell after a failed
  category read (a no-mocks gap — see Known gaps).
- **Empty:** no nearby pharmacies / no blood requests → honest empty state.

## Known gaps

- The category grid renders the authored `PHARMA_PRODUCTS_DB` rows when the batch read fails
  (`PharmaScreen.tsx:149-160,242`) even while the gateway is enabled — a no-mocks gap. See
  [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).
- `MedicalShopDetails` has no dedicated page yet (described here only); tracked as a coverage gap.
- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/mobile-app.md` (prescription + blood donor)
- `docs/architecture/monolith-breakdown.md` (pharma/blood rows)
- `data/DATA_CONTROL.md` (`@data/pharma`)
