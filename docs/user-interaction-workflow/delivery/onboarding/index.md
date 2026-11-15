# Delivery onboarding — domain index

**Status:** Shipped
**Routes:** `PhoneEntry` (`screens/PhoneEntryScreen.tsx`) → `OtpVerify` (`screens/OtpVerifyScreen.tsx`)
→ `Register` (`screens/RegistrationFormScreen.tsx`) → `SubmissionSuccess` (application status —
[submission-success.md](./submission-success.md))
**Trigger:** First launch of the delivery app, sign-out, or an expired session.
**Visual layer:** `PhoneEntry` and `OtpVerify` open on the shared `DpAuthHero`
(`features/delivery-partner/components/DpAuthHero.tsx`) — the Faazio welcome wordmark
(`FaazioLogo` `variant="welcome"`, as on the customer welcome screen), a sentence-case headline and,
on the entry step, the Pickup → Drop route signature. The field, button and cards come from the DP
primitives (tokens in `theme/deliveryTokens.ts`, components in `components/shared/dp/`); `Register`
and `SubmissionSuccess` use the same primitives.

`PhoneEntry` and `OtpVerify` mirror the customer login polish: the phone step auto-focuses, remembers
previously used numbers as tappable suggestions, and auto-advances to `OtpVerify` 150 ms after the
10th digit; the OTP step is a hidden-input + animated 6-segment field (shake on error, pulse on the
current digit) with a 30 s resend cooldown and hardware back that returns to the preserved number.

## Flows

| Flow | Doc |
|---|---|
| Phone + OTP entry | This page |
| Rider registration | [rider-registration.md](./rider-registration.md) |
| Vehicle + documents | [vehicle-documents.md](./vehicle-documents.md) |
| Application status (terminal state) | [submission-success.md](./submission-success.md) |

## Phone + OTP

1. `PhoneEntry` checks the existing session and `getDeliveryPartnerMe()`:
   - ACTIVE → `Dashboard`
   - pending → `SubmissionSuccess`
   - none (`404` on resume) → `Register`.

   A rider row can be pre-seeded as ACTIVE (the delivery test account is), which skips `Register`
   entirely and lands on `Dashboard`; seed it with
   `server/gateway/scripts/create-delivery-test-account.sh`. See
   [rider-registration.md](./rider-registration.md).
2. `PhoneEntry` auto-focuses the field, shows device-local **recent numbers** as suggestion chips, and
   sends the OTP either from the "Get OTP" button or automatically 150 ms after the 10th digit is
   typed. A successful send saves the number to the suggestions list. SMS User Consent is armed
   before the send.
3. `OtpVerify` shows an animated 6-segment field (hidden `oneTimeCode`/`sms-otp` input drives OS
   autofill), auto-focuses, auto-submits at 6 digits, enforces a 30 s resend cooldown, and verifies
   the Firebase code before calling `getDeliveryPartnerMe()` to route by status. Hardware back (and
   "Change number") returns to `PhoneEntry` with the typed number preserved.
4. See the State section for the stores involved.

## State

- `useAuthStore` — Firebase session (Keychain).
- `useDeliveryPartnerStore` — rider projection / verified phone.
- Local form state on `PhoneEntry` / `OtpVerify`.
- Recent numbers: `src/lib/recentPhones.ts` — an AsyncStorage-backed MRU list (key
  `faazio:recentPhones`, max 5, E.164). Device-local and App-Functionality only; cleared on sign-out
  (`useAuthStore.logout`).

## Data path

- Firebase Phone Auth (shared with customer).
- `gateway.getDeliveryPartnerMe()` → `GET /delivery/me` → `delivery.delivery_boys`.
- Recent numbers stay on-device (never sent to the gateway).
- No fixture rider data.

## Success / error / empty

- **Success:** routes to Dashboard / SubmissionSuccess / Register by server status.
- **Error:** inline error; no fake session. Firebase failures are mapped to user copy through
  `src/lib/otpError.ts` (never the raw `[auth/<code>] ...` SDK text). An expired code renders
  "That code has expired. Tap Resend OTP to get a new one." and drops the dead pending request.
- **Empty:** no application → registration; no remembered numbers → the suggestion row is omitted.

## Known gaps

- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/RUNBOOKS/FIREBASE_AUTH.md`
- `docs/architecture/mobile-app.md` (delivery partner)
