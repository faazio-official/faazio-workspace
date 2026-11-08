# Delivery onboarding — domain index

**Status:** Shipped
**Routes:** `PhoneEntry` (`screens/PhoneEntryScreen.tsx`) → `OtpVerify` (`screens/OtpVerifyScreen.tsx`)
→ `Register` (`screens/RegistrationFormScreen.tsx`) → `SubmissionSuccess`
**Trigger:** First launch of the delivery app, sign-out, or an expired session.

## Flows

| Flow | Doc |
|---|---|
| Phone + OTP entry | This page |
| Rider registration | [rider-registration.md](./rider-registration.md) |
| Vehicle + documents | [vehicle-documents.md](./vehicle-documents.md) |

## Phone + OTP

1. `PhoneEntry` checks the existing session and `getDeliveryPartnerMe()`:
   - ACTIVE → `Dashboard`
   - pending → `SubmissionSuccess`
   - none (`404` on resume) → `Register`.
2. `OtpVerify` verifies the Firebase code and then calls `getDeliveryPartnerMe()` to route by status.
3. See the State section for the stores involved.

## State

- `useAuthStore` — Firebase session (Keychain).
- `useDeliveryPartnerStore` — rider projection / verified phone.
- Local form state on `PhoneEntry` / `OtpVerify`.

## Data path

- Firebase Phone Auth (shared with customer).
- `gateway.getDeliveryPartnerMe()` → `GET /delivery/me` → `delivery.delivery_boys`.
- No fixture rider data.

## Success / error / empty

- **Success:** routes to Dashboard / SubmissionSuccess / Register by server status.
- **Error:** inline error; no fake session.
- **Empty:** no application → registration.

## Known gaps

- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/RUNBOOKS/FIREBASE_AUTH.md`
- `docs/architecture/mobile-app.md` (delivery partner)
