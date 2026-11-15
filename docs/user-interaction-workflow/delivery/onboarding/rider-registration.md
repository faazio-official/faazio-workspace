# Rider registration

**App / route:** delivery · `Register` (`features/delivery-partner/screens/RegistrationFormScreen.tsx`)
**Status:** Shipped
**Trigger:** Verified phone with no active application.
**Test account:** A live, ACTIVE rider test account is used for Play Store review — see
`client/mobile/docs/TEST_ACCOUNTS.md` (do not duplicate the credentials here).

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

## Pre-seeded ACTIVE rider (test account)

A rider row can exist **before** any registration. The delivery test account is seeded this way so
Play reviewers and developers sign in straight to the Dashboard:

- One-command setup: `server/gateway/scripts/create-delivery-test-account.sh` applies the seed and
  exits non-zero unless the rider is `ACTIVE` afterwards.
- Seed: `server/supabase/seed/test_delivery_rider.sql` (idempotent, applied from a dev terminal via
  `server/supabase/apply-migration.sh server/supabase/seed/test_delivery_rider.sql`).
  **It is not part of `--all --seed`**: that flag applies `seed/0001_seed.sql` only, so a fresh
  database needs this file applied explicitly or the test login lands on `Register`.
- It writes one `delivery.delivery_boys` row with `status='ACTIVE'` for the Firebase test number.
- The phone is stored in the canonical form `+919876543210` — **no spaces**. `NormalizePhone`
  (`internal/delivery/models.go`) strips non-digits and returns `+91` + the 10-digit national
  number, so a spaced value would never match and every rider call would 404.
- Because `GET /delivery/me` resolves by phone, the seeded row makes the existing login flow land
  on `Dashboard` with no client change and no fixture.
- `user_id` / `auth_uid` stay NULL: `checkout.ProvisionUserID` provisions `checkout.users` and
  `accounts.profile` only and does **not** backfill `delivery_boys`. Rider identity resolves by
  phone, so login works; the columns remain unlinked (see `KNOWN_GAPS.md`).
- The seeded rider has **no** `delivery_documents` and **no** `delivery_bank_accounts` rows. It is
  already `ACTIVE`, so nothing gates on KYC for it, and `GET /delivery/payouts` reads
  `delivery_orders` by `rider_id` rather than the bank row. A real rider would still need both
  before an admin could verify and pay them.

## Known gaps

- `delivery.delivery_boys.user_id` / `auth_uid` are never backfilled for a phone-OTP rider.
  `ProvisionUserID` writes `checkout.users` + `accounts.profile` only, so the rider row stays
  unlinked to the shared identity. Nothing rider-facing depends on it today (identity resolves by
  phone), but `notifyRider` skips any rider with an empty `user_id`, so push pings do not fire for
  an unlinked rider.

## Linked docs

- `docs/architecture/mobile-app.md` (delivery partner)
- `docs/architecture/monolith-breakdown.md` (delivery row)
- `docs/architecture/db-schema.md` (`delivery.*`)
