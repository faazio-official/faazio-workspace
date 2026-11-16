# Delivery onboarding — domain index

**Status:** Shipped
**Routes:** `PhoneEntry` (`screens/PhoneEntryScreen.tsx`) → `OtpVerify` (`screens/OtpVerifyScreen.tsx`)
→ `Register` (`screens/RegistrationFormScreen.tsx`) → `SubmissionSuccess` (application status —
[submission-success.md](./submission-success.md))
**Trigger:** First launch of the delivery app, sign-out, or an expired session.
**Visual layer:** `PhoneEntry` and `OtpVerify` open on the shared `DpAuthHero`
(`features/delivery-partner/components/DpAuthHero.tsx`) — the blue Faazio welcome wordmark
(`FaazioLogo` `variant="welcome"`, as on the customer welcome screen, the website and the pinned
`DPUtilityBar`), a sentence-case headline and, on the OTP step, a supporting description. The entry
step is intentionally minimal: no legal/independent-contractor paragraph and no "continue with the
signed-in account" link (an existing session is resumed automatically). The field, button and cards
come from the DP primitives (tokens in `theme/deliveryTokens.ts`, components in
`components/shared/dp/`); `Register` and `SubmissionSuccess` use the same primitives. Registration
collects the rider's contact email alongside the existing personal details.

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
- **Error:** inline error; no fake session. The two phases are reported separately so a broken
  `GET /delivery/me` is never mislabelled as a bad code. A rejected/expired code is mapped to user
  copy through `src/lib/otpError.ts` (never the raw `[auth/<code>] ...` SDK text); an expired code
  renders "That code has expired. Tap Resend OTP to get a new one." and drops the dead pending
  request. A non-Firebase verify failure (no `auth/*` code, e.g. a lost pending request after a JS
  reload or a second tap) renders "That verification expired. Tap Resend OTP to get a new code."
  Once the code is accepted, a rider-profile load failure (`GET /delivery/me` non-404, e.g. a
  `delivery_unavailable` 500) surfaces its own message ("You're signed in, but your rider profile
  could not load") instead of the gateway's raw text. The verified session is kept, the code stays
  in the field, the primary button becomes **Retry** to re-run `getDeliveryPartnerMe()` without a
  new OTP, and resend is disabled until the profile loads.
- **Empty:** no application → registration; no remembered numbers → the suggestion row is omitted.

## Known gaps

- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/RUNBOOKS/FIREBASE_AUTH.md`
- `docs/architecture/mobile-app.md` (delivery partner)
