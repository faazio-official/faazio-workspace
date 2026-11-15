# Faazio Test Accounts — Single Source of Truth

This is the single source of truth for every test account used for **Google Play Console review**
and store submission. Do not duplicate these credentials in other docs — reference this file
instead. The per-listing answer sheets (`PLAYSTORE_RELEASE_CUSTOMER.md`,
`PLAYSTORE_RELEASE_DELIVERY.md`, `PLAYSTORE_RELEASE_SELLER.md`) point here for sign-in details.

## Firebase project

All three apps — customer, delivery partner, seller partner — are connected to **one** Firebase/GCP
project:

| Item | Value |
|---|---|
| Firebase project | `project-65696e12-8def-460e-b29` |
| GCP folder | `info-faazio-org` (project number `29787592730`) |

Customer Android (`com.faazio.customer`) and iOS (`com.faazio.customer`), delivery Android
(`com.faazio.deliverypartner`) and seller Android (`com.faazio.sellerpartner`) are all registered
under this project. See `docs/RUNBOOKS/FIREBASE_AUTH.md` §1.

> **Phone numbers are unique Firebase identities.** Never reuse the same phone number for two apps —
> Firebase would treat them as the same user and their roles would collide. The customer and
> delivery test numbers below are deliberately different.

## Test accounts

| App | Auth method | Test identifier | OTP / password | Play Console "Name" | Play Console "Username/email or phone" |
|---|---|---|---|---|---|
| Customer | Firebase phone OTP | `+91 9000000001` | `123456` | `Customer test account` | `+91 9000000001` |
| Delivery partner | Firebase phone OTP | `+91 9876543210` | `123456` | `Delivery Partner test account` | `+91 9876543210` |
| Seller partner | Email + password (`admins.portal_users`) | `faisalbashafaisalbasha@gmail.com` | `seller#123` | `Faazio Mart Tiruchirappalli` | `faisalbashafaisalbasha@gmail.com` |

> **The delivery account needs a server row, not just a Firebase number.** The delivery app routes
> on `GET /delivery/me`: `ACTIVE` → Dashboard, any other status → "under review", `404` → Register.
> The ACTIVE rider is seeded idempotently by `server/supabase/seed/test_delivery_rider.sql`; apply it
> (and verify the result) with `server/gateway/scripts/create-delivery-test-account.sh`. If the app
> lands on Register instead of the Dashboard, that seed has not been applied to the target database.
> The row stores the phone as `+919876543210` (no spaces) because `NormalizePhone` returns that
> canonical form.

- Both Firebase numbers and their fixed codes are **already registered** in Firebase Console →
  Authentication → Sign-in method → Phone → **Phone numbers for testing**.
- The seller account is a live `SELLER` role tied to `sel-tiruchi-01`; it is provisioned by a Faazio
  superadmin (no self sign-up). See `docs/RUNBOOKS/PORTAL_AUTH.md`.

## Firebase Console setup

1. Open **Firebase Console** → project `project-65696e12-8def-460e-b29` → **Authentication** →
   **Sign-in method** → **Phone**.
2. Under **Phone numbers for testing**, add each Firebase number with its fixed OTP:
   - `+91 9000000001` → `123456`
   - `+91 9876543210` → `123456`
3. Test numbers let Play reviewers sign in **without a real SMS**. They only work for the number/code
   pair registered here.
4. Do not delete or change a test number while an app is under review.

## Play Console setup

For **each** app → **App content** → **Sign in details** (select "All or some functionality is
restricted"):

- **Name:** from the table above.
- **Username/email or phone:** from the table above.
- **Password:** the OTP for the Firebase phone apps, or the actual password for the seller app.
- **Any other information required for access:** copy the step-by-step sign-in instructions from the
  matching `PLAYSTORE_RELEASE_*.md` file.

Keep the answers identical to the table — Play reviewers use exactly these values.

## Warnings

- **Never** use a personal phone number or personal Google account for a test account.
- **Never** reuse a phone number across two apps in the same Firebase project.
- Do **not** delete the test account while any app is under review — reviewers lose access and the
  submission is rejected.
- The customer (`+91 9000000001`) and delivery (`+91 9876543210`) numbers are **different on
  purpose**; do not "simplify" them to a shared number.

## See also

- `PLAYSTORE_RELEASE_CUSTOMER.md` — customer listing answer sheet (§1 App access).
- `PLAYSTORE_RELEASE_DELIVERY.md` — delivery listing answer sheet (§1 App access).
- `PLAYSTORE_RELEASE_SELLER.md` — seller listing answer sheet (§1 App access).
- `docs/RUNBOOKS/FIREBASE_AUTH.md` — Firebase phone-OTP setup and test numbers.
- `docs/RUNBOOKS/PORTAL_AUTH.md` — seller portal account provisioning.
